// src/modules/administracion/colonias/colonias.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ColoniasService } from './colonias.service';
import { CreateColoniaDto } from './dto/create-colonia.dto';
import { UpdateColoniaDto } from './dto/update-colonia.dto';
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
import { PaginationDto } from 'src/common/dto';

@ApiTags('Colonias')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('administracion/colonias')
@Auth()
export class ColoniasController {
  constructor(private readonly coloniasService: ColoniasService) {}

  @Post()
  @Auth()
  @RequirePermissions('administracion.colonias:crear')
  @ApiOperation({ summary: 'Crear una nueva colonia' })
  @ApiResponse({ status: 201, description: 'La colonia ha sido creada.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createColoniaDto: CreateColoniaDto) {
    return this.coloniasService.create(createColoniaDto);
  }

  @Get()
  @Auth()
  @RequirePermissions('administracion.colonias:ver')
  @ApiOperation({ summary: 'Obtener todas las colonias activas con paginación y búsqueda' })
  @ApiResponse({
    status: 200,
    description: 'Retorna las colonias paginadas.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' }
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' }
          }
        }
      }
    }
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.coloniasService.findAll(paginationDto);
  }

  @Get('municipio/:id_municipio')
  @Auth()
  @RequirePermissions('administracion.colonias:ver')
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
  @Auth()
  @RequirePermissions('administracion.colonias:ver')
  @ApiOperation({ summary: 'Obtener una colonia por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna la colonia.' })
  @ApiResponse({ status: 404, description: 'Colonia no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coloniasService.findOne(id);
  }

  @Put(':id')
  @Auth()
  @RequirePermissions('administracion.colonias:editar')
  @ApiOperation({ summary: 'Actualizar una colonia' })
  @ApiResponse({ status: 200, description: 'La colonia ha sido actualizada.' })
  @ApiResponse({ status: 404, description: 'Colonia no encontrada.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateColoniaDto: UpdateColoniaDto,
  ) {
    return this.coloniasService.update(id, updateColoniaDto);
  }

  @Delete(':id')
  @Auth()
  @RequirePermissions('administracion.colonias:eliminar')
  @ApiOperation({ summary: 'Eliminar una colonia (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'La colonia ha sido inactivada.' })
  @ApiResponse({ status: 404, description: 'Colonia no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coloniasService.remove(id);
  }
}
