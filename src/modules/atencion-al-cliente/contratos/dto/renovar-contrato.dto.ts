import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class RenovarContratoDto {
  @ApiProperty({
    description: 'ID del plan contratado',
    example: 1,
  })
  @IsInt()
  id_plan: number;

  @ApiProperty({
    description: 'ID del ciclo de facturación',
    example: 1,
  })
  @IsInt()
  id_ciclo: number;

  @ApiProperty({
    description: 'ID de la dirección donde se prestará el servicio',
    example: 1,
  })
  @IsInt()
  id_direccion_servicio: number;

  @ApiProperty({
    description: 'Duración del contrato en meses',
    example: 12,
    default: 12,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  meses_contrato?: number;

  @ApiProperty({
    description: 'Costo de instalación del servicio',
    example: 25,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  costo_instalacion?: number;

  @ApiProperty({
    description: 'Si es true, se crea factura separada de instalación. Si es false, el costo se incluye en la primera factura del servicio.',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  facturar_instalacion_separada?: boolean;

  @ApiProperty({
    description: 'Motivo o comentario de la renovación',
    example: 'Cliente desea mejorar plan de servicio',
    required: false,
  })
  @IsOptional()
  @IsString()
  comentario?: string;
}
