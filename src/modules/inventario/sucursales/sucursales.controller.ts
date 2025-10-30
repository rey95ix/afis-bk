// src/modules/inventario/sucursales/sucursales.controller.ts
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
import { SucursalesService } from './sucursales.service';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Sucursales')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/sucursales')
@Auth()
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva sucursal' })
  @ApiResponse({ status: 201, description: 'La sucursal ha sido creada.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(@Body() createSucursalDto: CreateSucursalDto) {
    return this.sucursalesService.create(createSucursalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las sucursales activas' })
  findAll() {
    return this.sucursalesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una sucursal por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna la sucursal.' })
  @ApiResponse({ status: 404, description: 'Sucursal no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sucursalesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una sucursal' })
  @ApiResponse({ status: 200, description: 'La sucursal ha sido actualizada.' })
  @ApiResponse({ status: 404, description: 'Sucursal no encontrada.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSucursalDto: UpdateSucursalDto,
  ) {
    return this.sucursalesService.update(id, updateSucursalDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una sucursal (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'La sucursal ha sido inactivada.' })
  @ApiResponse({ status: 404, description: 'Sucursal no encontrada.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sucursalesService.remove(id);
  }
}
