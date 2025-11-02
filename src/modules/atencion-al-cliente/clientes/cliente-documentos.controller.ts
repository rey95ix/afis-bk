// src/modules/atencion-al-cliente/clientes/cliente-documentos.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { ClienteDocumentosService } from './cliente-documentos.service';
import { memoryStorage } from 'multer';

@ApiTags('Cliente Documentos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('atencion-al-cliente/clientes/documentos')
@Auth()
export class ClienteDocumentosController {
  constructor(
    private readonly clienteDocumentosService: ClienteDocumentosService,
  ) {}

  @Post('upload/:id_cliente')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'dui_frente', maxCount: 1 },
        { name: 'dui_trasera', maxCount: 1 },
        { name: 'nit_frente', maxCount: 1 },
        { name: 'nit_trasera', maxCount: 1 },
        { name: 'recibo', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        fileFilter: (req, file, callback) => {
          if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
            return callback(
              new BadRequestException('Solo se permiten imágenes (JPG, PNG, WEBP)'),
              false,
            );
          }
          callback(null, true);
        },
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB
        },
      },
    ),
  )
  @ApiOperation({ summary: 'Subir documentos del cliente' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Documentos subidos exitosamente.' })
  @ApiResponse({ status: 400, description: 'Archivos inválidos o cliente no encontrado.' })
  async uploadDocumentos(
    @Param('id_cliente', ParseIntPipe) id_cliente: number,
    @UploadedFiles()
    files: {
      dui_frente?: Express.Multer.File[];
      dui_trasera?: Express.Multer.File[];
      nit_frente?: Express.Multer.File[];
      nit_trasera?: Express.Multer.File[];
      recibo?: Express.Multer.File[];
    },
    @GetUser() usuario,
  ) {
    // Validar que al menos DUI frente y trasera estén presentes
    if (!files.dui_frente || !files.dui_trasera) {
      throw new BadRequestException('Las fotos del DUI (frente y trasera) son requeridas');
    }

    return this.clienteDocumentosService.uploadDocumentos(
      id_cliente,
      files,
      usuario.id_usuario,
    );
  }

  @Get(':id_cliente')
  @ApiOperation({ summary: 'Obtener todos los documentos de un cliente' })
  @ApiResponse({ status: 200, description: 'Retorna los documentos del cliente.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  getDocumentos(@Param('id_cliente', ParseIntPipe) id_cliente: number) {
    return this.clienteDocumentosService.getDocumentosByCliente(id_cliente);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Descargar un documento específico' })
  @ApiResponse({ status: 200, description: 'Descarga el documento.' })
  @ApiResponse({ status: 404, description: 'Documento no encontrado.' })
  async downloadDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, documento } = await this.clienteDocumentosService.downloadDocumento(id);

    res.set({
      'Content-Type': documento.mimetype,
      'Content-Disposition': `attachment; filename="${documento.nombre_archivo}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un documento' })
  @ApiResponse({ status: 200, description: 'Documento eliminado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Documento no encontrado.' })
  deleteDocumento(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() usuario,
  ) {
    return this.clienteDocumentosService.deleteDocumento(id, usuario.id_usuario);
  }
}
