// src/modules/administracion/marcas/dto/update-marca.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateMarcaDto } from './create-marca.dto';

export class UpdateMarcaDto extends PartialType(CreateMarcaDto) {}
