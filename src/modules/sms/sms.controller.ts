import { Controller, Post, Get, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SmsService } from './sms.service';
import { EnviarSmsDto } from './dto/enviar-sms.dto';
import { QuerySmsDto } from './dto/query-sms.dto'; 
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from '../auth/decorators';

@ApiTags('SMS')
@Controller('sms')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post()
  @ApiOperation({
    summary: 'Enviar SMS',
    description: 'Envía un SMS a un número de teléfono especificado. Requiere credenciales de Twilio configuradas.'
  })
  @ApiResponse({
    status: 201,
    description: 'SMS enviado exitosamente',
    schema: {
      example: {
        success: true,
        id_sms: 1,
        twilio_sid: 'SM1234567890abcdef1234567890abcdef',
        estado: 'ENVIADO',
        mensaje: 'SMS enviado exitosamente'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error al enviar' })
  async enviarSms(@Body() enviarSmsDto: EnviarSmsDto, @Req() req: any) {
    const userId = req.user?.id_usuario;
    return this.smsService.enviarSms(enviarSmsDto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar historial de SMS',
    description: 'Obtiene el historial de SMS enviados con filtros opcionales y paginación'
  })
  @ApiResponse({
    status: 200,
    description: 'Historial obtenido exitosamente',
    schema: {
      example: {
        data: [
          {
            id_sms: 1,
            telefono_destino: '+50312345678',
            tipo_mensaje: 'TECNICO_EN_CAMINO',
            mensaje: 'Nuestro técnico está en camino...',
            estado: 'ENVIADO',
            twilio_sid: 'SM1234567890abcdef',
            fecha_creacion: '2025-01-11T10:30:00Z',
            fecha_envio: '2025-01-11T10:30:05Z'
          }
        ],
        meta: {
          total: 150,
          page: 1,
          limit: 10,
          totalPages: 15
        }
      }
    }
  })
  async consultarHistorial(@Query() queryDto: QuerySmsDto) {
    return this.smsService.consultarHistorial(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un SMS',
    description: 'Obtiene información detallada de un SMS específico por su ID'
  })
  @ApiResponse({ status: 200, description: 'Detalle del SMS' })
  @ApiResponse({ status: 404, description: 'SMS no encontrado' })
  async obtenerDetalleSms(@Param('id') id: string) {
    return this.smsService.obtenerDetalleSms(parseInt(id));
  }

  @Post(':id/reenviar')
  @ApiOperation({
    summary: 'Reenviar SMS fallido',
    description: 'Reintenta el envío de un SMS que falló previamente'
  })
  @ApiResponse({ status: 200, description: 'SMS reenviado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al reenviar o SMS ya fue enviado' })
  async reenviarSms(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id_usuario;
    return this.smsService.reenviarSms(parseInt(id), userId);
  }

  @Get('twilio/estado/:sid')
  @ApiOperation({
    summary: 'Consultar estado en Twilio',
    description: 'Consulta el estado actual de un mensaje directamente en Twilio usando el SID'
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del mensaje en Twilio',
    schema: {
      example: {
        sid: 'SM1234567890abcdef',
        status: 'delivered',
        to: '+50312345678',
        from: '+15551234567',
        dateCreated: '2025-01-11T10:30:00Z',
        dateSent: '2025-01-11T10:30:02Z',
        price: '-0.0075',
        priceUnit: 'USD'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Error al consultar Twilio' })
  async consultarEstadoTwilio(@Param('sid') sid: string) {
    return this.smsService.consultarEstadoTwilio(sid);
  }

  // ========== ENDPOINTS DE CONVENIENCIA ==========

  @Post('notificaciones/factura')
  @ApiOperation({
    summary: 'Enviar notificación de factura',
    description: 'Envía un SMS notificando al cliente sobre una factura generada'
  })
  @ApiResponse({ status: 201, description: 'Notificación enviada' })
  async notificarFactura(
    @Body() body: {
      telefono: string;
      numeroFactura: string;
      total: number;
      nombreCliente: string;
      idCliente?: number;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id_usuario;
    return this.smsService.enviarNotificacionFactura(
      body.telefono,
      body.numeroFactura,
      body.total,
      body.nombreCliente,
      body.idCliente,
      userId,
    );
  }

  @Post('notificaciones/tecnico-en-camino')
  @ApiOperation({
    summary: 'Notificar técnico en camino',
    description: 'Envía un SMS notificando que el técnico está en camino al sitio del cliente'
  })
  @ApiResponse({ status: 201, description: 'Notificación enviada' })
  async notificarTecnicoEnCamino(
    @Body() body: {
      telefono: string;
      nombreTecnico: string;
      numeroOrden: string;
      eta: string;
      idCliente?: number;
      idOrdenTrabajo?: number;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id_usuario;
    return this.smsService.enviarNotificacionTecnicoEnCamino(
      body.telefono,
      body.nombreTecnico,
      body.numeroOrden,
      body.eta,
      body.idCliente,
      body.idOrdenTrabajo,
      userId,
    );
  }

  @Post('notificaciones/orden-asignada')
  @ApiOperation({
    summary: 'Notificar orden de trabajo asignada',
    description: 'Envía un SMS notificando que una orden de trabajo ha sido asignada a un técnico'
  })
  @ApiResponse({ status: 201, description: 'Notificación enviada' })
  async notificarOrdenAsignada(
    @Body() body: {
      telefono: string;
      nombreCliente: string;
      numeroOrden: string;
      nombreTecnico: string;
      idCliente?: number;
      idOrdenTrabajo?: number;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id_usuario;
    return this.smsService.enviarNotificacionOrdenAsignada(
      body.telefono,
      body.nombreCliente,
      body.numeroOrden,
      body.nombreTecnico,
      body.idCliente,
      body.idOrdenTrabajo,
      userId,
    );
  }

  @Post('notificaciones/orden-agendada')
  @ApiOperation({
    summary: 'Notificar orden de trabajo agendada',
    description: 'Envía un SMS notificando la fecha y hora agendada para una orden de trabajo'
  })
  @ApiResponse({ status: 201, description: 'Notificación enviada' })
  async notificarOrdenAgendada(
    @Body() body: {
      telefono: string;
      nombreCliente: string;
      numeroOrden: string;
      fechaAgendada: string;
      horaInicio: string;
      horaFin: string;
      idCliente?: number;
      idOrdenTrabajo?: number;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id_usuario;
    return this.smsService.enviarNotificacionOrdenAgendada(
      body.telefono,
      body.nombreCliente,
      body.numeroOrden,
      body.fechaAgendada,
      body.horaInicio,
      body.horaFin,
      body.idCliente,
      body.idOrdenTrabajo,
      userId,
    );
  }

  @Post('notificaciones/orden-completada')
  @ApiOperation({
    summary: 'Notificar orden de trabajo completada',
    description: 'Envía un SMS notificando que una orden de trabajo ha sido completada'
  })
  @ApiResponse({ status: 201, description: 'Notificación enviada' })
  async notificarOrdenCompletada(
    @Body() body: {
      telefono: string;
      nombreCliente: string;
      numeroOrden: string;
      idCliente?: number;
      idOrdenTrabajo?: number;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id_usuario;
    return this.smsService.enviarNotificacionOrdenCompletada(
      body.telefono,
      body.nombreCliente,
      body.numeroOrden,
      body.idCliente,
      body.idOrdenTrabajo,
      userId,
    );
  }

  @Post('notificaciones/ticket-creado')
  @ApiOperation({
    summary: 'Notificar ticket creado',
    description: 'Envía un SMS notificando que un ticket de soporte ha sido creado'
  })
  @ApiResponse({ status: 201, description: 'Notificación enviada' })
  async notificarTicketCreado(
    @Body() body: {
      telefono: string;
      nombreCliente: string;
      numeroTicket: number;
      idCliente?: number;
      idTicket?: number;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id_usuario;
    return this.smsService.enviarNotificacionTicketCreado(
      body.telefono,
      body.nombreCliente,
      body.numeroTicket,
      body.idCliente,
      body.idTicket,
      userId,
    );
  }
}
