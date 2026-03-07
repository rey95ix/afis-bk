import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para renovar access token usando refresh token
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token obtenido durante el login',
    example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...',
  })
  @IsString({ message: 'El refresh token debe ser texto' })
  @IsNotEmpty({ message: 'El refresh token es requerido' })
  refresh_token: string;
}
