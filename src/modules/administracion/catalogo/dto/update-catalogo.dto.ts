// src/modules/administracion/catalogo/dto/update-catalogo.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCatalogoDto } from './create-catalogo.dto';

export class UpdateCatalogoDto extends PartialType(CreateCatalogoDto) {}
