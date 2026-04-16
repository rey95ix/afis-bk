import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OltConnectionService } from './olt-connection.service';
import { OltCommandBuilderService } from './olt-command-builder.service';
import { InstalarOntDto } from './dto/instalar-ont.dto';
import { CambiarEquipoDto } from './dto/cambiar-equipo.dto';
import { CambiarPlanOntDto } from './dto/cambiar-plan-ont.dto';
import {
  OltOperationResult,
  OntWanInfo,
  ClienteOltInfo,
  DisponiblesResult,
  DiscoveredOnt,
} from './interfaces/olt-command.interface';
import { parseAutofindOutput } from './parsers/autofind.parser';

@Injectable()
export class OltService {
  private readonly logger = new Logger(OltService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionService: OltConnectionService,
    private readonly commandBuilder: OltCommandBuilderService,
  ) {}

  // === HELPER: Obtener datos OLT del cliente ===
  private async getClienteOltData(idCliente: number) {
    const oltCliente = await this.prisma.olt_cliente.findFirst({
      where: { id_cliente: idCliente, ont_status: 1 },
      include: {
        tarjeta: {
          include: {
            equipo: {
              include: { credencial: true },
            },
          },
        },
        modelo: true,
      },
    });

    if (!oltCliente) {
      throw new NotFoundException(
        `No se encontró configuración OLT activa para el cliente ${idCliente}`,
      );
    }

    if (!oltCliente.tarjeta.equipo.credencial) {
      throw new BadRequestException(
        `No se encontraron credenciales SSH para el equipo OLT ${oltCliente.tarjeta.equipo.nombre}`,
      );
    }

    return oltCliente;
  }

  // === HELPER: Registrar comando en DB ===
  private async registrarComando(
    idOltEquipo: number,
    idCliente: number | null,
    tipoOperacion: string,
    comando: string,
    idUsuario: number,
  ) {
    return this.prisma.olt_comando.create({
      data: {
        id_olt_equipo: idOltEquipo,
        id_cliente: idCliente,
        tipo_operacion: tipoOperacion,
        comando,
        estado: 0,
        id_usuario: idUsuario,
      },
    });
  }

  // === HELPER: Actualizar resultado del comando ===
  private async actualizarComando(
    idOltComando: number,
    success: boolean,
    output: string,
    error?: string,
  ) {
    await this.prisma.olt_comando.update({
      where: { id_olt_comando: idOltComando },
      data: {
        estado: success ? 1 : 2,
        respuesta: output,
        error_mensaje: error || null,
        ejecutadoAt: new Date(),
      },
    });
  }

  // === OPERACIONES DE RED ===

  async resetOnt(
    idCliente: number,
    idUsuario: number,
  ): Promise<OltOperationResult> {
    const oltCliente = await this.getClienteOltData(idCliente);
    const slot = oltCliente.tarjeta.slot;
    const idOltEquipo = oltCliente.tarjeta.equipo.id_olt_equipo;

    const comando = this.commandBuilder.buildResetCommand({
      slot,
      port: oltCliente.port,
      ontId: oltCliente.ont,
    });

    const dbComando = await this.registrarComando(
      idOltEquipo,
      idCliente,
      'RESET',
      comando,
      idUsuario,
    );

    const result = await this.connectionService.executeCommand(
      idOltEquipo,
      comando,
    );

    await this.actualizarComando(
      dbComando.id_olt_comando,
      result.success,
      result.output,
      result.error,
    );

    if (!result.success) {
      throw new InternalServerErrorException(
        `Error al reiniciar ONT: ${result.error}`,
      );
    }

    return {
      success: true,
      message: `ONT reiniciado exitosamente (Slot ${slot}, Puerto ${oltCliente.port}, ONT ${oltCliente.ont})`,
      output: result.output,
    };
  }

  async getOntWanInfo(idCliente: number): Promise<OntWanInfo> {
    const oltCliente = await this.getClienteOltData(idCliente);
    const slot = oltCliente.tarjeta.slot;
    const idOltEquipo = oltCliente.tarjeta.equipo.id_olt_equipo;

    const comando = this.commandBuilder.buildDisplayWanInfoCommand({
      slot,
      port: oltCliente.port,
      ontId: oltCliente.ont,
    });

    const output = await this.connectionService.executeQuery(
      idOltEquipo,
      comando,
    );

    return { idCliente, output };
  }

  async instalarOnt(
    dto: InstalarOntDto,
    idUsuario: number,
  ): Promise<OltOperationResult> {
    // Verify target slot is available
    const targetSlot = await this.prisma.olt_cliente.findFirst({
      where: {
        id_olt_tarjeta: dto.idOltTarjeta,
        port: dto.port,
        ont: dto.ontId,
      },
    });

    if (targetSlot && targetSlot.ont_status === 1) {
      throw new BadRequestException(
        `El ONT ${dto.ontId} en puerto ${dto.port} ya está ocupado`,
      );
    }

    const tarjeta = await this.prisma.olt_tarjeta.findUnique({
      where: { id_olt_tarjeta: dto.idOltTarjeta },
      include: { equipo: { include: { credencial: true } } },
    });

    if (!tarjeta) {
      throw new NotFoundException(
        `Tarjeta OLT ${dto.idOltTarjeta} no encontrada`,
      );
    }

    if (!tarjeta.equipo.credencial) {
      throw new BadRequestException(
        `No se encontraron credenciales SSH para el equipo OLT ${tarjeta.equipo.nombre}`,
      );
    }

    // Get modelo for srvprofile
    const modelo = await this.prisma.olt_modelo.findUnique({
      where: { id_olt_modelo: dto.idOltModelo },
    });

    const comando = this.commandBuilder.buildInstallCommand({
      slot: tarjeta.slot,
      port: dto.port,
      ontId: dto.ontId,
      serviceport: dto.serviceport,
      sn: dto.sn,
      password: dto.password,
      tipoAuth: dto.tipoAuth,
      vlan: dto.vlan,
      userVlan: dto.userVlan,
      srvprofileOlt: modelo?.srvprofile_olt || undefined,
    });

    const dbComando = await this.registrarComando(
      tarjeta.equipo.id_olt_equipo,
      dto.idCliente,
      'INSTALL',
      comando,
      idUsuario,
    );

    const result = await this.connectionService.executeCommand(
      tarjeta.equipo.id_olt_equipo,
      comando,
    );

    await this.actualizarComando(
      dbComando.id_olt_comando,
      result.success,
      result.output,
      result.error,
    );

    if (!result.success) {
      throw new InternalServerErrorException(
        `Error al instalar ONT: ${result.error}`,
      );
    }

    // Update or create olt_cliente record
    if (targetSlot) {
      await this.prisma.olt_cliente.update({
        where: { id_olt_cliente: targetSlot.id_olt_cliente },
        data: {
          id_cliente: dto.idCliente,
          ont_status: 1,
          serviceport_status: 1,
          serviceport: dto.serviceport,
          id_olt_modelo: dto.idOltModelo,
          sn: dto.sn || null,
          password: dto.password || null,
          vlan: dto.vlan,
          user_vlan: dto.userVlan,
          fecha_activacion: new Date(),
        },
      });
    } else {
      await this.prisma.olt_cliente.create({
        data: {
          id_cliente: dto.idCliente,
          id_olt_tarjeta: dto.idOltTarjeta,
          port: dto.port,
          ont: dto.ontId,
          ont_status: 1,
          serviceport: dto.serviceport,
          serviceport_status: 1,
          id_olt_modelo: dto.idOltModelo,
          sn: dto.sn || null,
          password: dto.password || null,
          vlan: dto.vlan,
          user_vlan: dto.userVlan,
          fecha_activacion: new Date(),
        },
      });
    }

    return {
      success: true,
      message: `ONT instalado exitosamente (Puerto ${dto.port}, ONT ${dto.ontId})`,
      output: result.output,
    };
  }

  async suspenderOnt(
    idCliente: number,
    idUsuario: number,
  ): Promise<OltOperationResult> {
    const oltCliente = await this.getClienteOltData(idCliente);
    const slot = oltCliente.tarjeta.slot;
    const idOltEquipo = oltCliente.tarjeta.equipo.id_olt_equipo;

    const comando = this.commandBuilder.buildDeactivateCommand({
      slot,
      port: oltCliente.port,
      ontId: oltCliente.ont,
    });

    const dbComando = await this.registrarComando(
      idOltEquipo,
      idCliente,
      'DEACTIVATE',
      comando,
      idUsuario,
    );

    const result = await this.connectionService.executeCommand(
      idOltEquipo,
      comando,
    );

    await this.actualizarComando(
      dbComando.id_olt_comando,
      result.success,
      result.output,
      result.error,
    );

    if (!result.success) {
      throw new InternalServerErrorException(
        `Error al suspender ONT: ${result.error}`,
      );
    }

    return {
      success: true,
      message: `ONT suspendido exitosamente (Slot ${slot}, Puerto ${oltCliente.port}, ONT ${oltCliente.ont})`,
      output: result.output,
    };
  }

  async activarOnt(
    idCliente: number,
    idUsuario: number,
  ): Promise<OltOperationResult> {
    const oltCliente = await this.getClienteOltData(idCliente);
    const slot = oltCliente.tarjeta.slot;
    const idOltEquipo = oltCliente.tarjeta.equipo.id_olt_equipo;

    const comando = this.commandBuilder.buildActivateCommand({
      slot,
      port: oltCliente.port,
      ontId: oltCliente.ont,
    });

    const dbComando = await this.registrarComando(
      idOltEquipo,
      idCliente,
      'ACTIVATE',
      comando,
      idUsuario,
    );

    const result = await this.connectionService.executeCommand(
      idOltEquipo,
      comando,
    );

    await this.actualizarComando(
      dbComando.id_olt_comando,
      result.success,
      result.output,
      result.error,
    );

    if (!result.success) {
      throw new InternalServerErrorException(
        `Error al activar ONT: ${result.error}`,
      );
    }

    return {
      success: true,
      message: `ONT activado exitosamente (Slot ${slot}, Puerto ${oltCliente.port}, ONT ${oltCliente.ont})`,
      output: result.output,
    };
  }

  async cambiarEquipo(
    dto: CambiarEquipoDto,
    idUsuario: number,
  ): Promise<OltOperationResult> {
    // Step 1: Get current equipment info
    const oltClienteActual = await this.getClienteOltData(dto.idCliente);
    const slotActual = oltClienteActual.tarjeta.slot;
    const idOltEquipo = oltClienteActual.tarjeta.equipo.id_olt_equipo;

    // Step 2: Get new slot info
    const nuevoSlot = await this.prisma.olt_cliente.findUnique({
      where: { id_olt_cliente: dto.idNuevoOltCliente },
      include: {
        tarjeta: { include: { equipo: { include: { credencial: true } } } },
      },
    });

    if (!nuevoSlot) {
      throw new NotFoundException(
        `Slot destino ${dto.idNuevoOltCliente} no encontrado`,
      );
    }

    if (nuevoSlot.ont_status === 1 && nuevoSlot.id_cliente) {
      throw new BadRequestException('El slot destino ya está ocupado');
    }

    const nuevoModelo = await this.prisma.olt_modelo.findUnique({
      where: { id_olt_modelo: dto.idOltModeloNuevo },
    });

    // Step 3: Delete old equipment from OLT
    const deleteCmd = this.commandBuilder.buildDeleteCommand({
      slot: slotActual,
      port: oltClienteActual.port,
      ontId: oltClienteActual.ont,
      serviceport: oltClienteActual.serviceport,
    });

    const dbCmdDelete = await this.registrarComando(
      idOltEquipo,
      dto.idCliente,
      'DELETE',
      deleteCmd,
      idUsuario,
    );

    const deleteResult = await this.connectionService.executeCommand(
      idOltEquipo,
      deleteCmd,
    );

    await this.actualizarComando(
      dbCmdDelete.id_olt_comando,
      deleteResult.success,
      deleteResult.output,
      deleteResult.error,
    );

    if (!deleteResult.success) {
      throw new InternalServerErrorException(
        `Error al eliminar equipo antiguo: ${deleteResult.error}`,
      );
    }

    // Step 4: Install new equipment on OLT (SSH, no rollback posible)
    const nuevoSlotTarjeta = nuevoSlot.tarjeta;
    const idOltEquipoNuevo = nuevoSlotTarjeta.equipo.id_olt_equipo;

    const installCmd = this.commandBuilder.buildInstallCommand({
      slot: nuevoSlotTarjeta.slot,
      port: nuevoSlot.port,
      ontId: nuevoSlot.ont,
      serviceport: nuevoSlot.serviceport,
      sn: dto.snNuevo,
      password: dto.passwordNuevo,
      tipoAuth: dto.snNuevo ? 'SN' : 'LOID',
      vlan: dto.vlanNuevo,
      userVlan: dto.userVlanNuevo,
      srvprofileOlt: nuevoModelo?.srvprofile_olt || undefined,
    });

    const dbCmdInstall = await this.registrarComando(
      idOltEquipoNuevo,
      dto.idCliente,
      'EQUIPMENT_CHANGE',
      installCmd,
      idUsuario,
    );

    const installResult = await this.connectionService.executeCommand(
      idOltEquipoNuevo,
      installCmd,
    );

    await this.actualizarComando(
      dbCmdInstall.id_olt_comando,
      installResult.success,
      installResult.output,
      installResult.error,
    );

    if (!installResult.success) {
      throw new InternalServerErrorException(
        `Error al instalar equipo nuevo: ${installResult.error}`,
      );
    }

    // Steps 5-7: DB orchestration atómica (desactivar slot viejo + activar
    // slot nuevo + registrar cambio). Si esto falla después del SSH exitoso,
    // dejamos rastro en olt_comando para intervención manual.
    try {
      await this.prisma.$transaction(async (tx) => {
        // Desactivar slot viejo
        await tx.olt_cliente.update({
          where: { id_olt_cliente: oltClienteActual.id_olt_cliente },
          data: {
            ont_status: 0,
            serviceport_status: 0,
            id_cliente: null,
          },
        });

        // Activar slot nuevo
        await tx.olt_cliente.update({
          where: { id_olt_cliente: nuevoSlot.id_olt_cliente },
          data: {
            id_cliente: dto.idCliente,
            ont_status: 1,
            serviceport_status: 1,
            id_olt_modelo: dto.idOltModeloNuevo,
            sn: dto.snNuevo,
            password: dto.passwordNuevo || null,
            vlan: dto.vlanNuevo,
            user_vlan: dto.userVlanNuevo,
            fecha_activacion: new Date(),
          },
        });

        // Registrar cambio de equipo
        await tx.olt_cambio_equipo.create({
          data: {
            id_cliente: dto.idCliente,
            sn_anterior: oltClienteActual.sn,
            sn_nuevo: dto.snNuevo,
            password_anterior: oltClienteActual.password,
            password_nuevo: dto.passwordNuevo || null,
            id_modelo_anterior: oltClienteActual.id_olt_modelo,
            id_modelo_nuevo: dto.idOltModeloNuevo,
            observacion: dto.observacion || null,
            id_usuario: idUsuario,
          },
        });
      });
    } catch (txError) {
      const mensaje =
        txError instanceof Error ? txError.message : 'Error desconocido';
      this.logger.error(
        `INCONSISTENCIA: SSH exitoso pero falló persistencia DB en cambioEquipo cliente=${dto.idCliente}: ${mensaje}`,
      );
      await this.registrarComando(
        idOltEquipoNuevo,
        dto.idCliente,
        'EQUIPMENT_CHANGE_DB_FAIL',
        `SSH OK pero DB falló: ${mensaje}`,
        idUsuario,
      );
      throw new InternalServerErrorException(
        `Equipo reinstalado en OLT pero falló el registro en BD. Se requiere intervención manual. Detalle: ${mensaje}`,
      );
    }

    return {
      success: true,
      message: 'Cambio de equipo realizado exitosamente',
      output: installResult.output,
    };
  }

  async cambiarPlan(
    dto: CambiarPlanOntDto,
    idUsuario: number,
  ): Promise<OltOperationResult> {
    const oltCliente = await this.getClienteOltData(dto.idCliente);
    const slot = oltCliente.tarjeta.slot;
    const idOltEquipo = oltCliente.tarjeta.equipo.id_olt_equipo;

    const comando = this.commandBuilder.buildPlanChangeCommand({
      slot,
      port: oltCliente.port,
      ontId: oltCliente.ont,
      serviceport: oltCliente.serviceport,
      idTraficoUp: dto.idTraficoUp,
      idTraficoDown: dto.idTraficoDown,
    });

    const dbComando = await this.registrarComando(
      idOltEquipo,
      dto.idCliente,
      'PLAN_CHANGE',
      comando,
      idUsuario,
    );

    const result = await this.connectionService.executeCommand(
      idOltEquipo,
      comando,
    );

    await this.actualizarComando(
      dbComando.id_olt_comando,
      result.success,
      result.output,
      result.error,
    );

    if (!result.success) {
      throw new InternalServerErrorException(
        `Error al cambiar plan: ${result.error}`,
      );
    }

    return {
      success: true,
      message: 'Plan de tráfico modificado exitosamente',
      output: result.output,
    };
  }

  // === CONSULTAS DE DATOS ===

  async getClienteOltInfo(idCliente: number): Promise<ClienteOltInfo> {
    const oltCliente = await this.prisma.olt_cliente.findFirst({
      where: { id_cliente: idCliente, ont_status: 1 },
      include: {
        tarjeta: {
          include: {
            equipo: true,
          },
        },
        modelo: true,
      },
    });

    if (!oltCliente) {
      throw new NotFoundException(
        `No se encontró configuración OLT para el cliente ${idCliente}`,
      );
    }

    const ip = await this.prisma.olt_cliente_ip.findFirst({
      where: { id_cliente: idCliente },
      include: { red: true },
    });

    return {
      idCliente,
      oltCliente,
      tarjeta: oltCliente.tarjeta,
      equipo: oltCliente.tarjeta.equipo,
      credencial: !!await this.prisma.olt_credencial.findUnique({
        where: { id_olt_equipo: oltCliente.tarjeta.equipo.id_olt_equipo },
      }),
      ip: ip || undefined,
    };
  }

  async getDisponibles(
    idOltTarjeta: number,
    port: number,
  ): Promise<DisponiblesResult> {
    const ocupados = await this.prisma.olt_cliente.findMany({
      where: {
        id_olt_tarjeta: idOltTarjeta,
        port,
        ont_status: 1,
      },
      select: { ont: true, serviceport: true },
    });

    const ocupadosOnt = new Set(ocupados.map((o) => o.ont));
    const ocupadosSp = new Set(ocupados.map((o) => o.serviceport));

    // ONT IDs available (0-127 typical for GPON)
    const ontIds: number[] = [];
    for (let i = 0; i <= 127; i++) {
      if (!ocupadosOnt.has(i)) ontIds.push(i);
    }

    // Service ports available (check from existing allocations)
    const allServicePorts = await this.prisma.olt_cliente.findMany({
      where: { id_olt_tarjeta: idOltTarjeta },
      select: { serviceport: true },
      distinct: ['serviceport'],
    });
    const allSpSet = new Set(allServicePorts.map((s) => s.serviceport));

    const serviceports: number[] = [];
    // Suggest next available service ports
    let sp = 0;
    while (serviceports.length < 20 && sp < 4096) {
      if (!allSpSet.has(sp)) serviceports.push(sp);
      sp++;
    }

    return { ontIds, serviceports };
  }

  async discoverUnregisteredOnts(
    idOltEquipo: number,
  ): Promise<DiscoveredOnt[]> {
    this.logger.log(
      `[autofind] Iniciando descubrimiento para equipo=${idOltEquipo}`,
    );
    try {
      const equipo = await this.prisma.olt_equipo.findUnique({
        where: { id_olt_equipo: idOltEquipo },
        include: { credencial: true, tarjetas: true },
      });

      if (!equipo) {
        this.logger.warn(
          `[autofind] Equipo OLT ${idOltEquipo} no encontrado en BD`,
        );
        throw new NotFoundException(
          `Equipo OLT ${idOltEquipo} no encontrado`,
        );
      }

      this.logger.log(
        `[autofind] Equipo encontrado: ${equipo.nombre} (${equipo.ip_address}), tarjetas=${equipo.tarjetas.length}, credencial=${!!equipo.credencial}`,
      );

      if (!equipo.credencial) {
        throw new BadRequestException(
          `No se encontraron credenciales SSH para el equipo OLT ${equipo.nombre}`,
        );
      }

      const comando = this.commandBuilder.buildAutofindAllCommand();
      this.logger.debug(
        `[autofind] Comando a ejecutar:\n${comando}`,
      );

      let output: string;
      try {
        output = await this.connectionService.executeQuery(
          equipo.id_olt_equipo,
          comando,
        );
      } catch (sshError) {
        const msg =
          sshError instanceof Error ? sshError.message : String(sshError);
        this.logger.error(
          `[autofind] Error SSH en equipo ${equipo.nombre} (${equipo.ip_address}): ${msg}`,
          sshError instanceof Error ? sshError.stack : undefined,
        );
        throw new InternalServerErrorException(
          `Error SSH al ejecutar autofind en ${equipo.nombre}: ${msg}`,
        );
      }

      this.logger.debug(
        `[autofind] Output recibido (${output?.length ?? 0} chars):\n${output}`,
      );

      let discovered: DiscoveredOnt[];
      try {
        discovered = parseAutofindOutput(output);
      } catch (parseError) {
        const msg =
          parseError instanceof Error
            ? parseError.message
            : String(parseError);
        this.logger.error(
          `[autofind] Error parseando output de autofind: ${msg}`,
          parseError instanceof Error ? parseError.stack : undefined,
        );
        this.logger.error(`[autofind] Output crudo que falló:\n${output}`);
        throw new InternalServerErrorException(
          `Error parseando respuesta de la OLT: ${msg}`,
        );
      }

      this.logger.log(
        `[autofind] Parser extrajo ${discovered.length} ONTs descubiertas`,
      );

      // Enriquecer cada ONT descubierta con la tarjeta correspondiente al slot
      const tarjetasBySlot = new Map<number, { id: number; nombre: string }>();
      for (const t of equipo.tarjetas) {
        tarjetasBySlot.set(t.slot, {
          id: t.id_olt_tarjeta,
          nombre: t.nombre,
        });
      }

      const result = discovered.map((o) => {
        const tarjeta = tarjetasBySlot.get(o.slot);
        return {
          ...o,
          idOltTarjeta: tarjeta?.id,
          tarjetaNombre: tarjeta?.nombre,
        };
      });

      this.logger.log(
        `[autofind] Descubrimiento completado exitosamente: ${result.length} ONTs`,
      );
      return result;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[autofind] Error inesperado en discoverUnregisteredOnts(equipo=${idOltEquipo}): ${msg}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        `Error inesperado al descubrir ONTs: ${msg}`,
      );
    }
  }

  async getEquipos() {
    return this.prisma.olt_equipo.findMany({
      include: {
        credencial: { select: { id_olt_credencial: true } },
        tarjetas: true,
      },
      orderBy: { id_olt_equipo: 'asc' },
    });
  }

  async getHistorialComandos(idCliente: number) {
    return this.prisma.olt_comando.findMany({
      where: { id_cliente: idCliente },
      include: {
        usuario: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTarjetas() {
    return this.prisma.olt_tarjeta.findMany({
      include: { equipo: true },
      orderBy: { id_olt_tarjeta: 'asc' },
    });
  }

  async getModelos() {
    return this.prisma.olt_modelo.findMany({
      include: { marca: true },
      orderBy: { id_olt_modelo: 'asc' },
    });
  }

  async getPerfilesTrafico() {
    return this.prisma.olt_perfil_trafico.findMany({
      orderBy: { id_olt_perfil_trafico: 'asc' },
    });
  }

  async getHistorialCambioEquipo(idCliente: number) {
    return this.prisma.olt_cambio_equipo.findMany({
      where: { id_cliente: idCliente },
      include: {
        usuario: {
          select: { id_usuario: true, nombres: true, apellidos: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
