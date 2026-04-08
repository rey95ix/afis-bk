// src/modules/facturacion/cobranza/dto/crear-nota.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { tipo_nota_cobranza } from '@prisma/client';

export class CrearNotaDto {
  @ApiProperty({
    enum: [
      'CONTACTO_WHATSAPP',
      'LLAMADA_REALIZADA',
      'VISITA_TECNICA',
      'PROMESA_PAGO',
      'OTRO',
    ],
    example: 'CONTACTO_WHATSAPP',
  })
  @IsEnum([
    'CONTACTO_WHATSAPP',
    'LLAMADA_REALIZADA',
    'VISITA_TECNICA',
    'PROMESA_PAGO',
    'OTRO',
  ])
  tipo: tipo_nota_cobranza;

  @ApiProperty({ example: 'Cliente confirmó pago para el viernes' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiPropertyOptional({
    description: 'Fecha en que el cliente promete pagar (solo PROMESA_PAGO)',
    example: '2026-04-15',
  })
  @ValidateIf((o) => o.tipo === 'PROMESA_PAGO')
  @IsDateString()
  fecha_promesa?: string;

  @ApiPropertyOptional({
    description: 'Monto prometido (solo PROMESA_PAGO)',
    example: 25.5,
  })
  @ValidateIf((o) => o.tipo === 'PROMESA_PAGO')
  @IsNumber()
  @Min(0.01)
  monto_promesa?: number;
}
