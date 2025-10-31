// src/modules/atencion-al-cliente/clientes/dto/update-cliente-datos-facturacion.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateClienteDatosFacturacionDto } from './create-cliente-datos-facturacion.dto';

export class UpdateClienteDatosFacturacionDto extends PartialType(CreateClienteDatosFacturacionDto) {}
