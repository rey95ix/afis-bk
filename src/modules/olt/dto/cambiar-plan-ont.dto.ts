import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CambiarPlanOntDto {
  @ApiProperty({ description: 'ID del cliente' })
  @IsInt()
  idCliente: number;

  @ApiProperty({ description: 'ID del perfil de tráfico de subida' })
  @IsInt()
  idTraficoUp: number;

  @ApiProperty({ description: 'ID del perfil de tráfico de bajada' })
  @IsInt()
  idTraficoDown: number;
}
