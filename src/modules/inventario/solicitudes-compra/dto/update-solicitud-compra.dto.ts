import { PartialType } from '@nestjs/swagger';
import { CreateSolicitudCompraDto } from './create-solicitud-compra.dto';

export class UpdateSolicitudCompraDto extends PartialType(CreateSolicitudCompraDto) {}
