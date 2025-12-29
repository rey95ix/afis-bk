import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para solicitar activación de cuenta
 * El cliente ingresa su DUI y recibe un email con instrucciones
 */
export class ClienteSolicitarActivacionDto {
  @ApiProperty({
    description: 'DUI del cliente registrado en el sistema',
    example: '12345678-9',
  })
  @IsString({ message: 'El DUI debe ser texto' })
  @IsNotEmpty({ message: 'El DUI es requerido' })
  @MaxLength(20, { message: 'El DUI no puede exceder 20 caracteres' })
  @Matches(/^\d{8}-\d$/, { message: 'Formato de DUI inválido. Use: 12345678-9' })
  dui: string;
}
