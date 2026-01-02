import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadInventarioDto } from './dto/upload-inventario.dto';
import {
  ResultadoCargaDto,
  ItemResultadoDto,
  ValidacionExcelDto,
} from './dto/resultado-carga.dto';

interface ItemExcelRaw {
  marca: string | null;
  modelo: string | null;
  descripcion: string | null;
  cantidad: number;
  fila: number;
}

@Injectable()
export class CargaInventarioService {
  constructor(private readonly prisma: PrismaService) {}

  async procesarExcel(
    file: Express.Multer.File,
    dto: UploadInventarioDto,
    userId: number,
  ): Promise<ResultadoCargaDto> {
    // 1. Validar bodega
    const bodega = await this.prisma.bodegas.findFirst({
      where: {
        id_bodega: dto.id_bodega,
        estado: 'ACTIVO',
      },
    });

    if (!bodega) {
      throw new NotFoundException(
        `Bodega con ID ${dto.id_bodega} no encontrada o inactiva.`,
      );
    }

    // 2. Validar/obtener estante
    let idEstante: number | null = null;
    if (dto.id_estante) {
      const estante = await this.prisma.estantes.findFirst({
        where: {
          id_estante: dto.id_estante,
          id_bodega: dto.id_bodega,
          estado: 'ACTIVO',
        },
      });
      if (!estante) {
        throw new NotFoundException(
          `Estante con ID ${dto.id_estante} no pertenece a la bodega o está inactivo.`,
        );
      }
      idEstante = estante.id_estante;
    }

    // 3. Validar categoría
    const categoria = await this.prisma.categorias.findFirst({
      where: {
        id_categoria: dto.id_categoria,
        estado: 'ACTIVO',
      },
    });

    if (!categoria) {
      throw new NotFoundException(
        `Categoría con ID ${dto.id_categoria} no encontrada o inactiva.`,
      );
    }

    // 4. Leer Excel
    const items = await this.leerExcel(file.buffer);
    console.log(items)
    if (items.length === 0) {
      throw new BadRequestException(
        'El archivo Excel está vacío o solo contiene encabezados.',
      );
    }

    // 5. Procesar cada fila en su propia transacción
    const resultado: ResultadoCargaDto = {
      success: true,
      total_filas: items.length,
      filas_procesadas: 0,
      filas_creadas: 0,
      filas_actualizadas: 0,
      filas_error: 0,
      marcas_creadas: 0,
      modelos_creados: 0,
      catalogos_creados: 0,
      detalle: [],
      errores: [],
    };

    // Procesar cada fila en su propia transacción para permitir fallos parciales
    for (const item of items) {
      try {
        const itemResultado = await this.prisma.$transaction(
          async (prisma) => {
            return await this.procesarItem(
              prisma,
              item,
              dto.id_bodega,
              idEstante,
              dto.id_categoria,
              userId,
            );
          },
          {
            maxWait: 10000,
            timeout: 30000,
          },
        );

        resultado.detalle.push(itemResultado);
        resultado.filas_procesadas++;

        if (itemResultado.estado === 'CREADO') {
          resultado.filas_creadas++;
        } else if (itemResultado.estado === 'ACTUALIZADO') {
          resultado.filas_actualizadas++;
        }

        if (itemResultado.marca_creada) resultado.marcas_creadas++;
        if (itemResultado.modelo_creado) resultado.modelos_creados++;
        if (itemResultado.catalogo_creado) resultado.catalogos_creados++;
      } catch (error) {
        resultado.filas_error++;
        resultado.errores?.push(`Fila ${item.fila}: ${error.message}`);
        resultado.detalle.push({
          fila: item.fila,
          marca: item.marca || '',
          modelo: item.modelo || '',
          descripcion: item.descripcion || '',
          cantidad: item.cantidad,
          estado: 'ERROR',
          mensaje: error.message,
        });
      }
    }

    // 6. Registrar en log
    await this.prisma.log.create({
      data: {
        accion: 'CARGA_INVENTARIO_EXCEL',
        descripcion: `Carga masiva desde Excel: ${resultado.filas_procesadas} procesadas, ${resultado.filas_creadas} creadas, ${resultado.filas_actualizadas} actualizadas, ${resultado.filas_error} errores`,
        id_usuario: userId,
      },
    });

    resultado.success = resultado.filas_error === 0;
    return resultado;
  }

  private async procesarItem(
    prisma: any,
    item: ItemExcelRaw,
    idBodega: number,
    idEstante: number | null,
    idCategoriaDefault: number,
    userId: number,
  ): Promise<ItemResultadoDto> {
    // 1. Normalizar y sanitizar marca (vacía = "N/A")
    const nombreMarca = this.sanitizarTexto(item.marca, 'N/A');

    // 2. Buscar o crear marca
    const { marca, creada: marcaCreada } = await this.buscarOCrearMarca(
      prisma,
      nombreMarca,
    );

    // 3. Normalizar y sanitizar modelo (vacío = "N/A")
    const nombreModelo = this.sanitizarTexto(item.modelo, 'N/A');

    // 4. Buscar o crear modelo (vinculado a la marca)
    const { modelo, creado: modeloCreado } = await this.buscarOCrearModelo(
      prisma,
      nombreModelo,
      marca.id_marca,
    );

    // 5. Buscar o crear catálogo
    const descripcion = this.sanitizarTexto(
      item.descripcion,
      `${nombreMarca} ${nombreModelo}`,
      200,
    );
    const { catalogo, creado: catalogoCreado } = await this.buscarOCrearCatalogo(
      prisma,
      descripcion,
      marca.id_marca,
      modelo.id_modelo,
      idCategoriaDefault,
    );

    // 6. Buscar inventario existente por (id_catalogo, id_bodega, id_estante)
    const inventarioExistente = await prisma.inventario.findFirst({
      where: {
        id_catalogo: catalogo.id_catalogo,
        id_bodega: idBodega,
        id_estante: idEstante,
      },
    });

    let esCreado = false;

    if (inventarioExistente) {
      // ACTUALIZAR cantidad
      await prisma.inventario.update({
        where: { id_inventario: inventarioExistente.id_inventario },
        data: {
          cantidad_disponible: {
            increment: item.cantidad,
          },
        },
      });
    } else {
      // CREAR nuevo registro
      await prisma.inventario.create({
        data: {
          id_catalogo: catalogo.id_catalogo,
          id_bodega: idBodega,
          id_estante: idEstante,
          cantidad_disponible: item.cantidad,
          cantidad_reservada: 0,
        },
      });
      esCreado = true;
    }

    // 7. Registrar movimiento de inventario
    await prisma.movimientos_inventario.create({
      data: {
        tipo: 'ENTRADA_CARGA_EXCEL',
        id_catalogo: catalogo.id_catalogo,
        id_bodega_destino: idBodega,
        cantidad: item.cantidad,
        id_usuario: userId,
        observaciones: `Carga masiva desde Excel - Fila ${item.fila}`,
      },
    });

    return {
      fila: item.fila,
      marca: nombreMarca,
      modelo: nombreModelo,
      descripcion: descripcion,
      cantidad: item.cantidad,
      estado: esCreado ? 'CREADO' : 'ACTUALIZADO',
      marca_creada: marcaCreada,
      modelo_creado: modeloCreado,
      catalogo_creado: catalogoCreado,
    };
  }

  private async leerExcel(buffer: Buffer): Promise<ItemExcelRaw[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException(
        'El archivo Excel no contiene hojas de cálculo.',
      );
    }

    const items: ItemExcelRaw[] = [];

    // Asumimos fila 1 = encabezados, datos desde fila 2 
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Saltar encabezados
      console.log(row.values);
      const marca = this.getCellText(row.getCell(1));
      const modelo = this.getCellText(row.getCell(2));
      const descripcion = this.getCellText(row.getCell(3));
      const cantidadRaw = row.getCell(4).value; 

      const cantidad =
        typeof cantidadRaw === 'number'
          ? Math.floor(cantidadRaw)
          : parseInt(String(cantidadRaw), 10);

      // Validar cantidad
      if (isNaN(cantidad) || cantidad <= 0) {
        // Omitir filas sin cantidad válida (filas vacías)
        return;
      }

      // Validar límite máximo
      if (cantidad > 1000000) {
        throw new BadRequestException(
          `Fila ${rowNumber}: Cantidad excede el límite máximo permitido (1,000,000).`,
        );
      }

      items.push({
        marca,
        modelo,
        descripcion,
        cantidad,
        fila: rowNumber,
      });
    });

    return items;
  }

  private getCellText(cell: ExcelJS.Cell): string | null {
    if (cell.value === null || cell.value === undefined) {
      return null;
    }
    if (typeof cell.value === 'object' && 'text' in cell.value) {
      return (cell.value as any).text?.trim() || null;
    }
    return String(cell.value).trim() || null;
  }

  private sanitizarTexto(
    texto: string | null,
    valorDefault: string,
    maxLength: number = 100,
  ): string {
    if (!texto?.trim()) return valorDefault;

    return texto
      .trim()
      .replace(/[<>"'&\\]/g, '') // Eliminar caracteres peligrosos
      .substring(0, maxLength)
      .toUpperCase();
  }

  private async buscarOCrearMarca(
    prisma: any,
    nombre: string,
  ): Promise<{ marca: any; creada: boolean }> {
    let marca = await prisma.marcas.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        estado: 'ACTIVO',
      },
    });

    if (!marca) {
      marca = await prisma.marcas.create({
        data: {
          nombre: nombre,
          estado: 'ACTIVO',
        },
      });
      return { marca, creada: true };
    }

    return { marca, creada: false };
  }

  private async buscarOCrearModelo(
    prisma: any,
    nombre: string,
    idMarca: number,
  ): Promise<{ modelo: any; creado: boolean }> {
    let modelo = await prisma.modelos.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        id_marca: idMarca,
        estado: 'ACTIVO',
      },
    });

    if (!modelo) {
      modelo = await prisma.modelos.create({
        data: {
          nombre: nombre,
          id_marca: idMarca,
          estado: 'ACTIVO',
        },
      });
      return { modelo, creado: true };
    }

    return { modelo, creado: false };
  }

  private async buscarOCrearCatalogo(
    prisma: any,
    nombre: string,
    idMarca: number,
    idModelo: number,
    idCategoria: number,
  ): Promise<{ catalogo: any; creado: boolean }> {
    // Buscar por nombre + marca + modelo
    let catalogo = await prisma.catalogo.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        id_marca: idMarca,
        id_modelo: idModelo,
        estado: 'ACTIVO',
      },
    });

    if (!catalogo) {
      // Generar código automático basado en la categoría
      const codigo = await this.generarCodigoCatalogo(prisma, idCategoria);

      catalogo = await prisma.catalogo.create({
        data: {
          codigo: codigo,
          nombre: nombre,
          id_categoria: idCategoria,
          id_marca: idMarca,
          id_modelo: idModelo,
          estado: 'ACTIVO',
        },
      });
      return { catalogo, creado: true };
    }

    return { catalogo, creado: false };
  }

  private async generarCodigoCatalogo(
    prisma: any,
    idCategoria: number,
  ): Promise<string> {
    // Obtener la categoría y su padre
    const categoria = await prisma.categorias.findUnique({
      where: { id_categoria: idCategoria },
      include: { categoria_padre: true },
    });

    let prefix = 'XX';
    if (categoria?.categoria_padre) {
      prefix = `${categoria.categoria_padre.codigo}${categoria.codigo}`;
    } else if (categoria) {
      prefix = categoria.codigo;
    }

    // Encontrar el último código con ese prefijo
    const lastCatalogo = await prisma.catalogo.findFirst({
      where: { codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
    });

    let nextNumber = 1;
    if (lastCatalogo) {
      const lastPart = lastCatalogo.codigo.substring(prefix.length);
      const lastNum = parseInt(lastPart, 10);
      if (!isNaN(lastNum)) nextNumber = lastNum + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  async validarExcel(buffer: Buffer): Promise<ValidacionExcelDto> {
    const resultado: ValidacionExcelDto = {
      valido: true,
      total_filas: 0,
      preview: [],
      errores: [],
    };

    try {
      const items = await this.leerExcel(buffer);
      resultado.total_filas = items.length;

      if (items.length === 0) {
        resultado.valido = false;
        resultado.errores.push(
          'El archivo está vacío o solo contiene encabezados.',
        );
        return resultado;
      }

      // Preview de las primeras 10 filas
      resultado.preview = items.slice(0, 10).map((item) => ({
        fila: item.fila,
        marca: item.marca || '',
        modelo: item.modelo || '',
        descripcion: item.descripcion || '',
        cantidad: item.cantidad,
      }));

      // Validar datos
      for (const item of items) {
        if (item.cantidad <= 0) {
          resultado.errores.push(
            `Fila ${item.fila}: Cantidad inválida (${item.cantidad})`,
          );
        }
      }

      if (resultado.errores.length > 0) {
        resultado.valido = false;
      }
    } catch (error) {
      resultado.valido = false;
      resultado.errores.push(`Error al leer el archivo: ${error.message}`);
    }

    return resultado;
  }

  async generarPlantilla(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario');

    // Configurar columnas
    sheet.columns = [
      { header: 'Marca', key: 'marca', width: 20 },
      { header: 'Modelo', key: 'modelo', width: 25 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
    ];

    // Estilo de encabezados
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Agregar fila de ejemplo
    sheet.addRow({
      marca: 'TP-LINK',
      modelo: 'ARCHER C6',
      descripcion: 'Router WiFi AC1200 Dual Band',
      cantidad: 10,
    });

    sheet.addRow({
      marca: 'UBIQUITI',
      modelo: 'UAP-AC-LR',
      descripcion: 'Access Point UniFi Long Range',
      cantidad: 5,
    });

    // Agregar bordes a las celdas de datos
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
