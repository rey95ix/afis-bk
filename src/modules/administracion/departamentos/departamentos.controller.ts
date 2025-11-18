// src/modules/administracion/departamentos/departamentos.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { DepartamentosService } from './departamentos.service';
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

@ApiTags('Departamentos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/departamentos')
@Auth()
export class DepartamentosController {
  constructor(private readonly departamentosService: DepartamentosService) {}

  @Get()
  @Auth()
  @RequirePermissions('administracion.departamentos:ver')
  @ApiOperation({ summary: 'Obtener todos los departamentos activos' })
  @ApiResponse({
    status: 200,
    description: 'Retorna todos los departamentos activos.',
  })
  findAll() {
    return this.departamentosService.findAll();
  }

  @Get(':id')
  @Auth()
  @RequirePermissions('administracion.departamentos:ver')
  @ApiOperation({ summary: 'Obtener un departamento por su ID' })
  @ApiParam({ name: 'id', description: 'ID del departamento', type: Number })
  @ApiResponse({ status: 200, description: 'Retorna el departamento.' })
  @ApiResponse({ status: 404, description: 'Departamento no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.departamentosService.findOne(id);
  }
}
