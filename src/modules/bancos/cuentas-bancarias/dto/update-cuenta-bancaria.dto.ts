import { PartialType } from '@nestjs/swagger';
import { CreateCuentaBancariaDto } from './create-cuenta-bancaria.dto';

export class UpdateCuentaBancariaDto extends PartialType(CreateCuentaBancariaDto) {}
