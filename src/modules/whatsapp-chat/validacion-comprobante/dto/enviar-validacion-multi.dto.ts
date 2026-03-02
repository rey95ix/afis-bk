import { IsArray, ArrayMinSize, ArrayMaxSize, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnviarValidacionMultiDto {
  @ApiProperty({
    description: 'IDs de los mensajes a enviar como validación conjunta (imágenes + textos)',
    example: [101, 102, 103],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos 1 mensaje' })
  @ArrayMaxSize(10, { message: 'No se pueden seleccionar más de 10 mensajes' })
  @IsInt({ each: true, message: 'Cada ID de mensaje debe ser un número entero' })
  @Min(1, { each: true, message: 'Cada ID de mensaje debe ser positivo' })
  messageIds: number[];
}
