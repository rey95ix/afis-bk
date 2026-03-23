import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { metodo_pago_abono, cliente } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ContratoPagosService } from 'src/modules/facturacion/services/contrato-pagos.service';
import { PayWayService } from './payway.service';
import { MailService } from 'src/modules/mail/mail.service';
import type { PagoTarjetaPortalDto } from './dto/pago-tarjeta-portal.dto';
import type { CrearPagoIntentDto } from './dto/crear-pago-intent.dto';

@Injectable()
export class ClientePortalService {
  private readonly portalSystemUserId: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private contratoPagosService: ContratoPagosService,
    private payWayService: PayWayService,
    private mailService: MailService,
  ) {
    this.portalSystemUserId = Number(this.configService.get<string>('PORTAL_SYSTEM_USER_ID', '1'));
  }

  async obtenerContratos(idCliente: number) {
    const contratos = await this.prisma.atcContrato.findMany({
      where: {
        id_cliente: idCliente,
        estado: { not: 'CANCELADO' },
      },
      select: {
        id_contrato: true,
        codigo: true,
        estado: true,
        fecha_inicio_contrato: true,
        fecha_fin_contrato: true,
        meses_contrato: true,
        costo_instalacion: true,
        plan: {
          select: {
            nombre: true,
            precio: true,
            velocidad_bajada: true,
            velocidad_subida: true,
            tipoPlan: {
              select: {
                tipoServicio: { select: { nombre: true } },
              },
            },
          },
        },
        ciclo: {
          select: {
            nombre: true,
            dia_corte: true,
            dia_vencimiento: true,
          },
        },
      },
      orderBy: { fecha_inicio_contrato: 'desc' },
    });

    return contratos.map((c) => ({
      idContrato: c.id_contrato,
      codigo: c.codigo,
      estado: c.estado,
      fechaInicioContrato: c.fecha_inicio_contrato?.toISOString() || null,
      fechaFinContrato: c.fecha_fin_contrato?.toISOString() || null,
      mesesContrato: c.meses_contrato,
      costoInstalacion: c.costo_instalacion ? Number(c.costo_instalacion) : null,
      plan: {
        nombre: c.plan.nombre,
        precio: Number(c.plan.precio),
        velocidadBajada: c.plan.velocidad_bajada,
        velocidadSubida: c.plan.velocidad_subida,
        tipoServicio: c.plan.tipoPlan.tipoServicio.nombre,
      },
      ciclo: {
        nombre: c.ciclo.nombre,
        diaCorte: c.ciclo.dia_corte,
        diaVencimiento: c.ciclo.dia_vencimiento,
      },
    }));
  }

  async obtenerContratoDetalle(idCliente: number, idContrato: number) {
    const contrato = await this.prisma.atcContrato.findFirst({
      where: {
        id_contrato: idContrato,
        id_cliente: idCliente,
      },
      select: {
        id_contrato: true,
        codigo: true,
        estado: true,
        fecha_venta: true,
        fecha_instalacion: true,
        fecha_inicio_contrato: true,
        fecha_fin_contrato: true,
        meses_contrato: true,
        costo_instalacion: true,
        cliente:{
          select: {
            titular: true,
          }
        },
        plan: {
          select: {
            nombre: true,
            precio: true,
            velocidad_bajada: true,
            velocidad_subida: true,
            tipoPlan: {
              select: {
                nombre: true,
                tipoServicio: { select: { nombre: true } },
              },
            },
          },
        },
        ciclo: {
          select: {
            nombre: true,
            dia_corte: true,
            dia_vencimiento: true,
          },
        },
        instalacion: {
          select: {
            wifi_nombre: true,
            instalado: true,
            fecha_instalacion: true,
          },
        },
        direccionServicio: {
          select: {
            direccion: true,
            colonias: { select: { nombre: true } },
            municipio: { select: { nombre: true } },
            departamento: { select: { nombre: true } },
          },
        },
      },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    return {
      idContrato: contrato.id_contrato,
      codigo: contrato.codigo,
      estado: contrato.estado,
      fechaVenta: contrato.fecha_venta?.toISOString() || null,
      fechaInstalacion: contrato.fecha_instalacion?.toISOString() || null,
      fechaInicioContrato: contrato.fecha_inicio_contrato?.toISOString() || null,
      fechaFinContrato: contrato.fecha_fin_contrato?.toISOString() || null,
      mesesContrato: contrato.meses_contrato,
      costoInstalacion: contrato.costo_instalacion ? Number(contrato.costo_instalacion) : null,
      plan: {
        nombre: contrato.plan.nombre,
        precio: Number(contrato.plan.precio),
        velocidadBajada: contrato.plan.velocidad_bajada,
        velocidadSubida: contrato.plan.velocidad_subida,
        tipoPlan: contrato.plan.tipoPlan.nombre,
        tipoServicio: contrato.plan.tipoPlan.tipoServicio.nombre,
      },
      ciclo: {
        nombre: contrato.ciclo.nombre,
        diaCorte: contrato.ciclo.dia_corte,
        diaVencimiento: contrato.ciclo.dia_vencimiento,
      },
      cliente: {
        titular: contrato.cliente.titular,
      },
      instalacion: contrato.instalacion
        ? {
            wifiNombre: contrato.instalacion.wifi_nombre,
            instalado: contrato.instalacion.instalado,
            fechaInstalacion: contrato.instalacion.fecha_instalacion?.toISOString() || null,
          }
        : null,
      direccionServicio: {
        direccion: contrato.direccionServicio.direccion,
        colonia: contrato.direccionServicio.colonias?.nombre || null,
        municipio: contrato.direccionServicio.municipio?.nombre || null,
        departamento: contrato.direccionServicio.departamento?.nombre || null,
      },
    };
  }

  async obtenerFacturasContrato(idCliente: number, idContrato: number) {
    // Validar que el contrato pertenece al cliente
    const contrato = await this.prisma.atcContrato.findFirst({
      where: {
        id_contrato: idContrato,
        id_cliente: idCliente,
      },
      select: { id_contrato: true },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    const facturas = await this.prisma.facturaDirecta.findMany({
      where: { id_contrato: idContrato },
      include: {
        cuenta_por_cobrar: true,
        tipoFactura: { select: { codigo: true } },
      },
      orderBy: [{ es_instalacion: 'desc' }, { numero_cuota: 'asc' }],
    });

    const ahora = new Date();

    const mapped = facturas.map((f) => {
      const cxc = f.cuenta_por_cobrar;
      const montoAbonado = cxc ? Number(cxc.total_abonado) : 0;
      const saldoPendiente = cxc ? Number(cxc.saldo_pendiente) : Number(f.total);

      let estadoPago: string = f.estado_pago;
      if (
        f.estado_pago === 'PENDIENTE' &&
        f.fecha_vencimiento &&
        f.fecha_vencimiento < ahora
      ) {
        estadoPago = 'VENCIDA';
      }

      return {
        idFactura: f.id_factura_directa,
        numeroCuota: f.numero_cuota,
        totalCuotas: f.total_cuotas,
        periodoInicio: f.periodo_inicio?.toISOString() || null,
        periodoFin: f.periodo_fin?.toISOString() || null,
        fechaVencimiento: f.fecha_vencimiento?.toISOString() || null,
        total: Number(f.total),
        montoMora: Number(f.monto_mora),
        montoAbonado,
        saldoPendiente,
        estadoPago,
        estadoDte: f.estado_dte,
        esInstalacion: f.es_instalacion,
        numeroFactura: f.numero_factura || null,
        estado: f.estado,
      };
    });

    // Filtrar: pagadas + vencidas + próxima pendiente
    const vencidas = mapped.filter((f) => f.estadoPago === 'VENCIDA');
    const pendientes = mapped
      .filter((f) => f.estadoPago === 'PENDIENTE')
      .sort((a, b) => {
        if (!a.fechaVencimiento) return 1;
        if (!b.fechaVencimiento) return -1;
        return new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime();
      });
    const proximaPendiente = pendientes.slice(0, 1);
    const pagadas = mapped.filter(
      (f) => f.estadoPago === 'PAGADO' || f.estadoPago === 'PARCIAL',
    );

    // Orden: vencidas → próxima pendiente → pagadas (más reciente primero)
    return [
      ...vencidas,
      ...proximaPendiente,
      ...pagadas.sort((a, b) => (b.numeroCuota ?? 0) - (a.numeroCuota ?? 0)),
    ];
  }

  async crearPagoIntent(
    idCliente: number,
    idContrato: number,
    dto: CrearPagoIntentDto,
    ipAddress?: string,
  ) {
    // Validate contract belongs to client
    const contrato = await this.prisma.atcContrato.findFirst({
      where: { id_contrato: idContrato, id_cliente: idCliente },
      select: { id_contrato: true },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    // Validate invoice exists and has pending balance
    const cxc = await this.prisma.cuenta_por_cobrar.findFirst({
      where: {
        id_factura_directa: dto.idFactura,
        id_contrato: idContrato,
        estado: { notIn: ['PAGADA_TOTAL', 'ANULADA'] },
      },
    });

    if (!cxc) {
      throw new BadRequestException('No se encontró la factura pendiente de pago');
    }

    const saldoPendiente = Number(cxc.saldo_pendiente);

    if (dto.monto > saldoPendiente) {
      throw new BadRequestException(
        `El monto ($${dto.monto.toFixed(2)}) excede el saldo pendiente ($${saldoPendiente.toFixed(2)})`,
      );
    }

    const montoEsperado = Math.round(dto.monto * 100) / 100;

    // Generate unique token
    const token = randomBytes(32).toString('hex');
    const fechaExpiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.pago_tarjeta_intent.create({
      data: {
        token,
        id_cliente: idCliente,
        id_contrato: idContrato,
        facturas_seleccionadas: [dto.idFactura],
        monto_esperado: montoEsperado,
        fecha_expiracion: fechaExpiracion,
        ip_cliente: ipAddress,
      },
    });

    return {
      token,
      montoEsperado,
      expiraEn: 15,
    };
  }

  async procesarPagoTarjeta(
    idCliente: number,
    idContrato: number,
    dto: PagoTarjetaPortalDto,
    ipAddress?: string,
  ) {
    // 0. Validate payment intent token
    const intent = await this.prisma.pago_tarjeta_intent.findUnique({
      where: { token: dto.tokenPago },
    });

    if (
      !intent ||
      intent.usado ||
      intent.fecha_expiracion < new Date() ||
      intent.id_cliente !== idCliente ||
      intent.id_contrato !== idContrato
    ) {
      throw new BadRequestException('Token de pago inválido o expirado');
    }

    // Validate that invoice ID matches
    const intentFacturas = intent.facturas_seleccionadas;
    if (intentFacturas.length !== 1 || intentFacturas[0] !== dto.idFactura) {
      throw new BadRequestException('Token de pago inválido o expirado');
    }

    // Validate monto matches intent
    if (dto.monto !== Number(intent.monto_esperado)) {
      throw new BadRequestException('Token de pago inválido o expirado');
    }

    // Mark intent as used before processing payment
    await this.prisma.pago_tarjeta_intent.update({
      where: { id_intent: intent.id_intent },
      data: { usado: true },
    });

    // 1. Validate contract belongs to client
    const contrato = await this.prisma.atcContrato.findFirst({
      where: { id_contrato: idContrato, id_cliente: idCliente },
      select: { id_contrato: true, codigo: true },
    });

    if (!contrato) {
      throw new NotFoundException(`Contrato #${idContrato} no encontrado`);
    }

    // 2. Get CxC for selected invoice and validate
    const cxc = await this.prisma.cuenta_por_cobrar.findFirst({
      where: {
        id_factura_directa: dto.idFactura,
        id_contrato: idContrato,
        estado: { notIn: ['PAGADA_TOTAL', 'ANULADA'] },
      },
      include: { facturaDirecta: true },
    });

    if (!cxc) {
      throw new BadRequestException('No se encontró la factura pendiente de pago');
    }

    const saldoPendiente = Number(cxc.saldo_pendiente);

    if (dto.monto > saldoPendiente) {
      throw new BadRequestException(
        `El monto ($${dto.monto.toFixed(2)}) excede el saldo pendiente ($${saldoPendiente.toFixed(2)})`,
      );
    }

    const montoRedondeado = Math.round(dto.monto * 100) / 100;

    const conceptoPago = `Pago contrato ${contrato.codigo} - Factura #${dto.idFactura}`;

    // 4. Call PayWay gateway
    const gwResponse = await this.payWayService.realizarPago({
      nombreTarjetahabiente: dto.nombreTarjetahabiente,
      numeroTarjeta: dto.numeroTarjeta,
      fechaExpiracion: dto.fechaExpiracion,
      cvv2: dto.cvv2,
      monto: montoRedondeado,
      conceptoPago,
      ipCliente: ipAddress,
      usuarioCliente: `CLI-${idCliente}`,
    });

    // 5. Record transaction in audit table (always, success or failure)
    await this.prisma.pago_tarjeta_portal.create({
      data: {
        id_cliente: idCliente,
        id_contrato: idContrato,
        monto: montoRedondeado,
        codigo_retorno: gwResponse.codigoRetorno,
        numero_autorizacion: gwResponse.numeroAutorizacion,
        numero_referencia: gwResponse.numeroReferencia,
        terminacion_tarjeta: gwResponse.terminacionTarjeta,
        fecha_transaccion_gw: gwResponse.fechaTransaccion,
        concepto_pago: conceptoPago,
        exitoso: gwResponse.exitoso,
        mensaje_error: gwResponse.exitoso ? null : gwResponse.mensajeRetorno,
        facturas_seleccionadas: [dto.idFactura],
        ip_cliente: ipAddress,
      },
    });

    // 6. If payment failed, throw error
    if (!gwResponse.exitoso) {
      throw new BadRequestException(
        gwResponse.mensajeRetorno || 'El pago con tarjeta fue rechazado. Verifique los datos e intente de nuevo.',
      );
    }

    // 7. If success, distribute payment using existing logic
    const distribucion = await this.contratoPagosService.registrarPagoContrato(
      idContrato,
      {
        monto: montoRedondeado,
        metodoPago: metodo_pago_abono.TARJETA,
        referencia: gwResponse.numeroAutorizacion,
        observaciones: `Pago con tarjeta portal - Aut: ${gwResponse.numeroAutorizacion}`,
      },
      this.portalSystemUserId,
    );

    // 8. Enviar comprobante de pago por correo (fire-and-forget)
    this.prisma.cliente
      .findUnique({
        where: { id_cliente: idCliente },
        select: { correo_electronico: true, titular: true },
      })
      .then((cliente) => {
        if (cliente?.correo_electronico) {
          this.mailService
            .sendComprobantePago(
              cliente.correo_electronico,
              cliente.titular,
              contrato.codigo,
              montoRedondeado,
              gwResponse.numeroAutorizacion || '',
              gwResponse.terminacionTarjeta || '',
              gwResponse.fechaTransaccion || '',
              dto.idFactura,
              conceptoPago,
            )
            .catch((err) => console.error('Error enviando comprobante de pago:', err));
        }
      })
      .catch((err) => console.error('Error obteniendo cliente para comprobante:', err));

    return {
      exitoso: true,
      mensaje: 'Pago procesado exitosamente',
      numeroAutorizacion: gwResponse.numeroAutorizacion,
      terminacionTarjeta: gwResponse.terminacionTarjeta,
      fechaTransaccion: gwResponse.fechaTransaccion,
      distribucion: {
        items: distribucion.items.map((item) => ({
          idFactura: item.idFactura,
          cuota: item.cuota,
          montoAplicado: item.montoAplicado,
          estadoResultante: item.estadoResultante,
        })),
        montoTotal: distribucion.montoTotal,
        montoDistribuido: distribucion.montoDistribuido,
      },
    };
  }
}
