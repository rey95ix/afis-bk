// src/modules/inventario/proveedores/dto/update-proveedor.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateProveedorDto } from './create-proveedor.dto';

export class UpdateProveedorDto extends PartialType(CreateProveedorDto) {}
