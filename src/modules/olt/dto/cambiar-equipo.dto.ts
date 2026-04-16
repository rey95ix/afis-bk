import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CambiarEquipoDto {
  @ApiProperty({ description: 'ID del cliente' })
  @IsInt()
  idCliente: number;

  @ApiProperty({ description: 'ID del nuevo olt_cliente (slot destino con ont_status=0)' })
  @IsInt()
  idNuevoOltCliente: number;

  @ApiProperty({ description: 'ID del modelo de ONT nuevo' })
  @IsInt()
  idOltModeloNuevo: number;

  @ApiProperty({ description: 'Serial Number del equipo nuevo' })
  @IsString()
  snNuevo: string;

  @ApiProperty({ description: 'Password del equipo nuevo (para LOID)', required: false })
  @IsOptional()
  @IsString()
  passwordNuevo?: string;

  @ApiProperty({ description: 'VLAN para el nuevo equipo (1-4094)' })
  @IsInt()
  @Min(1)
  @Max(4094)
  vlanNuevo: number;

  @ApiProperty({ description: 'User VLAN para el nuevo equipo (1-4094)' })
  @IsInt()
  @Min(1)
  @Max(4094)
  userVlanNuevo: number;

  @ApiProperty({ description: 'Observación del cambio', required: false })
  @IsOptional()
  @IsString()
  observacion?: string;
}
