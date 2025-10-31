// src/modules/administracion/colonias/colonias.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ColoniasService } from './colonias.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Colonias')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/colonias')
@Auth()
export class ColoniasController {
  constructor(private readonly coloniasService: ColoniasService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las colonias activas' })
  @ApiResponse({
    status: 200,
    description: 'Retorna todas las colonias activas con su municipio.',
  })
  findAll() {
    return this.coloniasService.findAll();
  }

  @Get('municipio/:id_municipio')
  @ApiOperation({ summary: 'Obtener colonias por municipio' })
  @ApiParam({
    name: 'id_municipio',
    description: 'ID del municipio',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna las colonias del municipio especificado.',
  })
  findByMunicipio(@Param('id_municipio', ParseIntPipe) id_municipio: number) {
    return this.coloniasService.findByMunicipio(id_municipio);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una colonia por su ID' })
  @ApiParam({ name: 'id', description: 'ID de la colonia', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Retorna la colonia con su municipio.',
  })
  @ApiResponse({ status: 404, description: 'Colonia no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coloniasService.findOne(id);
  }
}
