// src/modules/inventario/sucursales/dto/update-sucursal.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateSucursalDto } from './create-sucursal.dto';

export class UpdateSucursalDto extends PartialType(CreateSucursalDto) {}
