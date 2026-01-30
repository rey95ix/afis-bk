import { PartialType } from '@nestjs/swagger';
import { CreateClienteDirectoDto } from './create-cliente-directo.dto';

/**
 * DTO para actualizar un cliente directo
 * Todos los campos son opcionales
 */
export class UpdateClienteDirectoDto extends PartialType(CreateClienteDirectoDto) {}
