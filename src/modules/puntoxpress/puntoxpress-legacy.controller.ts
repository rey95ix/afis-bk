import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { SkipTransform } from 'src/common/intersectors';
import { PuntoXpressService } from './puntoxpress.service';
import { PuntoXpressAuthService } from './puntoxpress-auth.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { LegacyRequestDto } from './dto';
import { JwtPuntoXpressPayload } from './interfaces';

@SkipTransform()
@ApiTags('PuntoXpress - Legacy')
@Controller('puntoxpress')
export class PuntoXpressLegacyController {
  constructor(
    private readonly service: PuntoXpressService,
    private readonly authService: PuntoXpressAuthService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private mapFacturaLegacy(f: any) {
    const ESTADO_MAP: Record<string, string> = {
      'PENDIENTE': 'Pendiente de pago',
      'PAGADA_PARCIAL': 'Pagada parcialmente',
      'VENCIDA': 'Vencida',
      'PAGADA_TOTAL': 'Pagada',
    };

    return {
      id_factura: String(f.id_factura),
      fecha_vencimiento: f.fecha_vencimiento,
      numero_factura: f.numero_factura,
      periodo_facturado: f.periodo_facturado,
      monto: (Number(f.monto) + Number(f.monto_mora)).toFixed(2),
      monto_mora: Number(f.monto_mora).toFixed(2),
      saldo_pendiente: Number(f.saldo_pendiente).toFixed(2),
      cliente: f.cliente,
      vencida: String(f.vencida),
      estado_factura: ESTADO_MAP[f.estado_factura] || f.estado_factura,
      resolucion: f.resolucion,
      serie: f.serie,
    };
  }

  @Post('legacy')
  @ApiOperation({
    summary: 'Endpoint legacy compatible con API anterior',
    description: 'Acepta un objeto con campo "metodo" y enruta internamente',
  })
  @ApiResponse({ status: 200, description: 'Respuesta según método invocado' })
  @HttpCode(200)
  async handleLegacy(@Body() dto: LegacyRequestDto, @Req() req: any) {
    const start = Date.now();
    const ip = req.ip || req.headers['x-forwarded-for']?.toString();
    const { token, contrasena, ...safeBody } = dto as any;

    let result: any;
    let codigoRespuesta: number | undefined;
    let errorMsg: string | undefined;

    try {
      // Autenticación no requiere token
      if (dto.metodo === 'Autenticacion') {
        if (!dto.usuario || !dto.contrasena) {
          result = { codigo: 2, mensaje: 'Faltan credenciales' };
          codigoRespuesta = 2;
          return result;
        }
        const authResult = await this.authService.login(dto.usuario, dto.contrasena);
        result = { codigo: 0, ...authResult };
        codigoRespuesta = 0;
        return result;
      }

      // El resto de métodos requieren token
      const integrador = await this.validateLegacyToken(dto.token);

      switch (dto.metodo) {
        case 'BusquedaCorrelativo': {
          if (!dto.correlativo) {
            result = { codigo: 2, mensaje: 'Falta correlativo' };
            codigoRespuesta = 2;
            return result;
          }
          const facturas = await this.service.buscarPorCorrelativo(dto.correlativo);
          result = facturas.map((f) => this.mapFacturaLegacy(f));
          codigoRespuesta = 0;
          return result;
        }

        case 'BusquedaCodigoCliente': {
          if (!dto.codigo_cliente) {
            result = { codigo: 2, mensaje: 'Falta codigo_cliente' };
            codigoRespuesta = 2;
            return result;
          }
          const facturas = await this.service.buscarPorCodigoCliente(Number(dto.codigo_cliente));
          result = facturas.map((f) => this.mapFacturaLegacy(f));
          codigoRespuesta = 0;
          return result;
        }

        case 'BusquedaDUI': {
          if (!dto.dui) {
            result = { codigo: 2, mensaje: 'Falta dui' };
            codigoRespuesta = 2;
            return result;
          }
          const facturas = await this.service.buscarPorDui(dto.dui);
          result = facturas.map((f) => this.mapFacturaLegacy(f));
          codigoRespuesta = 0;
          return result;
        }

        case 'BusquedaNombre': {
          if (!dto.nombre) {
            result = { codigo: 2, mensaje: 'Falta nombre' };
            codigoRespuesta = 2;
            return result;
          }
          const facturas = await this.service.buscarPorNombre(dto.nombre);
          result = facturas.map((f) => this.mapFacturaLegacy(f));
          codigoRespuesta = 0;
          return result;
        }

        case 'AplicarPago': {
          if (!dto.id_factura || !dto.monto || !dto.colector) {
            result = { codigo: 2, mensaje: 'Faltan campos requeridos: id_factura, monto, colector' };
            codigoRespuesta = 2;
            return result;
          }
          const pagoResult = await this.service.aplicarPago(
            {
              id_factura_directa: Number(dto.id_factura),
              monto: Number(dto.monto),
              colector: dto.colector,
              referencia: dto.referencia,
            },
            integrador.id_integrador,
          );
          result = { codigo: 0, ...pagoResult };
          codigoRespuesta = 0;
          return result;
        }

        case 'AnularPago': {
          if (!dto.id_pago || !dto.motivo) {
            result = { codigo: 2, mensaje: 'Faltan campos requeridos: id_pago, motivo' };
            codigoRespuesta = 2;
            return result;
          }
          const anularResult = await this.service.anularPago(
            Number(dto.id_pago),
            { motivo: dto.motivo },
            integrador.id_integrador,
          );
          result = { codigo: 0, ...anularResult };
          codigoRespuesta = 0;
          return result;
        }

        default:
          result = { codigo: 3, mensaje: `Método "${dto.metodo}" no reconocido` };
          codigoRespuesta = 3;
          return result;
      }
    } catch (error) {
      errorMsg = error.message || 'Error interno';
      if (error instanceof UnauthorizedException) {
        result = { codigo: 1, mensaje: error.message };
        codigoRespuesta = 1;
      } else if (error instanceof BadRequestException) {
        result = { codigo: 2, mensaje: error.message };
        codigoRespuesta = 2;
      } else {
        result = { codigo: 99, mensaje: errorMsg };
        codigoRespuesta = 99;
      }
      return result;
    } finally {
      this.prisma.puntoxpress_legacy_log.create({
        data: {
          metodo: dto.metodo,
          request_body: safeBody,
          response_body: result ?? null,
          codigo_respuesta: codigoRespuesta,
          ip,
          duracion_ms: Date.now() - start,
          error: errorMsg,
        },
      }).catch(() => {});
    }
  }

  private async validateLegacyToken(token?: string) {
    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }

    let payload: JwtPuntoXpressPayload;
    try {
      payload = this.jwtService.verify<JwtPuntoXpressPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (payload.type !== 'puntoxpress') {
      throw new UnauthorizedException('Token inválido');
    }

    const integrador = await this.prisma.puntoxpress_integrador.findUnique({
      where: { id_integrador: payload.id_integrador },
    });

    if (!integrador || !integrador.activo) {
      throw new UnauthorizedException('Integrador no autorizado o inactivo');
    }

    return integrador;
  }
}
