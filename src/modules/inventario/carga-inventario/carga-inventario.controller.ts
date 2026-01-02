import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { CargaInventarioService } from './carga-inventario.service';
import { UploadInventarioDto } from './dto/upload-inventario.dto';
import {
  ResultadoCargaDto,
  ValidacionExcelDto,
} from './dto/resultado-carga.dto';

@ApiTags('Inventario - Carga Masiva')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/carga-inventario')
@Auth()
export class CargaInventarioController {
  constructor(
    private readonly cargaInventarioService: CargaInventarioService,
  ) {}

  @Post('upload')
  @RequirePermissions('inventario.items:cargar_excel')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        if (!allowedMimes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Solo se permiten archivos Excel (.xlsx, .xls)',
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ApiOperation({
    summary: 'Cargar inventario desde archivo Excel',
    description: `Procesa un archivo Excel con columnas: Marca, Modelo, Descripción, Cantidad.

**Comportamiento:**
- Si la marca no existe, se crea automáticamente
- Si el modelo no existe, se crea automáticamente vinculado a la marca
- Si el modelo está vacío, se usa/crea "N/A"
- Si ya existe inventario para (catálogo, bodega, estante), se ACTUALIZA la cantidad
- Si no existe, se CREA el registro

**Respuesta:** Reporte detallado de items procesados, creados y actualizados.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo', 'id_bodega', 'id_categoria'],
      properties: {
        archivo: {
          type: 'string',
          format: 'binary',
          description: 'Archivo Excel (.xlsx)',
        },
        id_bodega: {
          type: 'integer',
          description: 'ID de la bodega destino',
        },
        id_estante: {
          type: 'integer',
          description: 'ID del estante (opcional)',
        },
        id_categoria: {
          type: 'integer',
          description: 'ID de la categoría por defecto para nuevos productos',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Archivo procesado exitosamente',
    type: ResultadoCargaDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo inválido o error de validación',
  })
  async uploadInventario(
    @UploadedFile() archivo: Express.Multer.File,
    @Body() dto: UploadInventarioDto,
    @GetUser('id_usuario') id_usuario: number,
  ): Promise<ResultadoCargaDto> {
    if (!archivo) {
      throw new BadRequestException('El archivo Excel es requerido');
    }

    return this.cargaInventarioService.procesarExcel(
      archivo,
      dto,
      id_usuario,
    );
  }

  @Get('plantilla')
  @RequirePermissions('inventario.items:ver')
  @ApiOperation({
    summary: 'Descargar plantilla Excel',
    description:
      'Descarga una plantilla Excel con el formato correcto para la carga de inventario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo de plantilla Excel',
  })
  async descargarPlantilla(@Res() res: Response): Promise<void> {
    const buffer = await this.cargaInventarioService.generarPlantilla();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="plantilla_carga_inventario.xlsx"',
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post('validar')
  @RequirePermissions('inventario.items:ver')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        if (!allowedMimes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Solo se permiten archivos Excel (.xlsx, .xls)',
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  @ApiOperation({
    summary: 'Validar archivo Excel sin procesar',
    description:
      'Valida el formato y contenido del archivo Excel sin realizar cambios en la base de datos.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: {
          type: 'string',
          format: 'binary',
          description: 'Archivo Excel (.xlsx)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Validación completada',
    type: ValidacionExcelDto,
  })
  async validarArchivo(
    @UploadedFile() archivo: Express.Multer.File,
  ): Promise<ValidacionExcelDto> {
    if (!archivo) {
      throw new BadRequestException('El archivo Excel es requerido');
    }

    return this.cargaInventarioService.validarExcel(archivo.buffer);
  }
}
