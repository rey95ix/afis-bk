import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class AssignPermissionsToRoleDto {
  @ApiProperty({
    example: [1, 2, 3, 4, 5],
    description: 'Array de IDs de permisos a asignar al rol',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  id_permisos: number[];
}
