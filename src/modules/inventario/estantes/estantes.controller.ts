// src/modules/inventario/estantes/estantes.controller.ts
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
import { EstantesService } from './estantes.service';
import { CreateEstanteDto } from './dto/create-estante.dto';
import { UpdateEstanteDto } from './dto/update-estante.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';

@ApiTags('Estantes')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/bodegas/:id_bodega/estantes')
@Auth()
export class EstantesController {
  constructor(private readonly estantesService: EstantesService) {}

  @RequirePermissions('inventario.estantes:crear')
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo estante' })
  @ApiResponse({ status: 201, description: 'El estante ha sido creado.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createEstanteDto: CreateEstanteDto) {
    return this.estantesService.create(createEstanteDto);
  }

  @RequirePermissions('inventario.estantes:ver')
  @Get()
  @ApiOperation({ summary: 'Obtener todos los estantes de una bodega' })
  @ApiResponse({
    status: 200,
    description: 'Retorna los estantes paginados.',
  })
  findAll(@Param('id_bodega', ParseIntPipe) id_bodega: number, @Query() paginationDto: PaginationDto) {
    return this.estantesService.findAll(id_bodega, paginationDto);
  }

  @RequirePermissions('inventario.estantes:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un estante por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna el estante.' })
  @ApiResponse({ status: 404, description: 'Estante no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.estantesService.findOne(id);
  }

  @RequirePermissions('inventario.estantes:editar')
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un estante' })
  @ApiResponse({ status: 200, description: 'El estante ha sido actualizado.' })
  @ApiResponse({ status: 404, description: 'Estante no encontrado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEstanteDto: UpdateEstanteDto,
  ) {
    return this.estantesService.update(id, updateEstanteDto);
  }

  @RequirePermissions('inventario.estantes:eliminar')
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un estante (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'El estante ha sido inactivado.' })
  @ApiResponse({ status: 404, description: 'Estante no encontrado.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.estantesService.remove(id);
  }
}
