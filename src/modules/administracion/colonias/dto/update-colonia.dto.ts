// src/modules/administracion/colonias/dto/update-colonia.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateColoniaDto } from './create-colonia.dto';

export class UpdateColoniaDto extends PartialType(CreateColoniaDto) {}
