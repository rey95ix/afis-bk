import { PartialType } from '@nestjs/swagger';
import { CreatePermissionDto } from './create-permission.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {
  @ApiPropertyOptional({
    enum: ['ACTIVO', 'INACTIVO'],
    example: 'ACTIVO',
    description: 'Estado del permiso',
  })
  @IsEnum(['ACTIVO', 'INACTIVO'])
  @IsOptional()
  estado?: string;
}
