
import { estado_importacion } from '@prisma/client';

export interface EstadoContador {
  estado: estado_importacion;
  cantidad: number;
}
