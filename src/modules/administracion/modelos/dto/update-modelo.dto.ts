// src/modules/administracion/modelos/dto/update-modelo.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateModeloDto } from './create-modelo.dto';

export class UpdateModeloDto extends PartialType(CreateModeloDto) {}
