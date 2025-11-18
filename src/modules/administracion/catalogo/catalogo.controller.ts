// src/modules/administracion/catalogo/catalogo.controller.ts
import { Controller, Get, Post, Body,   Param, Delete, ParseIntPipe, Query, Put } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { CreateCatalogoDto } from './dto/create-catalogo.dto';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Catalogo')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('catalogo')
@Auth()
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  @Post()
  @RequirePermissions('administracion.catalogo:crear')
  @ApiOperation({ summary: 'Crear un nuevo item en el catalogo' })
  @ApiResponse({ status: 201, description: 'El item ha sido creado.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createCatalogoDto: CreateCatalogoDto) {
    return this.catalogoService.create(createCatalogoDto);
  }

  @Get('next-code')
  @RequirePermissions('administracion.catalogo:ver')
  @ApiOperation({ summary: 'Obtener el siguiente código disponible para el catálogo basado en la categoría' })
  @ApiResponse({ status: 200, description: 'Retorna el siguiente código.' })
  getNextCode(@Query('subCategoriaId', ParseIntPipe) subCategoriaId: number) {
    return this.catalogoService.getNextCode(subCategoriaId);
  }

  @Get()
  @RequirePermissions('administracion.catalogo:ver')
  @ApiOperation({ summary: 'Obtener todos los items del catálogo activos con paginación y búsqueda' })
  @ApiResponse({
    status: 200,
    description: 'Retorna los items del catálogo paginados.',
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
    return this.catalogoService.findAll(paginationDto);
  }

  @Get(':id')
  @RequirePermissions('administracion.catalogo:ver')
  @ApiOperation({ summary: 'Obtener un item del catalogo por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna el item.' })
  @ApiResponse({ status: 404, description: 'Item no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('administracion.catalogo:editar')
  @ApiOperation({ summary: 'Actualizar un item del catalogo' })
  @ApiResponse({ status: 200, description: 'El item ha sido actualizado.' })
  @ApiResponse({ status: 404, description: 'Item no encontrado.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCatalogoDto: UpdateCatalogoDto) {
    return this.catalogoService.update(id, updateCatalogoDto);
  }

  @Delete(':id')
  @RequirePermissions('administracion.catalogo:eliminar')
  @ApiOperation({ summary: 'Eliminar un item del catalogo (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'El item ha sido inactivado.' })
  @ApiResponse({ status: 404, description: 'Item no encontrado.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.remove(id);
  }
}
