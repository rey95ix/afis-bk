import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsInt, IsDateString } from 'class-validator';

export class EmitirOrdenCompraDto {
  @ApiPropertyOptional({
    description: 'Observaciones de la emisión',
    example: 'Emitida al proveedor vía correo electrónico',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Registrar pago al emitir' })
  @IsOptional()
  @IsBoolean()
  registrar_pago?: boolean;

  @ApiPropertyOptional({
    description: 'Método de pago',
    example: 'TRANSFERENCIA',
  })
  @IsOptional()
  @IsString()
  metodo_pago?: string;

  @ApiPropertyOptional({ description: 'ID de la cuenta bancaria origen' })
  @IsOptional()
  @IsInt()
  id_cuenta_bancaria?: number;

  @ApiPropertyOptional({ description: 'Número de cheque (si método = CHEQUE)' })
  @IsOptional()
  @IsString()
  cheque_numero?: string;

  @ApiPropertyOptional({ description: 'Beneficiario del cheque' })
  @IsOptional()
  @IsString()
  cheque_beneficiario?: string;

  @ApiPropertyOptional({ description: 'Fecha emisión cheque (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  cheque_fecha_emision?: string;

  @ApiPropertyOptional({ description: 'Número de transferencia (si método = TRANSFERENCIA)' })
  @IsOptional()
  @IsString()
  transferencia_numero?: string;
}
