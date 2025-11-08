// src/modules/inventario/requisiciones/dto/update-requisicion.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateRequisicionDto } from './create-requisicion.dto';

export class UpdateRequisicionDto extends PartialType(CreateRequisicionDto) {}
