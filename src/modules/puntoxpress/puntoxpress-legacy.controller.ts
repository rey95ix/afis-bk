import {
  Controller,
  Post,
  Body,
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
  async handleLegacy(@Body() dto: LegacyRequestDto) {
    try {
      // Autenticación no requiere token
      if (dto.metodo === 'Autenticacion') {
        if (!dto.usuario || !dto.contrasena) {
          return { codigo: 2, mensaje: 'Faltan credenciales' };
        }
        const result = await this.authService.login(dto.usuario, dto.contrasena);
        return { codigo: 0, ...result };
      }

      // El resto de métodos requieren token
      const integrador = await this.validateLegacyToken(dto.token);

      switch (dto.metodo) {
        case 'BusquedaCorrelativo': {
          if (!dto.correlativo) return { codigo: 2, mensaje: 'Falta correlativo' };
          const facturas = await this.service.buscarPorCorrelativo(dto.correlativo);
          return facturas.map((f) => this.mapFacturaLegacy(f));
        }

        case 'BusquedaCodigoCliente': {
          if (!dto.codigo_cliente) return { codigo: 2, mensaje: 'Falta codigo_cliente' };
          const facturas = await this.service.buscarPorCodigoCliente(Number(dto.codigo_cliente));
          return facturas.map((f) => this.mapFacturaLegacy(f));
        }

        case 'BusquedaDUI': {
          if (!dto.dui) return { codigo: 2, mensaje: 'Falta dui' };
          const facturas = await this.service.buscarPorDui(dto.dui);
          return facturas.map((f) => this.mapFacturaLegacy(f));
        }

        case 'BusquedaNombre': {
          if (!dto.nombre) return { codigo: 2, mensaje: 'Falta nombre' };
          const facturas = await this.service.buscarPorNombre(dto.nombre);
          return facturas.map((f) => this.mapFacturaLegacy(f));
        }

        case 'AplicarPago': {
          if (!dto.id_factura || !dto.monto || !dto.colector) {
            return { codigo: 2, mensaje: 'Faltan campos requeridos: id_factura, monto, colector' };
          }
          const result = await this.service.aplicarPago(
            {
              id_factura_directa: Number(dto.id_factura),
              monto: Number(dto.monto),
              colector: dto.colector,
              referencia: dto.referencia,
            },
            integrador.id_integrador,
          );
          return { codigo: 0, ...result };
        }

        case 'AnularPago': {
          if (!dto.id_pago || !dto.motivo) {
            return { codigo: 2, mensaje: 'Faltan campos requeridos: id_pago, motivo' };
          }
          const result = await this.service.anularPago(
            Number(dto.id_pago),
            { motivo: dto.motivo },
            integrador.id_integrador,
          );
          return { codigo: 0, ...result };
        }

        default:
          return { codigo: 3, mensaje: `Método "${dto.metodo}" no reconocido` };
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return { codigo: 1, mensaje: error.message };
      }
      if (error instanceof BadRequestException) {
        return { codigo: 2, mensaje: error.message };
      }
      return { codigo: 99, mensaje: error.message || 'Error interno' };
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
