// src/modules/atencion-al-cliente/clientes/dto/update-cliente.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateClienteDto } from './create-cliente.dto';

export class UpdateClienteDto extends PartialType(CreateClienteDto) {}
