import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  HeaderComponentDto,
  BodyComponentDto,
  FooterComponentDto,
  ButtonDto,
} from './create-meta-template.dto';

export class UpdateMetaTemplateDto {
  @ApiPropertyOptional({
    description: 'Configuración del header',
    type: HeaderComponentDto,
  })
  @ValidateNested()
  @Type(() => HeaderComponentDto)
  @IsOptional()
  header?: HeaderComponentDto;

  @ApiPropertyOptional({
    description: 'Configuración del body',
    type: BodyComponentDto,
  })
  @ValidateNested()
  @Type(() => BodyComponentDto)
  @IsOptional()
  body?: BodyComponentDto;

  @ApiPropertyOptional({
    description: 'Configuración del footer',
    type: FooterComponentDto,
  })
  @ValidateNested()
  @Type(() => FooterComponentDto)
  @IsOptional()
  footer?: FooterComponentDto;

  @ApiPropertyOptional({
    description: 'Botones de la plantilla (máximo 3)',
    type: [ButtonDto],
    maxItems: 3,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ButtonDto)
  @IsOptional()
  buttons?: ButtonDto[];

  @ApiPropertyOptional({
    description: 'Descripción interna de la plantilla',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Si la plantilla está activa localmente',
  })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
