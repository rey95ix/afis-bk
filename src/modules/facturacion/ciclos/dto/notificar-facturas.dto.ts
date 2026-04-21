import { IsIn, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type CanalNotificacion = 'email' | 'whatsapp';

export class NotificarFacturasDto {
  @ApiProperty({ minimum: 1, maximum: 12, example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @ApiProperty({ minimum: 2020, maximum: 2100, example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  anio: number;

  @ApiPropertyOptional({
    description:
      'Si se envia, solo se notifican las facturas del cliente indicado (notificacion individual).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_cliente?: number;

  @ApiPropertyOptional({
    enum: ['email', 'whatsapp'],
    default: 'email',
    description:
      'Canal por el cual se enviaran las notificaciones. Por defecto email.',
  })
  @IsOptional()
  @IsIn(['email', 'whatsapp'])
  canal?: CanalNotificacion;
}

export interface NotificarFacturasErrorItem {
  id_factura: number;
  numero_control: string | null;
  cliente: string;
  correo: string | null;
  telefono: string | null;
  error: string;
}

export interface NotificarFacturasResultado {
  total: number;
  enviados: number;
  fallidos: number;
  errores: NotificarFacturasErrorItem[];
}

export type NotificacionJobEstado =
  | 'EN_PROGRESO'
  | 'COMPLETADO'
  | 'ERROR';

export interface NotificacionJobInicioResponse {
  jobId: string;
  total: number;
}

export interface NotificacionJob {
  id: string;
  id_ciclo: number;
  mes: number;
  anio: number;
  id_cliente?: number;
  canal: CanalNotificacion;
  total: number;
  procesados: number;
  enviados: number;
  fallidos: number;
  estado: NotificacionJobEstado;
  errores: NotificarFacturasErrorItem[];
  mensaje: string;
  iniciado_en: string;
  finalizado_en: string | null;
  actualizado_en: string;
}
