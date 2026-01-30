import {
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para anular una factura directa (DTE)
 *
 * Los datos del responsable se obtienen automáticamente de GeneralData (empresa)
 * Los datos del solicitante se obtienen del usuario logueado
 */
export class AnularFacturaDirectaDto {
  @ApiProperty({
    description: 'Tipo de anulación: 1=Error en información, 2=Rescindir operación, 3=Otro',
    enum: [1, 2, 3],
  })
  @IsInt()
  @IsEnum([1, 2, 3])
  tipoAnulacion: 1 | 2 | 3;

  @ApiPropertyOptional({
    description: 'Motivo de la anulación (requerido si tipoAnulacion=3)',
    maxLength: 250,
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  motivoAnulacion?: string;

  @ApiPropertyOptional({
    description: 'UUID del DTE de reemplazo (requerido si tipoAnulacion=1)',
  })
  @IsOptional()
  @IsUUID(4)
  codigoGeneracionReemplazo?: string;
}
