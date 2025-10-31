// src/modules/atencion-al-cliente/clientes/dto/update-cliente-direccion.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateClienteDireccionDto } from './create-cliente-direccion.dto';

export class UpdateClienteDireccionDto extends PartialType(CreateClienteDireccionDto) {}
