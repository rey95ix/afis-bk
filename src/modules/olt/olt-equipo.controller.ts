import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { OltEquipoService } from './olt-equipo.service';
import { CreateOltEquipoDto } from './dto/create-olt-equipo.dto';
import { UpdateOltEquipoDto } from './dto/update-olt-equipo.dto';
import { QueryOltEquipoDto } from './dto/query-olt-equipo.dto';

@ApiTags('OLT - Equipos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('olt/equipos')
@Auth()
export class OltEquipoController {
  constructor(private readonly equipoService: OltEquipoService) {}

  @Get()
  @RequirePermissions('olt.equipos:ver')
  @ApiOperation({ summary: 'Listar equipos OLT (paginado, con búsqueda)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de equipos OLT' })
  findAll(@Query() query: QueryOltEquipoDto) {
    return this.equipoService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('olt.equipos:ver')
  @ApiOperation({ summary: 'Obtener un equipo OLT por ID' })
  @ApiResponse({ status: 200, description: 'Equipo encontrado' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.equipoService.findOne(id);
  }

  @Post()
  @RequirePermissions('olt.equipos:crear')
  @ApiOperation({
    summary: 'Crear un equipo OLT',
    description:
      'Registra un nuevo equipo OLT junto con sus credenciales SSH (usuario y clave). La clave se encripta con AES-256-GCM antes de guardarse.',
  })
  @ApiResponse({ status: 201, description: 'Equipo creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() dto: CreateOltEquipoDto) {
    return this.equipoService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('olt.equipos:editar')
  @ApiOperation({
    summary: 'Actualizar un equipo OLT',
    description:
      'Permite actualizar metadatos del equipo, credenciales SSH o ambos. Si se envía `clave`, se re-encripta.',
  })
  @ApiResponse({ status: 200, description: 'Equipo actualizado' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOltEquipoDto,
  ) {
    return this.equipoService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('olt.equipos:eliminar')
  @ApiOperation({
    summary: 'Eliminar un equipo OLT',
    description:
      'Sólo permitido si el equipo no tiene tarjetas ni comandos asociados.',
  })
  @ApiResponse({ status: 200, description: 'Equipo eliminado' })
  @ApiResponse({ status: 400, description: 'Equipo en uso, no se puede eliminar' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.equipoService.remove(id);
  }

  @Post(':id/test-connection')
  @RequirePermissions('olt.equipos:ver')
  @ApiOperation({
    summary: 'Probar conexión SSH al equipo OLT',
    description:
      'Ejecuta un `display version` contra el equipo para validar credenciales y conectividad.',
  })
  @ApiResponse({ status: 200, description: 'Resultado de la prueba de conexión' })
  testConnection(@Param('id', ParseIntPipe) id: number) {
    return this.equipoService.testConnection(id);
  }
}
