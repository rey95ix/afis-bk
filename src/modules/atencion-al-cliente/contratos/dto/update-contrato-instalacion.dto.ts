// src/modules/atencion-al-cliente/contratos/dto/update-contrato-instalacion.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateContratoInstalacionDto } from './create-contrato-instalacion.dto';

export class UpdateContratoInstalacionDto extends PartialType(
  OmitType(CreateContratoInstalacionDto, ['id_contrato'] as const),
) {}
