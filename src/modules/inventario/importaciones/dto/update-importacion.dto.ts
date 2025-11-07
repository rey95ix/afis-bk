// src/modules/inventario/importaciones/dto/update-importacion.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateImportacionDto } from './create-importacion.dto';

export class UpdateImportacionDto extends PartialType(CreateImportacionDto) {}
