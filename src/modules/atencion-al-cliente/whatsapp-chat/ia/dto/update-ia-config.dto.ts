import { PartialType } from '@nestjs/swagger';
import { CreateIaConfigDto } from './create-ia-config.dto';

export class UpdateIaConfigDto extends PartialType(CreateIaConfigDto) {}
