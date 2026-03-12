import { PartialType } from '@nestjs/swagger';
import { CreatePuntoxpressIntegradorDto } from './create-puntoxpress-integrador.dto';

export class UpdatePuntoxpressIntegradorDto extends PartialType(CreatePuntoxpressIntegradorDto) {}
