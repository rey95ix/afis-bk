import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEvidenciaDto {
  @ApiProperty({
    description: 'Tipo de evidencia',
    example: 'foto_antes',
    enum: ['foto_antes', 'foto_despues', 'speedtest', 'firma', 'audio'],
  })
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @ApiProperty({
    description: 'URL del archivo de evidencia (S3, Cloud Storage, etc.)',
    example: 'https://storage.example.com/evidencias/orden-123/foto-antes.jpg',
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({
    description: 'Metadata adicional en formato JSON (resultados de speedtest, coordenadas GPS, etc.)',
    example: '{"download": "100 Mbps", "upload": "50 Mbps", "ping": "10 ms"}',
  })
  @IsString()
  @IsOptional()
  metadata?: string;

  @ApiProperty({
    description: 'ID del usuario que subió la evidencia',
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  subido_por: number;
}
