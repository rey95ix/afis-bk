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
 * DTO para anular un cobro/factura (DTE)
 */
export class AnularCobroDto {
  @ApiProperty({ description: 'ID del DTE a anular' })
  @IsInt()
  idDte: number;

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

  // === DATOS DEL RESPONSABLE (quien autoriza la anulación) ===

  @ApiProperty({ description: 'Nombre del responsable que autoriza la anulación' })
  @IsString()
  @MaxLength(200)
  nombreResponsable: string;

  @ApiProperty({ description: 'Tipo de documento del responsable (36=NIT, 13=DUI, etc.)' })
  @IsString()
  @MaxLength(2)
  tipoDocResponsable: string;

  @ApiProperty({ description: 'Número de documento del responsable' })
  @IsString()
  @MaxLength(25)
  numDocResponsable: string;

  // === DATOS DEL SOLICITANTE (quien solicita la anulación, puede ser el receptor) ===

  @ApiProperty({ description: 'Nombre de quien solicita la anulación' })
  @IsString()
  @MaxLength(200)
  nombreSolicita: string;

  @ApiProperty({ description: 'Tipo de documento del solicitante' })
  @IsString()
  @MaxLength(2)
  tipoDocSolicita: string;

  @ApiProperty({ description: 'Número de documento del solicitante' })
  @IsString()
  @MaxLength(25)
  numDocSolicita: string;

  // === DOCUMENTO DE REEMPLAZO (solo si tipoAnulacion=1) ===

  @ApiPropertyOptional({
    description: 'UUID del DTE de reemplazo (requerido si tipoAnulacion=1)',
  })
  @IsOptional()
  @IsUUID(4)
  codigoGeneracionReemplazo?: string;
}
