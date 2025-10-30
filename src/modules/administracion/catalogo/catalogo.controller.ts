// src/modules/inventario/catalogo/catalogo.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { CreateCatalogoDto } from './dto/create-catalogo.dto';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Catalogo')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('catalogo')
@Auth()
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo item en el catalogo' })
  @ApiResponse({ status: 201, description: 'El item ha sido creado.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createCatalogoDto: CreateCatalogoDto) {
    return this.catalogoService.create(createCatalogoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los items del catalogo activos' })
  findAll() {
    return this.catalogoService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un item del catalogo por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna el item.' })
  @ApiResponse({ status: 404, description: 'Item no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un item del catalogo' })
  @ApiResponse({ status: 200, description: 'El item ha sido actualizado.' })
  @ApiResponse({ status: 404, description: 'Item no encontrado.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCatalogoDto: UpdateCatalogoDto) {
    return this.catalogoService.update(id, updateCatalogoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un item del catalogo (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'El item ha sido inactivado.' })
  @ApiResponse({ status: 404, description: 'Item no encontrado.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.remove(id);
  }
}
