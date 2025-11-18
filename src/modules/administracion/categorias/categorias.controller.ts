// src/modules/administracion/categorias/categorias.controller.ts
import { Controller, Get, Post, Body, Put, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Categorias')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('categorias')
@Auth()
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  @RequirePermissions('administracion.categorias:crear')
  @ApiOperation({ summary: 'Crear una nueva categoría' })
  @ApiResponse({ status: 201, description: 'La categoría ha sido creada.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createCategoriaDto: CreateCategoriaDto) {
    return this.categoriasService.create(createCategoriaDto);
  }

  @Get()
  @RequirePermissions('administracion.categorias:ver')
  @ApiOperation({ summary: 'Obtener todas las categorías activas con paginación y búsqueda' })
  @ApiResponse({
    status: 200,
    description: 'Retorna las categorías paginadas.',
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
    return this.categoriasService.findAll(paginationDto);
  }

  @Get('subcategorias/all')
  @RequirePermissions('administracion.categorias:ver')
  @ApiOperation({ summary: 'Obtener todas las sub-categorías activas para selects' })
  @ApiResponse({ status: 200, description: 'Retorna un listado de todas las sub-categorías.' })
  findAllSubcategories() {
    return this.categoriasService.findAllSubcategories();
  }

  @Get(':id')
  @RequirePermissions('administracion.categorias:ver')
  @ApiOperation({ summary: 'Obtener una categoría por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna la categoría.' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('administracion.categorias:editar')
  @ApiOperation({ summary: 'Actualizar una categoría' })
  @ApiResponse({ status: 200, description: 'La categoría ha sido actualizada.' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCategoriaDto: UpdateCategoriaDto) {
    return this.categoriasService.update(id, updateCategoriaDto);
  }

  @Delete(':id')
  @RequirePermissions('administracion.categorias:eliminar')
  @ApiOperation({ summary: 'Eliminar una categoría (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'La categoría ha sido inactivada.' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.remove(id);
  }
}
