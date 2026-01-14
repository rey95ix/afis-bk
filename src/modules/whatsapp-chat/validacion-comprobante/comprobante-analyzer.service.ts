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
4. Identifica el BANCO emisor (ej: BAC, Bancoagrícola, Davivienda, Cuscatlán, Banco Promerica, Banco Industrial, etc.)
5. Extrae CUENTA ORIGEN (últimos 4 dígitos si están visibles, formato ****XXXX)
6. Extrae CUENTA DESTINO (últimos 4 dígitos si están visibles)
7. Extrae NOMBRE DEL TITULAR de la cuenta origen

Si algún campo no es legible o no existe en la imagen, usa null.
Evalúa tu confianza general:
- "alta": todos los campos principales (monto, referencia, fecha) son claramente legibles
- "media": algunos campos son difíciles de leer pero identificables
- "baja": imagen borrosa o de mala calidad

Responde ÚNICAMENTE con JSON válido, sin markdown ni backticks:
{"monto": 150.00, "fecha_transaccion": "2025-01-14", "numero_referencia": "ABC123456", "banco": "BAC", "cuenta_origen": "****5678", "cuenta_destino": "****1234", "nombre_titular": "Juan Pérez", "confianza": "alta"}`;

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
      confianza: this.parseConfianza(data.confianza),
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
      confianza,
    };
  }
}
