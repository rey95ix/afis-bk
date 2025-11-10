// src/modules/inventario/estantes/dto/update-estante.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateEstanteDto } from './create-estante.dto';

export class UpdateEstanteDto extends PartialType(CreateEstanteDto) {}
