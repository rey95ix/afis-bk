// src/modules/atencion-al-cliente/clientes/clientes.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { cliente } from '@prisma/client';
import { PaginationDto, PaginatedResult } from 'src/common/dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createClienteDto: CreateClienteDto, id_usuario: number): Promise<cliente> {
    // Verificar si el DUI ya existe
    const existingCliente = await this.prisma.cliente.findUnique({
      where: { dui: createClienteDto.dui },
    });

    if (existingCliente) {
      throw new ConflictException(`Ya existe un cliente con el DUI ${createClienteDto.dui}`);
    }

    const { fecha_nacimiento, ...rest } = createClienteDto;

    const cliente = await this.prisma.cliente.create({
      data: {
        ...rest,
        id_usuario,
        fecha_nacimiento: new Date(fecha_nacimiento),
      },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'CREAR_CLIENTE',
      id_usuario || id_usuario,
      `Cliente creado: ${cliente.titular} - DUI: ${cliente.dui}`,
    );

    return cliente;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<cliente>> {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Construir el filtro de búsqueda
    const where: any = {
      estado: 'ACTIVO',
    };

    if (search) {
      where.OR = [
        { titular: { contains: search, mode: 'insensitive' } },
        { dui: { contains: search, mode: 'insensitive' } },
        { nit: { contains: search, mode: 'insensitive' } },
        { correo_electronico: { contains: search, mode: 'insensitive' } },
        { telefono1: { contains: search, mode: 'insensitive' } },
        { telefono2: { contains: search, mode: 'insensitive' } },
        { empresa_trabajo: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          usuario: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          direcciones: {
            where: { estado: 'ACTIVO' },
            include: {
              municipio: true,
              departamento: true,
              colonias: true,
            },
          },
          datosfacturacion: {
            where: { estado: 'ACTIVO' },
            include: {
              municipio: true,
              departamento: true,
              dTETipoDocumentoIdentificacion: true,
              dTEActividadEconomica: true,
            },
          },
          documentos: {
            where: { estado: 'ACTIVO' },
            select: {
              id_cliente_documento: true,
              tipo_documento: true,
              nombre_archivo: true,
              fecha_creacion: true,
              ruta_archivo: true,
            },
          },
        },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: number): Promise<cliente> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        direcciones: {
          where: { estado: 'ACTIVO' },
          include: {
            municipio: true,
            departamento: true,
            colonias: true,
          },
        },
        datosfacturacion: {
          where: { estado: 'ACTIVO' },
          include: {
            municipio: true,
            departamento: true,
            dTETipoDocumentoIdentificacion: true,
            dTEActividadEconomica: true,
          },
        },
        documentos: {
          where: { estado: 'ACTIVO' },
          select: {
            id_cliente_documento: true,
            tipo_documento: true,
            nombre_archivo: true,
            fecha_creacion: true,
            ruta_archivo: true,
          },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return cliente;
  }

  async findByDui(dui: string): Promise<cliente | null> {
    return this.prisma.cliente.findUnique({
      where: { dui },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        direcciones: {
          where: { estado: 'ACTIVO' },
        },
        datosfacturacion: {
          where: { estado: 'ACTIVO' },
        },
      },
    });
  }

  async update(
    id: number,
    updateClienteDto: UpdateClienteDto,
    id_usuario: number,
  ): Promise<cliente> {
    await this.findOne(id); // Verificar si existe

    // Si se está actualizando el DUI, verificar que no exista otro cliente con ese DUI
    if (updateClienteDto.dui) {
      const existingCliente = await this.prisma.cliente.findFirst({
        where: {
          dui: updateClienteDto.dui,
          id_cliente: { not: id },
        },
      });

      if (existingCliente) {
        throw new ConflictException(`Ya existe otro cliente con el DUI ${updateClienteDto.dui}`);
      }
    }

    const { fecha_nacimiento, ...rest } = updateClienteDto;

    const cliente = await this.prisma.cliente.update({
      where: { id_cliente: id },
      data: {
        ...rest,
        id_usuario,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : undefined,
      },
      include: {
        usuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ACTUALIZAR_CLIENTE',
      id_usuario,
      `Cliente actualizado: ${cliente.titular} - DUI: ${cliente.dui}`,
    );

    return cliente;
  }

  async remove(id: number, id_usuario: number): Promise<cliente> {
    await this.findOne(id); // Verificar si existe

    const cliente = await this.prisma.cliente.update({
      where: { id_cliente: id },
      data: { estado: 'INACTIVO' },
    });

    // Registrar en el log
    await this.prisma.logAction(
      'ELIMINAR_CLIENTE',
      id_usuario,
      `Cliente eliminado: ${cliente.titular} - DUI: ${cliente.dui}`,
    );

    return cliente;
  }

  async verificarDuiExiste(dui: string, excludeId?: number): Promise<{ existe: boolean; clienteId?: number }> {
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        dui,
        estado: 'ACTIVO',
        ...(excludeId && { id_cliente: { not: excludeId } }),
      },
      select: { id_cliente: true },
    });

    return {
      existe: !!cliente,
      clienteId: cliente?.id_cliente,
    };
  }

  // ==================== BÚSQUEDA DE DUPLICADOS POR RECIBO ====================

  /**
   * Busca clientes que tengan el mismo número de contrato en su recibo
   * @param numeroContrato Número de contrato a buscar
   * @param excludeClienteId ID del cliente a excluir (para edición)
   */
  async buscarClientesPorNumeroContrato(
    numeroContrato: string,
    excludeClienteId?: number,
  ): Promise<{ id_cliente: number; titular: string; dui: string }[]> {
    const documentos = await this.prisma.clienteDocumentos.findMany({
      where: {
        numero_contrato_extraido: numeroContrato,
        tipo_documento: 'RECIBO',
        estado: 'ACTIVO',
        ...(excludeClienteId && { id_cliente: { not: excludeClienteId } }),
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            dui: true,
            estado: true,
          },
        },
      },
    });

    // Filtrar solo clientes activos y eliminar duplicados
    const clientesUnicos = new Map<number, { id_cliente: number; titular: string; dui: string }>();

    documentos.forEach((doc) => {
      if (doc.cliente.estado === 'ACTIVO' && !clientesUnicos.has(doc.cliente.id_cliente)) {
        clientesUnicos.set(doc.cliente.id_cliente, {
          id_cliente: doc.cliente.id_cliente,
          titular: doc.cliente.titular,
          dui: doc.cliente.dui,
        });
      }
    });

    return Array.from(clientesUnicos.values());
  }

  /**
   * Busca clientes que tengan una dirección similar en su recibo
   * @param direccion Dirección a buscar
   * @param excludeClienteId ID del cliente a excluir (para edición)
   */
  async buscarClientesPorDireccionSimilar(
    direccion: string,
    excludeClienteId?: number,
  ): Promise<{ id_cliente: number; titular: string; dui: string; direccion_encontrada: string }[]> {
    // Normalizar la dirección para búsqueda
    const palabrasClave = this.extraerPalabrasClaveDireccion(direccion);

    if (palabrasClave.length === 0) {
      return [];
    }

    // Buscar documentos que contengan alguna de las palabras clave
    const documentos = await this.prisma.clienteDocumentos.findMany({
      where: {
        tipo_documento: 'RECIBO',
        estado: 'ACTIVO',
        direccion_extraida: { not: null },
        ...(excludeClienteId && { id_cliente: { not: excludeClienteId } }),
        OR: palabrasClave.map((palabra) => ({
          direccion_extraida: {
            contains: palabra,
            mode: 'insensitive' as const,
          },
        })),
      },
      include: {
        cliente: {
          select: {
            id_cliente: true,
            titular: true,
            dui: true,
            estado: true,
          },
        },
      },
    });

    // Filtrar solo clientes activos y calcular similitud
    const clientesUnicos = new Map<
      number,
      { id_cliente: number; titular: string; dui: string; direccion_encontrada: string }
    >();

    documentos.forEach((doc) => {
      if (doc.cliente.estado === 'ACTIVO' && doc.direccion_extraida) {
        // Calcular similitud de direcciones
        const similitud = this.calcularSimilitudDireccion(direccion, doc.direccion_extraida);

        // Solo incluir si hay buena similitud (más del 50%)
        if (similitud > 0.5 && !clientesUnicos.has(doc.cliente.id_cliente)) {
          clientesUnicos.set(doc.cliente.id_cliente, {
            id_cliente: doc.cliente.id_cliente,
            titular: doc.cliente.titular,
            dui: doc.cliente.dui,
            direccion_encontrada: doc.direccion_extraida,
          });
        }
      }
    });

    return Array.from(clientesUnicos.values());
  }

  /**
   * Extrae palabras clave de una dirección para búsqueda
   */
  private extraerPalabrasClaveDireccion(direccion: string): string[] {
    // Palabras a ignorar (artículos, preposiciones, etc.)
    const palabrasIgnorar = [
      'de', 'del', 'la', 'el', 'los', 'las', 'en', 'a', 'y', 'o',
      'col', 'colonia', 'calle', 'avenida', 'av', 'pasaje', 'pje',
      'residencial', 'res', 'urbanizacion', 'urb', 'barrio', 'bo',
      'casa', 'local', 'edificio', 'edif', 'nivel', 'piso',
      'san', 'santa', 'norte', 'sur', 'este', 'oeste', 'oriente', 'poniente',
    ];

    // Normalizar y dividir
    const palabras = direccion
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^\w\s]/g, ' ') // Remover puntuación
      .split(/\s+/)
      .filter((p) => p.length > 2 && !palabrasIgnorar.includes(p));

    // Retornar las palabras más significativas (máximo 5)
    return palabras.slice(0, 5);
  }

  /**
   * Calcula la similitud entre dos direcciones (0-1)
   */
  private calcularSimilitudDireccion(dir1: string, dir2: string): number {
    const normalizar = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((p) => p.length > 2);

    const palabras1 = new Set(normalizar(dir1));
    const palabras2 = new Set(normalizar(dir2));

    if (palabras1.size === 0 || palabras2.size === 0) return 0;

    // Contar palabras en común
    let coincidencias = 0;
    palabras1.forEach((p) => {
      if (palabras2.has(p)) coincidencias++;
    });

    // Jaccard similarity
    const union = new Set([...palabras1, ...palabras2]);
    return coincidencias / union.size;
  }
}
