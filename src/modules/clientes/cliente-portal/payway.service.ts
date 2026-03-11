import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as soap from 'soap';
import type { PayWayPagoParams, PayWayResponse } from './interfaces/payway.interface';

@Injectable()
export class PayWayService {
  private readonly logger = new Logger(PayWayService.name);

  private readonly endpoint: string;
  private readonly token: string;
  private readonly usuarioPlataforma: string;
  private readonly idColector: string;
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>('PAYWAY_ENDPOINT', '');
    this.token = this.configService.get<string>('PAYWAY_TOKEN', '');
    this.usuarioPlataforma = this.configService.get<string>('PAYWAY_USUARIO_PLATAFORMA', '');
    this.idColector = this.configService.get<string>('PAYWAY_ID_COLECTOR', '');
    this.encryptionKey = this.configService.get<string>('PAYWAY_ENCRYPTION_KEY', '');
  }

  encryptCardData(plaintext: string): string {
    const key = Buffer.from(this.encryptionKey.padEnd(32, '\0').slice(0, 32), 'utf-8');
    const iv = Buffer.from('fedcba9876543210', 'utf-8');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    return encrypted.toString('base64');
  }

  async realizarPago(params: PayWayPagoParams): Promise<PayWayResponse> {
    const tarjetaEncriptada = this.encryptCardData(params.numeroTarjeta);
    const cvv2Encriptado = this.encryptCardData(params.cvv2);
    const terminacionTarjeta = params.numeroTarjeta.slice(-4);

    const jsonPayload = JSON.stringify({
      token: this.token,
      idColector: Number(this.idColector),
      ipCliente: params.ipCliente,
      usuarioCliente: params.usuarioCliente || 'PORTAL',
      datosUsuarioInterno: {
        usuarioPlataforma: this.usuarioPlataforma,
      },
      datosServicio: {
        monto: params.monto.toFixed(2),
        conceptoPago: params.conceptoPago,
      },
      datosMedioPago: {
        principal: {
          nombreTarjetahabiente: params.nombreTarjetahabiente,
          fechaExpiracion: params.fechaExpiracion,
          numeroTarjeta: tarjetaEncriptada,
          cvv2: cvv2Encriptado,
        },
      },
      datosAuxiliares: {
        datoAuxiliar1: '',
        datoAuxiliar2: '',
        datoAuxiliar3: '',
        datoAuxiliar4: '',
      },
    });

    try {
      const client = await soap.createClientAsync(this.endpoint);

      // The WSDL may declare an internal endpoint (e.g. localhost:8080).
      // Override it with the real service URL derived from the WSDL URL.
      const serviceUrl = this.endpoint.replace(/\?Wsdl$/i, '');
      client.setEndpoint(serviceUrl);

      const [result] = await client.realizarPagoAsync({ jsonRequest: jsonPayload });
      this.logger.debug(`PayWay last request XML: ${client.lastRequest?.substring(0, 800)}`);

      const jsonStr = typeof result?.return === 'string' ? result.return : JSON.stringify(result?.return);
      this.logger.debug(`PayWay response: ${jsonStr}`);

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        this.logger.error(`PayWay: Failed to parse JSON: ${jsonStr }`);
        return {
          exitoso: false,
          codigoRetorno: '99',
          mensajeRetorno: 'Respuesta invalida del gateway de pago',
        };
      }

      const codigoRetorno = String(parsed.codigoRetorno || parsed.codigo_retorno || '99');
      const exitoso = codigoRetorno === '00';

      return {
        exitoso,
        codigoRetorno,
        mensajeRetorno: parsed.mensajeRetorno || parsed.mensaje_retorno || '',
        numeroAutorizacion: exitoso ? (parsed.numeroAutorizacion || parsed.numero_autorizacion || null) : null,
        numeroReferencia: parsed.numeroReferencia || parsed.numero_referencia || null,
        terminacionTarjeta,
        fechaTransaccion: parsed.fechaTransaccion || parsed.fecha_transaccion || null,
      };
    } catch (error) {
      this.logger.error(`PayWay SOAP call failed: ${error.message}`);
      if (error.body) this.logger.debug(`PayWay fault response: ${error.body?.substring(0, 800)}`);
      return {
        exitoso: false,
        codigoRetorno: '99',
        mensajeRetorno: 'Error de comunicacion con el gateway de pago',
      };
    }
  }
}
