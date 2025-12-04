// src/modules/facturacion/ciclos/dto/create-ciclo.dto.ts
import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCicloDto {
  @ApiProperty({
    description: 'Nombre descriptivo del ciclo',
    example: 'Ciclo 1 - día 3 de cada mes',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Día del mes para generar factura (1-31)',
    example: 3,
    minimum: 1,
    maximum: 31,
  })
  @IsInt()
  @Min(1)
  @Max(31)
  dia_corte: number;

  @ApiProperty({
    description: 'Día del mes para vencimiento de pago (1-31)',
    example: 15,
    minimum: 1,
    maximum: 31,
  })
  @IsInt()
  @Min(1)
  @Max(31)
  dia_vencimiento: number;

  @ApiProperty({
    description: 'Día de inicio del período de facturación (1-31)',
    example: 1,
    minimum: 1,
    maximum: 31,
  })
  @IsInt()
  @Min(1)
  @Max(31)
  periodo_inicio: number;

  @ApiProperty({
    description: 'Día de fin del período de facturación (1-31)',
    example: 31,
    minimum: 1,
    maximum: 31,
  })
  @IsInt()
  @Min(1)
  @Max(31)
  periodo_fin: number;
}
