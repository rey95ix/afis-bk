// src/modules/administracion/municipios/municipios.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MunicipiosService } from './municipios.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Municipios')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/municipios')
@Auth()
export class MunicipiosController {
  constructor(private readonly municipiosService: MunicipiosService) {}

  @Get()
  @Auth()
  @RequirePermissions('administracion.municipios:ver')
  @ApiOperation({ summary: 'Obtener todos los municipios activos' })
  @ApiResponse({
    status: 200,
    description: 'Retorna todos los municipios activos con su departamento.',
  })
  findAll() {
    return this.municipiosService.findAll();
  }

  @Get('departamento/:id_departamento')
  @Auth()
  @RequirePermissions('administracion.municipios:ver')
  @ApiOperation({ summary: 'Obtener municipios por departamento' })
  @ApiParam({
    name: 'id_departamento',
    description: 'ID del departamento',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna los municipios del departamento especificado.',
  })
  findByDepartamento(
    @Param('id_departamento', ParseIntPipe) id_departamento: number,
  ) {
    return this.municipiosService.findByDepartamento(id_departamento);
  }

  @Get(':id')
  @Auth()
  @RequirePermissions('administracion.municipios:ver')
  @ApiOperation({ summary: 'Obtener un municipio por su ID' })
  @ApiParam({ name: 'id', description: 'ID del municipio', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Retorna el municipio con su departamento.',
  })
  @ApiResponse({ status: 404, description: 'Municipio no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.municipiosService.findOne(id);
  }
}
