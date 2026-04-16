import { PartialType } from '@nestjs/swagger';
import { CreateOltEquipoDto } from './create-olt-equipo.dto';

/**
 * DTO de actualización: todos los campos son opcionales. Permite actualizar
 * sólo metadatos del equipo, sólo credenciales SSH, o ambos.
 */
export class UpdateOltEquipoDto extends PartialType(CreateOltEquipoDto) {}
