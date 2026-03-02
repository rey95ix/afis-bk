import { Injectable, Logger } from '@nestjs/common';
import { OpenaiService } from '../../openai/openai.service';
import { ComprobanteExtractionResult } from './dto/comprobante-extraction.dto';

@Injectable()
export class ComprobanteAnalyzerService {
  private readonly logger = new Logger(ComprobanteAnalyzerService.name);

  /**
   * Prompt optimizado para extracción de datos de comprobantes bancarios salvadoreños
   */
  private readonly EXTRACTION_PROMPT = `Analiza esta imagen de comprobante de transferencia bancaria de El Salvador.

INSTRUCCIONES:
1. Extrae el MONTO transferido (número decimal, sin símbolos de moneda)
2. Extrae la FECHA de la transacción (formato YYYY-MM-DD)
3. Extrae el NÚMERO DE REFERENCIA o comprobante
4. Detecta si es una TRANSFERENCIA 365 (Transfer 365, Transferencia 365, ACH o transferencia interbancaria). Si menciona "Transfer 365", "Transferencia 365", "ACH" o indica que es una transferencia entre bancos diferentes, marca es_transferencia_365 como true.
5. Identifica el BANCO DESTINO (banco receptor/beneficiario donde se recibe el pago). Este es el campo "banco". Para transferencias 365, es el banco que RECIBE el dinero. Si no puedes determinarlo, usa null.
6. Identifica el BANCO ORIGEN (banco emisor/desde donde se envía). Solo relevante para transferencias 365. Si no es Transfer 365 o no puedes determinarlo, usa null.
7. Extrae CUENTA ORIGEN (últimos 4 dígitos si están visibles, formato ****XXXX)
8. Extrae CUENTA DESTINO: el número de cuenta COMPLETO del beneficiario/receptor si es visible en la imagen. Si solo se ven dígitos parciales, extrae lo que sea visible (ej: ****1234). Prioriza el número completo.
9. Extrae NOMBRE DEL TITULAR de la cuenta origen
10. Extrae el NOMBRE DEL CLIENTE si se proporciona texto adicional del operador. Este es diferente del nombre_titular (que viene de la imagen). Si no hay texto o no se menciona nombre de cliente, usa null.

Si algún campo no es legible o no existe en la imagen, usa null.
Evalúa tu confianza general:
- "alta": todos los campos principales (monto, referencia, fecha) son claramente legibles
- "media": algunos campos son difíciles de leer pero identificables
- "baja": imagen borrosa o de mala calidad

Responde ÚNICAMENTE con JSON válido, sin markdown ni backticks:
{"monto": 150.00, "fecha_transaccion": "2025-01-14", "numero_referencia": "ABC123456", "banco": "Bancoagrícola", "banco_origen": "BAC", "es_transferencia_365": true, "cuenta_origen": "****5678", "cuenta_destino": "00112345678", "nombre_titular": "Juan Pérez", "nombre_cliente": "Maria Lopez", "confianza": "alta"}`;

  constructor(private readonly openaiService: OpenaiService) {}

  /**
   * Extrae los datos de un comprobante bancario usando GPT-4 Vision
   * @param imageBuffer Buffer de la imagen del comprobante
   * @param mimeType Tipo MIME de la imagen
   * @returns Datos extraídos del comprobante
   */
  async extractComprobanteData(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
  ): Promise<ComprobanteExtractionResult> {
    // Verificar disponibilidad de OpenAI
    if (!this.openaiService.isAvailable()) {
      this.logger.warn('OpenAI no está configurado para análisis de comprobantes');
      return this.getEmptyResult('baja');
    }

    try {
      this.logger.log('Iniciando extracción de datos de comprobante bancario con GPT-4 Vision...');

      const response = await this.openaiService.analyzeImage(
        imageBuffer,
        this.EXTRACTION_PROMPT,
        mimeType,
      );

      this.logger.debug(`Respuesta de OpenAI (Comprobante): ${response}`);

      return this.parseResponse(response);
    } catch (error) {
      this.logger.error(`Error al analizar comprobante bancario: ${error.message}`);
      return this.getEmptyResult('baja');
    }
  }

  /**
   * Extrae datos de comprobante bancario a partir de múltiples imágenes y texto contextual
   * @param images Array de imágenes (buffer + mimeType)
   * @param textContext Texto adicional recopilado de mensajes de texto o captions
   */
  async extractComprobanteDataMulti(
    images: Array<{ buffer: Buffer; mimeType: string }>,
    textContext: string | null,
  ): Promise<ComprobanteExtractionResult> {
    if (!this.openaiService.isAvailable()) {
      this.logger.warn('OpenAI no está configurado para análisis de comprobantes');
      return this.getEmptyResult('baja');
    }

    try {
      const imageCount = images.length;
      let prompt = `Analiza estas ${imageCount} imágenes de comprobante(s) de transferencia bancaria de El Salvador. Las imágenes pueden ser partes del mismo comprobante o comprobantes complementarios. Combina la información de TODAS las imágenes para extraer los datos completos.`;

      if (textContext) {
        prompt += `\nEl texto adicional del cliente se proporciona aparte. Úsalo para:
1. Extraer el NOMBRE DEL CLIENTE (nombre_cliente) si se menciona un nombre de persona.
2. Como referencia complementaria para datos financieros, priorizando las imágenes.`;
      }

      prompt += `\n\n${this.EXTRACTION_PROMPT.replace('Analiza esta imagen de comprobante de transferencia bancaria de El Salvador.\n\n', '')}`;

      this.logger.log(`Iniciando extracción multi-imagen (${imageCount} imágenes) con GPT-4 Vision...`);

      const response = await this.openaiService.analyzeMultipleImages(
        images,
        textContext,
        prompt,
      );

      this.logger.debug(`Respuesta de OpenAI (Comprobante Multi): ${response}`);

      return this.parseResponse(response);
    } catch (error) {
      this.logger.error(`Error al analizar comprobante multi-imagen: ${error.message}`);
      return this.getEmptyResult('baja');
    }
  }

  /**
   * Parsea la respuesta de OpenAI
   */
  private parseResponse(response: string): ComprobanteExtractionResult {
    try {
      // Intentar parsear directamente
      const data = JSON.parse(response);
      return this.validateAndNormalize(data);
    } catch {
      // Intentar remover markdown si existe
      try {
        const cleanResponse = response
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const data = JSON.parse(cleanResponse);
        return this.validateAndNormalize(data);
      } catch (error) {
        this.logger.warn(`No se pudo parsear respuesta de OpenAI: ${response}`);
        return this.getEmptyResult('baja');
      }
    }
  }

  /**
   * Valida y normaliza los datos extraídos
   */
  private validateAndNormalize(data: any): ComprobanteExtractionResult {
    return {
      monto: typeof data.monto === 'number' ? data.monto : null,
      fecha_transaccion: this.validateDate(data.fecha_transaccion),
      numero_referencia: data.numero_referencia || null,
      banco: data.banco || null,
      cuenta_origen: data.cuenta_origen || null,
      cuenta_destino: data.cuenta_destino || null,
      nombre_titular: data.nombre_titular || null,
      nombre_cliente: data.nombre_cliente || null,
      confianza: this.parseConfianza(data.confianza),
      es_transferencia_365: data.es_transferencia_365 === true,
      banco_origen: data.banco_origen || null,
    };
  }

  /**
   * Valida el formato de fecha YYYY-MM-DD
   */
  private validateDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return null;

    // Validar que sea una fecha válida
    const parsedDate = new Date(dateStr);
    return !isNaN(parsedDate.getTime()) ? dateStr : null;
  }

  /**
   * Parsea y valida el nivel de confianza
   */
  private parseConfianza(confianza: string): 'alta' | 'media' | 'baja' {
    const normalized = confianza?.toLowerCase();
    if (normalized === 'alta') return 'alta';
    if (normalized === 'media') return 'media';
    return 'baja';
  }

  /**
   * Retorna un resultado vacío con la confianza indicada
   */
  private getEmptyResult(confianza: 'alta' | 'media' | 'baja'): ComprobanteExtractionResult {
    return {
      monto: null,
      fecha_transaccion: null,
      numero_referencia: null,
      banco: null,
      cuenta_origen: null,
      cuenta_destino: null,
      nombre_titular: null,
      nombre_cliente: null,
      confianza,
      es_transferencia_365: false,
      banco_origen: null,
    };
  }
}
