import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateIaRuleDto } from './create-ia-rule.dto';

export class UpdateIaRuleDto extends PartialType(
  OmitType(CreateIaRuleDto, ['id_config'] as const),
) {}
