import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { EscalarTicketDto } from './dto/escalar-ticket.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger'; 
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';

@ApiTags('Tickets de Soporte') 
@Controller('api/tickets')

@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo ticket de soporte',
    description:
      'Registra un nuevo ticket cuando un cliente reporta un problema. El agente de atención al cliente captura la información inicial y puede realizar diagnóstico remoto.',
  })
  @ApiResponse({
    status: 201,
    description: 'Ticket creado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente o dirección no encontrada',
  })
  create(@Body() createTicketDto: CreateTicketDto, @Request() req) {
    return this.ticketsService.create(createTicketDto, req.user.id_usuario);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar tickets con filtros',
    description:
      'Obtiene una lista paginada de tickets con opciones de filtrado por estado, cliente, severidad y rango de fechas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tickets obtenida exitosamente',
  })
  findAll(@Query() queryDto: QueryTicketDto) {
    return this.ticketsService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un ticket por ID',
    description:
      'Obtiene los detalles completos de un ticket incluyendo información del cliente, dirección de servicio, diagnóstico y órdenes de trabajo asociadas.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del ticket',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket no encontrado',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar un ticket',
    description:
      'Permite actualizar la información del ticket, incluyendo diagnóstico, pruebas remotas, severidad y estado.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del ticket',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket no encontrado',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTicketDto: UpdateTicketDto,
    @Request() req,
  ) {
    return this.ticketsService.update(id, updateTicketDto, req.user.id_usuario);
  }

  @Post(':id/escalar')
  @ApiOperation({
    summary: 'Escalar ticket a orden de trabajo',
    description:
      'Crea una orden de trabajo a partir de un ticket cuando el problema no puede ser resuelto remotamente y requiere visita técnica. Genera automáticamente el código de la orden (OT-YYYYMM-#####) y actualiza el estado del ticket a ESCALADO.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del ticket a escalar',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Ticket escalado exitosamente, orden de trabajo creada',
  })
  @ApiResponse({
    status: 400,
    description: 'El ticket no puede ser escalado (ya está escalado, cerrado o no tiene dirección de servicio)',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket no encontrado',
  })
  escalar(
    @Param('id', ParseIntPipe) id: number,
    @Body() escalarDto: EscalarTicketDto,
    @Request() req,
  ) {
    return this.ticketsService.escalar(id, escalarDto, req.user.id_usuario);
  }
}
