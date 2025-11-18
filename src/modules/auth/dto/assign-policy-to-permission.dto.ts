import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignPolicyToPermissionDto {
  @ApiProperty({
    example: 3,
    description: 'ID de la política a asignar al permiso',
  })
  @IsInt()
  id_politica: number;
}
