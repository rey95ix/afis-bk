// src/modules/inventario/proveedores/proveedores.controller.ts
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
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth, GetUser } from 'src/modules/auth/decorators';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto';
import { usuarios } from '@prisma/client';

@ApiTags('Proveedores')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/proveedores')
@Auth()
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo proveedor' })
  @ApiResponse({ status: 201, description: 'El proveedor ha sido creado.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  create(
    @Body() createProveedorDto: CreateProveedorDto,
    @GetUser() user: any,
  ) {
    return this.proveedoresService.create(createProveedorDto,user.id_usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los proveedores activos con paginación y búsqueda' })
  @ApiResponse({
    status: 200,
    description: 'Retorna los proveedores paginados.',
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.proveedoresService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un proveedor por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna el proveedor.' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un proveedor' })
  @ApiResponse({ status: 200, description: 'El proveedor ha sido actualizado.' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProveedorDto: UpdateProveedorDto,
    @GetUser() user: any,
  ) {
    return this.proveedoresService.update(id, updateProveedorDto, user.id_usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un proveedor (cambia estado a INACTIVO)' })
  @ApiResponse({ status: 200, description: 'El proveedor ha sido inactivado.' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado.' })
  remove(@Param('id', ParseIntPipe) id: number, @GetUser() user: any) {
    return this.proveedoresService.remove(id, user.id_usuario);
  }
}
