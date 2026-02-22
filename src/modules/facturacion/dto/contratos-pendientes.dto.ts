import { IsOptional, IsInt, IsString, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Estados de contrato que pueden facturarse
 */
export type EstadoContratoFacturable = 'INSTALADO_ACTIVO' | 'EN_MORA' | 'VELOCIDAD_REDUCIDA';

/**
 * DTO para filtrar contratos pendientes de cobro
 */
export class ContratosPendientesDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items por página', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre de cliente o número de contrato' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del contrato',
    enum: ['INSTALADO_ACTIVO', 'EN_MORA', 'VELOCIDAD_REDUCIDA'],
  })
  @IsOptional()
  @IsEnum(['INSTALADO_ACTIVO', 'EN_MORA', 'VELOCIDAD_REDUCIDA'])
  estado?: EstadoContratoFacturable;
}

/**
 * Información de mora para un contrato
 */
export interface MoraInfo {
  aplica: boolean;
  monto: number;
  diasAtraso: number;
}

/**
 * Información del cliente en respuesta
 */
export interface ClienteInfo {
  id: number;
  nombre: string;
  dui: string | null;
  nit: string | null;
  correo: string | null;
}

/**
 * Información del plan en respuesta
 */
export interface PlanInfo {
  id: number;
  nombre: string;
  precio: number;
}

/**
 * Contrato pendiente de cobro
 */
export interface ContratoPendiente {
  idContrato: number;
  numeroContrato: string;
  cliente: ClienteInfo;
  plan: PlanInfo;
  estado: string;
  periodoActual: string;
  montoBase: number;
  mora: MoraInfo;
  totalPagar: number;
}

/**
 * Respuesta paginada de contratos pendientes
 */
export interface ContratosPendientesResponse {
  data: ContratoPendiente[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
