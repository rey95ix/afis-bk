// src/modules/inventario/bodegas/bodegas.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { BodegasService } from './bodegas.service';
import { CreateBodegaDto } from './dto/create-bodega.dto';
import { UpdateBodegaDto } from './dto/update-bodega.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Bodegas')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('bodegas')
@Auth()
export class BodegasController {
  constructor(private readonly bodegasService: BodegasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva bodega' })
  @ApiResponse({ status: 201, description: 'La bodega ha sido creada.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createBodegaDto: CreateBodegaDto) {
    return this.bodegasService.create(createBodegaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las bodegas activas' })
  findAll() {
    return this.bodegasService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una bodega por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna la bodega.' })
  @ApiResponse({ status: 404, description: 'Bodega no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bodegasService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una bodega' })
  @ApiResponse({ status: 200, description: 'La bodega ha sido actualizada.' })
  @ApiResponse({ status: 404, description: 'Bodega no encontrada.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBodegaDto: UpdateBodegaDto,
  ) {
    return this.bodegasService.update(id, updateBodegaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una bodega (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'La bodega ha sido inactivada.' })
  @ApiResponse({ status: 404, description: 'Bodega no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bodegasService.remove(id);
  }
}
