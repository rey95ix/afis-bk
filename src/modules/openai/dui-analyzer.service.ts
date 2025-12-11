// src/modules/openai/dui-analyzer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OpenaiService } from './openai.service';

export interface DuiExtractionResult {
  dui_extraido: string | null;
  confianza: 'alta' | 'media' | 'baja';
  mensaje: string;
}

export interface DuiValidationResult {
  coincide: boolean;
  dui_extraido: string | null;
  dui_esperado: string;
  confianza: 'alta' | 'media' | 'baja';
  mensaje: string;
  estado_validacion: 'VALIDADO' | 'NO_COINCIDE' | 'NO_DETECTADO' | 'ERROR_IA';
}

export interface ReciboExtractionResult {
  numero_contrato: string | null;
  direccion: string | null;
  tipo_servicio: 'ENERGIA' | 'AGUA' | 'DESCONOCIDO';
  confianza: 'alta' | 'media' | 'baja';
  mensaje: string;
}

@Injectable()
export class DuiAnalyzerService {
  private readonly logger = new Logger(DuiAnalyzerService.name);

  // Prompt optimizado para extracción de DUI
  private readonly DUI_EXTRACTION_PROMPT = `Analiza esta imagen de un DUI (Documento Único de Identidad) de El Salvador.

INSTRUCCIONES:
1. Busca el número de DUI que tiene el formato "########-#" (8 dígitos, un guión, y 1 dígito verificador)
2. El DUI generalmente aparece en la parte frontal del documento, cerca de la foto o en un lugar destacado
3. El número puede estar etiquetado como "Numero Único de Identidad", "DUI", "No. DUI", "Número" o similar

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks:
{"dui_encontrado": "12345678-9", "confianza": "alta"}

Si no encuentras el DUI:
{"dui_encontrado": null, "confianza": "baja"}

Niveles de confianza:
- "alta": El número es claramente legible y tiene el formato correcto
- "media": El número es parcialmente legible o hay incertidumbre
- "baja": No se puede leer o no se encontró`;

  // Prompt optimizado para extracción de datos de recibo de servicio público
  private readonly RECIBO_EXTRACTION_PROMPT = `Analiza esta imagen de un recibo de servicio público de El Salvador.
Puede ser un recibo de energía eléctrica (CAESS, DELSUR, EEO, CLESA, AES) o de agua (ANDA).

INSTRUCCIONES:
1. Busca el "Número de Contrato", "NC", "NIC", "No. Contrato", "Contrato No.", "Número de Suministro", "NIS" o similar
2. Busca la "Dirección" del suministro, instalación o del inmueble
3. La dirección puede incluir: calle, número, colonia, municipio, departamento
4. Identifica si es un recibo de energía eléctrica o de agua

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks:
{"numero_contrato": "123456789", "direccion": "Calle Principal #123, Col. Centro, San Salvador", "tipo_servicio": "ENERGIA", "confianza": "alta"}

Si no encuentras algún dato, usa null:
{"numero_contrato": null, "direccion": null, "tipo_servicio": "DESCONOCIDO", "confianza": "baja"}

Valores para tipo_servicio: "ENERGIA", "AGUA", "DESCONOCIDO"
Niveles de confianza: "alta", "media", "baja"`;

  constructor(private readonly openaiService: OpenaiService) {}

  /**
   * Extrae el número de DUI de una imagen
   * @param imageBuffer Buffer de la imagen del DUI
   * @param mimeType Tipo MIME de la imagen
   */
  async extractDuiFromImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
  ): Promise<DuiExtractionResult> {
    // Verificar si OpenAI está disponible
    if (!this.openaiService.isAvailable()) {
      this.logger.warn('OpenAI no está disponible para análisis de DUI');
      return {
        dui_extraido: null,
        confianza: 'baja',
        mensaje: 'El servicio de validación por IA no está disponible',
      };
    }

    try {
      this.logger.log('Iniciando extracción de DUI con GPT-4 Vision...');

      const response = await this.openaiService.analyzeImage(
        imageBuffer,
        this.DUI_EXTRACTION_PROMPT,
        mimeType,
      );

      this.logger.debug(`Respuesta de OpenAI: ${response}`);

      // Parsear la respuesta JSON
      const result = this.parseOpenAIResponse(response);

      if (result.dui_encontrado) {
        // Validar formato del DUI extraído
        if (this.isValidDuiFormat(result.dui_encontrado)) {
          const confianza = this.parseConfianza(result.confianza);
          this.logger.log(`DUI extraído: ${result.dui_encontrado} (confianza: ${confianza})`);
          return {
            dui_extraido: result.dui_encontrado,
            confianza,
            mensaje: `DUI detectado exitosamente`,
          };
        } else {
          this.logger.warn(`DUI extraído con formato inválido: ${result.dui_encontrado}`);
          return {
            dui_extraido: result.dui_encontrado,
            confianza: 'baja',
            mensaje: 'El número detectado no tiene el formato correcto de DUI',
          };
        }
      }

      return {
        dui_extraido: null,
        confianza: 'baja',
        mensaje: 'No se pudo detectar el número de DUI en la imagen',
      };
    } catch (error) {
      this.logger.error(`Error al extraer DUI: ${error.message}`);
      return {
        dui_extraido: null,
        confianza: 'baja',
        mensaje: `Error en el análisis: ${error.message}`,
      };
    }
  }

  /**
   * Valida que el DUI de la imagen coincida con el DUI esperado
   * @param imageBuffer Buffer de la imagen del DUI
   * @param duiEsperado DUI registrado del cliente
   * @param mimeType Tipo MIME de la imagen
   */
  async validarDuiConImagen(
    imageBuffer: Buffer,
    duiEsperado: string,
    mimeType: string = 'image/jpeg',
  ): Promise<DuiValidationResult> {
    // Si OpenAI no está disponible
    if (!this.openaiService.isAvailable()) {
      return {
        coincide: false,
        dui_extraido: null,
        dui_esperado: duiEsperado,
        confianza: 'baja',
        mensaje: 'El servicio de validación por IA no está disponible',
        estado_validacion: 'ERROR_IA',
      };
    }

    try {
      // Extraer DUI de la imagen
      const extraction = await this.extractDuiFromImage(imageBuffer, mimeType);

      if (!extraction.dui_extraido) {
        return {
          coincide: false,
          dui_extraido: null,
          dui_esperado: duiEsperado,
          confianza: extraction.confianza,
          mensaje: extraction.mensaje,
          estado_validacion: 'NO_DETECTADO',
        };
      }

      // Normalizar ambos DUIs para comparación
      const duiExtraidoNormalizado = this.normalizeDui(extraction.dui_extraido);
      const duiEsperadoNormalizado = this.normalizeDui(duiEsperado);

      const coincide = duiExtraidoNormalizado === duiEsperadoNormalizado;

      if (coincide) {
        this.logger.log(`Validación exitosa: DUI coincide (${duiEsperado})`);
        return {
          coincide: true,
          dui_extraido: extraction.dui_extraido,
          dui_esperado: duiEsperado,
          confianza: extraction.confianza,
          mensaje: 'El DUI de la imagen coincide con el registrado',
          estado_validacion: 'VALIDADO',
        };
      } else {
        this.logger.warn(
          `Validación fallida: DUI no coincide. Esperado: ${duiEsperado}, Extraído: ${extraction.dui_extraido}`,
        );
        return {
          coincide: false,
          dui_extraido: extraction.dui_extraido,
          dui_esperado: duiEsperado,
          confianza: extraction.confianza,
          mensaje: `El DUI de la imagen (${extraction.dui_extraido}) no coincide con el registrado (${duiEsperado})`,
          estado_validacion: 'NO_COINCIDE',
        };
      }
    } catch (error) {
      this.logger.error(`Error en validación de DUI: ${error.message}`);
      return {
        coincide: false,
        dui_extraido: null,
        dui_esperado: duiEsperado,
        confianza: 'baja',
        mensaje: `Error en la validación: ${error.message}`,
        estado_validacion: 'ERROR_IA',
      };
    }
  }

  /**
   * Parsea la respuesta de OpenAI a JSON
   */
  private parseOpenAIResponse(response: string): { dui_encontrado: string | null; confianza: string } {
    try {
      // Limpiar la respuesta de posibles caracteres extra
      let cleanResponse = response.trim();

      // Remover backticks de markdown si existen
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```/g, '');
      }

      cleanResponse = cleanResponse.trim();

      const parsed = JSON.parse(cleanResponse);
      return {
        dui_encontrado: parsed.dui_encontrado || null,
        confianza: parsed.confianza || 'media',
      };
    } catch (error) {
      this.logger.error(`Error al parsear respuesta de OpenAI: ${error.message}`);
      this.logger.debug(`Respuesta original: ${response}`);

      // Intentar extraer DUI con regex como fallback
      const duiMatch = response.match(/\d{8}-\d/);
      if (duiMatch) {
        return {
          dui_encontrado: duiMatch[0],
          confianza: 'baja',
        };
      }

      return {
        dui_encontrado: null,
        confianza: 'baja',
      };
    }
  }

  /**
   * Valida el formato del DUI salvadoreño
   * Formato: ########-# (8 dígitos, guión, 1 dígito)
   */
  private isValidDuiFormat(dui: string): boolean {
    const duiRegex = /^\d{8}-\d$/;
    return duiRegex.test(dui);
  }

  /**
   * Normaliza el DUI para comparación
   * Remueve espacios y asegura formato consistente
   */
  private normalizeDui(dui: string): string {
    return dui.replace(/\s/g, '').toUpperCase();
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

  // ==================== ANÁLISIS DE RECIBO ====================

  /**
   * Extrae datos de un recibo de servicio público (luz o agua)
   * @param imageBuffer Buffer de la imagen del recibo
   * @param mimeType Tipo MIME de la imagen
   */
  async extractReciboData(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
  ): Promise<ReciboExtractionResult> {
    // Verificar si OpenAI está disponible
    if (!this.openaiService.isAvailable()) {
      this.logger.warn('OpenAI no está disponible para análisis de recibo');
      return {
        numero_contrato: null,
        direccion: null,
        tipo_servicio: 'DESCONOCIDO',
        confianza: 'baja',
        mensaje: 'El servicio de validación por IA no está disponible',
      };
    }

    try {
      this.logger.log('Iniciando extracción de datos de recibo con GPT-4 Vision...');

      const response = await this.openaiService.analyzeImage(
        imageBuffer,
        this.RECIBO_EXTRACTION_PROMPT,
        mimeType,
      );

      this.logger.debug(`Respuesta de OpenAI (Recibo): ${response}`);

      // Parsear la respuesta JSON
      const result = this.parseReciboResponse(response);

      const confianza = this.parseConfianza(result.confianza);
      const tipoServicio = this.parseTipoServicio(result.tipo_servicio);

      if (result.numero_contrato || result.direccion) {
        this.logger.log(
          `Recibo analizado - NC: ${result.numero_contrato || 'N/A'}, ` +
          `Dirección: ${result.direccion ? result.direccion.substring(0, 50) + '...' : 'N/A'}, ` +
          `Tipo: ${tipoServicio}, Confianza: ${confianza}`,
        );

        return {
          numero_contrato: result.numero_contrato,
          direccion: result.direccion,
          tipo_servicio: tipoServicio,
          confianza,
          mensaje: 'Datos del recibo extraídos exitosamente',
        };
      }

      return {
        numero_contrato: null,
        direccion: null,
        tipo_servicio: tipoServicio,
        confianza: 'baja',
        mensaje: 'No se pudieron extraer datos del recibo',
      };
    } catch (error) {
      this.logger.error(`Error al extraer datos del recibo: ${error.message}`);
      return {
        numero_contrato: null,
        direccion: null,
        tipo_servicio: 'DESCONOCIDO',
        confianza: 'baja',
        mensaje: `Error en el análisis: ${error.message}`,
      };
    }
  }

  /**
   * Parsea la respuesta de OpenAI para datos de recibo
   */
  private parseReciboResponse(response: string): {
    numero_contrato: string | null;
    direccion: string | null;
    tipo_servicio: string;
    confianza: string;
  } {
    try {
      // Limpiar la respuesta de posibles caracteres extra
      let cleanResponse = response.trim();

      // Remover backticks de markdown si existen
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```/g, '');
      }

      cleanResponse = cleanResponse.trim();

      const parsed = JSON.parse(cleanResponse);
      return {
        numero_contrato: parsed.numero_contrato || null,
        direccion: parsed.direccion || null,
        tipo_servicio: parsed.tipo_servicio || 'DESCONOCIDO',
        confianza: parsed.confianza || 'media',
      };
    } catch (error) {
      this.logger.error(`Error al parsear respuesta de recibo: ${error.message}`);
      this.logger.debug(`Respuesta original: ${response}`);

      return {
        numero_contrato: null,
        direccion: null,
        tipo_servicio: 'DESCONOCIDO',
        confianza: 'baja',
      };
    }
  }

  /**
   * Parsea y valida el tipo de servicio
   */
  private parseTipoServicio(tipo: string): 'ENERGIA' | 'AGUA' | 'DESCONOCIDO' {
    const normalized = tipo?.toUpperCase();
    if (normalized === 'ENERGIA') return 'ENERGIA';
    if (normalized === 'AGUA') return 'AGUA';
    return 'DESCONOCIDO';
  }
}
