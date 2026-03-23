import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class FirmarContratoOnlineDto {
  @ApiProperty({
    description: 'Firma del cliente en formato base64 (data:image/png;base64,...)',
  })
  @IsNotEmpty({ message: 'La firma es requerida' })
  @IsString()
  @MaxLength(2_000_000, { message: 'La firma excede el tamaño máximo permitido' })
  firma_base64: string;
}
