// src/modules/atencion-al-cliente/clientes/dto/upload-documentos-cliente.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class UploadDocumentosClienteDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  id_cliente: number;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto del DUI (frente)',
    required: true,
  })
  dui_frente?: Express.Multer.File;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto del DUI (trasera)',
    required: true,
  })
  dui_trasera?: Express.Multer.File;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto del NIT (frente)',
    required: false,
  })
  nit_frente?: Express.Multer.File;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto del NIT (trasera)',
    required: false,
  })
  nit_trasera?: Express.Multer.File;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto del recibo de servicio',
    required: false,
  })
  recibo?: Express.Multer.File;
}
