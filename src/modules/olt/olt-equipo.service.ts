import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OltConnectionService } from './olt-connection.service';
import { CreateOltEquipoDto } from './dto/create-olt-equipo.dto';
import { UpdateOltEquipoDto } from './dto/update-olt-equipo.dto';
import { QueryOltEquipoDto } from './dto/query-olt-equipo.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

/**
 * CRUD del recurso `olt_equipo`. Las credenciales SSH vienen en el DTO
 * (`usuario`, `clave`, `puerto`, `prompt_pattern`) y se persisten en la tabla
 * asociada `olt_credencial` (relación 1:1). La clave siempre se encripta
 * antes de guardarse vía `OltConnectionService.encrypt()`.
 *
 * La respuesta del API nunca expone `ssh_password`, sólo un booleano/metadato
 * para que el frontend pueda mostrar "credenciales configuradas".
 */
@Injectable()
export class OltEquipoService {
  private readonly logger = new Logger(OltEquipoService.name);

  // Proyección segura: nunca retornar ssh_usuario ni ssh_password (ambos
  // están encriptados en BD y no deben salir al cliente). El frontend sólo
  // necesita saber que las credenciales existen y el puerto SSH configurado.
  private readonly includeSafe = {
    sucursal: true,
    credencial: {
      select: {
        id_olt_credencial: true,
        ssh_puerto: true,
        prompt_pattern: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    _count: {
      select: { tarjetas: true, comandos: true },
    },
  } satisfies Prisma.olt_equipoInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionService: OltConnectionService,
  ) {}

  async create(dto: CreateOltEquipoDto) {
    const cifrada = this.connectionService.encrypt(dto.clave);
    const usuarioCifrado = this.connectionService.encrypt(dto.usuario);

    try {
      const equipo = await this.prisma.$transaction(async (tx) => {
        const creado = await tx.olt_equipo.create({
          data: {
            nombre: dto.nombre,
            ip_address: dto.ip_address,
            id_sucursal: dto.id_sucursal ?? null,
          },
        });

        await tx.olt_credencial.create({
          data: {
            id_olt_equipo: creado.id_olt_equipo,
            ssh_usuario: usuarioCifrado,
            ssh_password: cifrada,
            ssh_puerto: dto.puerto ?? 22,
            ...(dto.prompt_pattern
              ? { prompt_pattern: dto.prompt_pattern }
              : {}),
          },
        });

        return creado;
      });

      return this.findOne(equipo.id_olt_equipo);
    } catch (err) {
      this.logger.error(
        `Error creando equipo OLT: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }

  async findAll(query: QueryOltEquipoDto): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.olt_equipoWhereInput = {};
    if (query.search) {
      where.OR = [
        { nombre: { contains: query.search, mode: 'insensitive' } },
        { ip_address: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.id_sucursal) {
      where.id_sucursal = query.id_sucursal;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.olt_equipo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id_olt_equipo: 'asc' },
        include: this.includeSafe,
      }),
      this.prisma.olt_equipo.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const equipo = await this.prisma.olt_equipo.findUnique({
      where: { id_olt_equipo: id },
      include: this.includeSafe,
    });

    if (!equipo) {
      throw new NotFoundException(`Equipo OLT ${id} no encontrado`);
    }

    return equipo;
  }

  async update(id: number, dto: UpdateOltEquipoDto) {
    // Asegura que exista antes de tocar nada
    await this.findOne(id);

    const equipoData: Prisma.olt_equipoUpdateInput = {};
    if (dto.nombre !== undefined) equipoData.nombre = dto.nombre;
    if (dto.ip_address !== undefined) equipoData.ip_address = dto.ip_address;
    if (dto.id_sucursal !== undefined) {
      equipoData.sucursal = dto.id_sucursal
        ? { connect: { id_sucursal: dto.id_sucursal } }
        : { disconnect: true };
    }

    const touchingCredencial =
      dto.usuario !== undefined ||
      dto.clave !== undefined ||
      dto.puerto !== undefined ||
      dto.prompt_pattern !== undefined;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(equipoData).length > 0) {
        await tx.olt_equipo.update({
          where: { id_olt_equipo: id },
          data: equipoData,
        });
      }

      if (touchingCredencial) {
        const existente = await tx.olt_credencial.findUnique({
          where: { id_olt_equipo: id },
        });

        if (!existente) {
          // Si no había credencial previa, para crear una necesitamos al menos usuario + clave
          if (dto.usuario === undefined || dto.clave === undefined) {
            throw new BadRequestException(
              'Para crear credenciales por primera vez, usuario y clave son obligatorios',
            );
          }
          await tx.olt_credencial.create({
            data: {
              id_olt_equipo: id,
              ssh_usuario: this.connectionService.encrypt(dto.usuario),
              ssh_password: this.connectionService.encrypt(dto.clave),
              ssh_puerto: dto.puerto ?? 22,
              ...(dto.prompt_pattern
                ? { prompt_pattern: dto.prompt_pattern }
                : {}),
            },
          });
        } else {
          const credData: Prisma.olt_credencialUpdateInput = {};
          if (dto.usuario !== undefined) {
            credData.ssh_usuario = this.connectionService.encrypt(dto.usuario);
          }
          if (dto.clave !== undefined) {
            credData.ssh_password = this.connectionService.encrypt(dto.clave);
          }
          if (dto.puerto !== undefined) credData.ssh_puerto = dto.puerto;
          if (dto.prompt_pattern !== undefined) {
            credData.prompt_pattern = dto.prompt_pattern;
          }
          await tx.olt_credencial.update({
            where: { id_olt_equipo: id },
            data: credData,
          });
        }
      }
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const equipo = await this.prisma.olt_equipo.findUnique({
      where: { id_olt_equipo: id },
      include: {
        _count: { select: { tarjetas: true, comandos: true } },
      },
    });

    if (!equipo) {
      throw new NotFoundException(`Equipo OLT ${id} no encontrado`);
    }

    if (equipo._count.tarjetas > 0 || equipo._count.comandos > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el equipo tiene ${equipo._count.tarjetas} tarjeta(s) y ${equipo._count.comandos} comando(s) asociado(s)`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.olt_credencial.deleteMany({ where: { id_olt_equipo: id } });
      await tx.olt_equipo.delete({ where: { id_olt_equipo: id } });
    });

    return { success: true, message: `Equipo OLT ${id} eliminado` };
  }

  /**
   * Valida que las credenciales SSH almacenadas permiten conectarse al equipo.
   * Ejecuta un comando trivial (`display version`) vía el canal SSH existente.
   */
  async testConnection(id: number) {
    await this.findOne(id);
    const result = await this.connectionService.executeCommand(
      id,
      'enable\ndisplay version\n',
    );
    return {
      success: result.success,
      error: result.error,
      output: result.output?.slice(0, 500),
    };
  }
}
