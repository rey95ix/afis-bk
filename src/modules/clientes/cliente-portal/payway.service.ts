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
      idColector: Number(this.idColector),
      token: this.token,
      usuarioPlataforma: this.usuarioPlataforma,
      nombreTarjetahabiente: params.nombreTarjetahabiente,
      numeroTarjeta: tarjetaEncriptada,
      fechaExpiracion: params.fechaExpiracion,
      cvv2: cvv2Encriptado,
      monto: params.monto.toFixed(2),
      conceptoPago: params.conceptoPago,
      ipCliente: '190.150.114.158', //params.ipCliente || '0.0.0.0',
      usuarioCliente: params.usuarioCliente || 'PORTAL',
    });
    console.log('PayWayService realizarPago payload:', jsonPayload);
    console.log('PayWayService initialized with endpoint:', this.endpoint);
    console.log('PayWayService initialized with token:', this.token );
    console.log('PayWayService initialized with usuarioPlataforma:', this.usuarioPlataforma);
    console.log('PayWayService initialized with idColector:', this.idColector);
    console.log('PayWayService initialized with encryptionKey:', this.encryptionKey);
    try {
      const client = await soap.createClientAsync(this.endpoint);

      // The WSDL may declare an internal endpoint (e.g. localhost:8080).
      // Override it with the real service URL derived from the WSDL URL.
      const serviceUrl = this.endpoint.replace(/\?Wsdl$/i, '');
      client.setEndpoint(serviceUrl);

      const [result] = await client.realizarPagoAsync({ arg0: jsonPayload });
      this.logger.debug(`PayWay last request XML: ${client.lastRequest?.substring(0, 800)}`);

      const jsonStr = typeof result?.return === 'string' ? result.return : JSON.stringify(result?.return);
      this.logger.debug(`PayWay response: ${jsonStr?.substring(0, 200)}`);

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        this.logger.error(`PayWay: Failed to parse JSON: ${jsonStr?.substring(0, 200)}`);
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
