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
import { CuentasBancariasService } from './cuentas-bancarias.service';
import { CreateCuentaBancariaDto } from './dto/create-cuenta-bancaria.dto';
import { UpdateCuentaBancariaDto } from './dto/update-cuenta-bancaria.dto';
import { FilterCuentaBancariaDto } from './dto/filter-cuenta-bancaria.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { GetUser } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('Bancos - Cuentas Bancarias')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('bancos/cuentas-bancarias')
@Auth()
export class CuentasBancariasController {
  constructor(private readonly cuentasBancariasService: CuentasBancariasService) {}

  @RequirePermissions('bancos.cuentas:crear')
  @Post()
  @ApiOperation({ summary: 'Crear una nueva cuenta bancaria' })
  @ApiResponse({ status: 201, description: 'La cuenta bancaria ha sido creada.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  @ApiResponse({ status: 409, description: 'Ya existe una cuenta con ese número.' })
  create(
    @Body() createCuentaBancariaDto: CreateCuentaBancariaDto,
    @GetUser() user: any,
  ) {
    return this.cuentasBancariasService.create(createCuentaBancariaDto, user.id_usuario);
  }

  @RequirePermissions('bancos.cuentas:ver')
  @Get()
  @ApiOperation({ summary: 'Obtener todas las cuentas bancarias con paginación y filtros' })
  @ApiResponse({
    status: 200,
    description: 'Retorna las cuentas bancarias paginadas.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  findAll(@Query() filterDto: FilterCuentaBancariaDto) {
    return this.cuentasBancariasService.findAll(filterDto);
  }

  @RequirePermissions('bancos.cuentas:ver')
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una cuenta bancaria por su ID' })
  @ApiResponse({ status: 200, description: 'Retorna la cuenta bancaria.' })
  @ApiResponse({ status: 404, description: 'Cuenta bancaria no encontrada.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cuentasBancariasService.findOne(id);
  }

  @RequirePermissions('bancos.cuentas:ver')
  @Get(':id/saldo')
  @ApiOperation({ summary: 'Consultar saldo actual de una cuenta bancaria' })
  @ApiResponse({ status: 200, description: 'Retorna el saldo actual.' })
  @ApiResponse({ status: 404, description: 'Cuenta bancaria no encontrada.' })
  getSaldo(@Param('id', ParseIntPipe) id: number) {
    return this.cuentasBancariasService.getSaldo(id);
  }

  @RequirePermissions('bancos.cuentas:editar')
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una cuenta bancaria' })
  @ApiResponse({ status: 200, description: 'La cuenta bancaria ha sido actualizada.' })
  @ApiResponse({ status: 404, description: 'Cuenta bancaria no encontrada.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCuentaBancariaDto: UpdateCuentaBancariaDto,
    @GetUser() user: any,
  ) {
    return this.cuentasBancariasService.update(id, updateCuentaBancariaDto, user.id_usuario);
  }

  @RequirePermissions('bancos.cuentas:eliminar')
  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una cuenta bancaria (soft delete)' })
  @ApiResponse({ status: 200, description: 'La cuenta bancaria ha sido desactivada.' })
  @ApiResponse({ status: 404, description: 'Cuenta bancaria no encontrada.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: any,
  ) {
    return this.cuentasBancariasService.remove(id, user.id_usuario);
  }
}
