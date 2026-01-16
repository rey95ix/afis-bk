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
  colonia: string | null;        // Nombre de la colonia extraída
  municipio: string | null;      // Nombre del municipio extraído
  departamento: string | null;   // Nombre del departamento extraído
  tipo_servicio: 'ENERGIA' | 'AGUA' | 'DESCONOCIDO';
  confianza: 'alta' | 'media' | 'baja';
  mensaje: string;
}

export interface DuiFullExtractionResult {
  dui_extraido: string | null;
  nombre_completo: string | null;
  fecha_nacimiento: string | null; // formato YYYY-MM-DD
  confianza: 'alta' | 'media' | 'baja';
  mensaje: string;
}

export interface DuiTraseraExtractionResult {
  nit: string | null;           // Formato: 1234-567890-123-4
  estado_familiar: string | null; // SOLTERO, CASADO, VIUDO, DIVORCIADO, UNION LIBRE, etc.
  confianza: 'alta' | 'media' | 'baja';
  mensaje: string;
}

export type DocumentType = 'DUI_FRENTE' | 'DUI_TRASERA' | 'NIT_FRENTE' | 'NIT_TRASERA' | 'RECIBO' | 'FIRMA' | 'DESCONOCIDO';

export interface DocumentClassificationResult {
  tipo_documento: DocumentType;
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
4. IMPORTANTE: Identifica por separado la COLONIA de la dirección
   - Puede aparecer como "Col.", "Colonia", "Res.", "Residencial", "Urb.", "Urbanización", "Reparto", "Bo.", "Barrio"
   - Ejemplo: "Col. Escalón", "Residencial San Benito", "Urbanización Jardines"
5. IMPORTANTE: Identifica por separado el MUNICIPIO y DEPARTAMENTO de la dirección
   - Municipios de El Salvador: San Salvador, Santa Tecla, Mejicanos, Soyapango, Apopa, Ilopango, etc.
   - Departamentos de El Salvador: San Salvador, La Libertad, Santa Ana, San Miguel, Sonsonate, etc.
6. Identifica si es un recibo de energía eléctrica o de agua

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks:
{"numero_contrato": "123456789", "direccion": "Calle Principal #123", "colonia": "Escalón", "municipio": "San Salvador", "departamento": "San Salvador", "tipo_servicio": "ENERGIA", "confianza": "alta"}

Si no encuentras algún dato, usa null:
{"numero_contrato": null, "direccion": null, "colonia": null, "municipio": null, "departamento": null, "tipo_servicio": "DESCONOCIDO", "confianza": "baja"}

Valores para tipo_servicio: "ENERGIA", "AGUA", "DESCONOCIDO"
Niveles de confianza: "alta", "media", "baja"`;

  // Prompt para clasificación de tipo de documento
  private readonly DOCUMENT_CLASSIFICATION_PROMPT = `Analiza esta imagen y clasifica qué tipo de documento es.

TIPOS POSIBLES:
1. DUI_FRENTE - Parte frontal del Documento Único de Identidad de El Salvador (tiene foto, nombre, número DUI)
2. DUI_TRASERA - Parte trasera del DUI (tiene NIT, estado familiar, código de barras)
3. NIT_FRENTE - Tarjeta NIT del Ministerio de Hacienda de El Salvador (frontal)
4. NIT_TRASERA - Parte trasera de la tarjeta NIT
5. RECIBO - Recibo de servicio público (luz, agua, con números de cuenta y direcciones)
6. FIRMA - Imagen de una firma manuscrita (generalmente fondo blanco con firma en tinta)
7. DESCONOCIDO - No se puede identificar el tipo de documento

IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks:
{"tipo_documento": "DUI_FRENTE", "confianza": "alta"}

Niveles de confianza:
- "alta": El tipo de documento es claramente identificable
- "media": Hay algunas características del tipo de documento pero no es 100% seguro
- "baja": No se puede determinar con certeza el tipo de documento`;

  // Prompt para extracción de datos del DUI TRASERA (NIT, Estado Familiar)
  private readonly DUI_TRASERA_EXTRACTION_PROMPT = `Analiza esta imagen de la parte TRASERA de un DUI (Documento Único de Identidad) de El Salvador.

INSTRUCCIONES:
1. Busca el NIT (Número de Identificación Tributaria) que tiene formato "####-######-###-#" (4 dígitos, 6 dígitos, 3 dígitos, 1 dígito)
2. Busca el ESTADO FAMILIAR que puede aparecer como "Est. Familiar", "Estado Familiar", "EST. FAM." o similar
   Los valores posibles son: SOLTERO, SOLTERA, CASADO, CASADA, VIUDO, VIUDA, DIVORCIADO, DIVORCIADA, UNION LIBRE

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks:
{"nit": "1234-567890-123-4", "estado_familiar": "SOLTERO", "confianza": "alta"}

Si no encuentras algún dato, usa null para ese campo:
{"nit": null, "estado_familiar": "CASADO", "confianza": "media"}

Niveles de confianza:
- "alta": Los datos son claramente legibles
- "media": Algunos datos son parcialmente legibles o hay incertidumbre
- "baja": No se pueden leer los datos o hay mucha incertidumbre`;

  // Prompt para extracción completa de datos del DUI (nombre, fecha nacimiento, número)
  private readonly DUI_FULL_EXTRACTION_PROMPT = `Analiza esta imagen de un DUI (Documento Único de Identidad) de El Salvador.

INSTRUCCIONES:
1. Busca el número de DUI que tiene el formato "########-#" (8 dígitos, un guión, y 1 dígito verificador)
2. Busca el NOMBRE COMPLETO del titular del documento (generalmente aparece como "NOMBRE" o "NOMBRES" y "APELLIDOS")
3. Busca la FECHA DE NACIMIENTO (puede aparecer como "F. NACIMIENTO", "NACIMIENTO", "FECHA NAC." o similar)

FORMATO DE RESPUESTA - Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks:
{"dui_encontrado": "12345678-9", "nombre_completo": "JUAN CARLOS PEREZ GARCIA", "fecha_nacimiento": "1990-05-15", "confianza": "alta"}

NOTAS IMPORTANTES:
- El nombre debe estar en MAYÚSCULAS tal como aparece en el documento
- La fecha de nacimiento debe estar en formato YYYY-MM-DD (año-mes-día)
- Si la fecha está en formato DD/MM/YYYY o similar, conviértela a YYYY-MM-DD
- Si no encuentras algún dato, usa null para ese campo

Niveles de confianza:
- "alta": Todos los datos son claramente legibles
- "media": Algunos datos son parcialmente legibles
- "baja": No se pueden leer los datos o hay mucha incertidumbre`;

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
   * Extrae datos completos del DUI: número, nombre completo y fecha de nacimiento
   * @param imageBuffer Buffer de la imagen del DUI
   * @param mimeType Tipo MIME de la imagen
   */
  async extractFullDuiData(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
  ): Promise<DuiFullExtractionResult> {
    // Verificar si OpenAI está disponible
    if (!this.openaiService.isAvailable()) {
      this.logger.warn('OpenAI no está disponible para extracción completa de DUI');
      return {
        dui_extraido: null,
        nombre_completo: null,
        fecha_nacimiento: null,
        confianza: 'baja',
        mensaje: 'El servicio de validación por IA no está disponible',
      };
    }

    try {
      this.logger.log('Iniciando extracción completa de datos del DUI con GPT-4 Vision...');

      const response = await this.openaiService.analyzeImage(
        imageBuffer,
        this.DUI_FULL_EXTRACTION_PROMPT,
        mimeType,
      );

      this.logger.debug(`Respuesta de OpenAI (DUI Full): ${response}`);

      // Parsear la respuesta JSON
      const result = this.parseFullDuiResponse(response);
      const confianza = this.parseConfianza(result.confianza);

      // Validar formato del DUI si se extrajo
      let duiValido = result.dui_encontrado;
      if (duiValido && !this.isValidDuiFormat(duiValido)) {
        this.logger.warn(`DUI extraído con formato inválido: ${duiValido}`);
        duiValido = null;
      }

      // Validar formato de fecha si se extrajo
      let fechaValida = result.fecha_nacimiento;
      if (fechaValida && !this.isValidDateFormat(fechaValida)) {
        this.logger.warn(`Fecha extraída con formato inválido: ${fechaValida}`);
        fechaValida = null;
      }

      if (duiValido || result.nombre_completo || fechaValida) {
        this.logger.log(
          `DUI extraído: ${duiValido || 'N/A'}, ` +
          `Nombre: ${result.nombre_completo || 'N/A'}, ` +
          `Fecha Nac: ${fechaValida || 'N/A'} (confianza: ${confianza})`,
        );
        return {
          dui_extraido: duiValido,
          nombre_completo: result.nombre_completo,
          fecha_nacimiento: fechaValida,
          confianza,
          mensaje: 'Datos del DUI extraídos exitosamente',
        };
      }

      return {
        dui_extraido: null,
        nombre_completo: null,
        fecha_nacimiento: null,
        confianza: 'baja',
        mensaje: 'No se pudieron extraer datos del DUI',
      };
    } catch (error) {
      this.logger.error(`Error al extraer datos completos del DUI: ${error.message}`);
      return {
        dui_extraido: null,
        nombre_completo: null,
        fecha_nacimiento: null,
        confianza: 'baja',
        mensaje: `Error en el análisis: ${error.message}`,
      };
    }
  }

  /**
   * Extrae NIT y Estado Familiar de la parte trasera del DUI
   * @param imageBuffer Buffer de la imagen del DUI trasera
   * @param mimeType Tipo MIME de la imagen
   */
  async extractDuiTraseraData(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
  ): Promise<DuiTraseraExtractionResult> {
    // Verificar si OpenAI está disponible
    if (!this.openaiService.isAvailable()) {
      this.logger.warn('OpenAI no está disponible para extracción de DUI trasera');
      return {
        nit: null,
        estado_familiar: null,
        confianza: 'baja',
        mensaje: 'El servicio de validación por IA no está disponible',
      };
    }

    try {
      this.logger.log('Iniciando extracción de datos del DUI trasera con GPT-4 Vision...');

      const response = await this.openaiService.analyzeImage(
        imageBuffer,
        this.DUI_TRASERA_EXTRACTION_PROMPT,
        mimeType,
      );

      this.logger.debug(`Respuesta de OpenAI (DUI Trasera): ${response}`);

      // Parsear la respuesta JSON
      const result = this.parseDuiTraseraResponse(response);
      const confianza = this.parseConfianza(result.confianza);

      // Validar formato del NIT si se extrajo
      let nitValido = result.nit;
      if (nitValido && !this.isValidNitFormat(nitValido)) {
        this.logger.warn(`NIT extraído con formato inválido: ${nitValido}`);
        // No invalidamos el NIT, solo advertimos (el formato puede variar)
      }

      // Normalizar estado familiar
      let estadoFamiliarNormalizado = result.estado_familiar;
      if (estadoFamiliarNormalizado) {
        estadoFamiliarNormalizado = estadoFamiliarNormalizado.toUpperCase().trim();
      }

      if (nitValido || estadoFamiliarNormalizado) {
        this.logger.log(
          `DUI Trasera analizado - NIT: ${nitValido || 'N/A'}, ` +
          `Estado Familiar: ${estadoFamiliarNormalizado || 'N/A'} (confianza: ${confianza})`,
        );
        return {
          nit: nitValido,
          estado_familiar: estadoFamiliarNormalizado,
          confianza,
          mensaje: 'Datos del DUI trasera extraídos exitosamente',
        };
      }

      return {
        nit: null,
        estado_familiar: null,
        confianza: 'baja',
        mensaje: 'No se pudieron extraer datos del DUI trasera',
      };
    } catch (error) {
      this.logger.error(`Error al extraer datos del DUI trasera: ${error.message}`);
      return {
        nit: null,
        estado_familiar: null,
        confianza: 'baja',
        mensaje: `Error en el análisis: ${error.message}`,
      };
    }
  }

  /**
   * Parsea la respuesta de OpenAI para extracción del DUI trasera
   */
  private parseDuiTraseraResponse(response: string): {
    nit: string | null;
    estado_familiar: string | null;
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
        nit: parsed.nit || null,
        estado_familiar: parsed.estado_familiar || null,
        confianza: parsed.confianza || 'media',
      };
    } catch (error) {
      this.logger.error(`Error al parsear respuesta de DUI trasera: ${error.message}`);
      this.logger.debug(`Respuesta original: ${response}`);

      // Intentar extraer NIT con regex como fallback (formato: ####-######-###-#)
      const nitMatch = response.match(/\d{4}-\d{6}-\d{3}-\d/);
      return {
        nit: nitMatch ? nitMatch[0] : null,
        estado_familiar: null,
        confianza: 'baja',
      };
    }
  }

  /**
   * Valida el formato del NIT salvadoreño
   * Formato: ####-######-###-# (14 dígitos con guiones)
   */
  private isValidNitFormat(nit: string): boolean {
    const nitRegex = /^\d{4}-\d{6}-\d{3}-\d$/;
    return nitRegex.test(nit);
  }

  /**
   * Parsea la respuesta de OpenAI para extracción completa del DUI
   */
  private parseFullDuiResponse(response: string): {
    dui_encontrado: string | null;
    nombre_completo: string | null;
    fecha_nacimiento: string | null;
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
        dui_encontrado: parsed.dui_encontrado || null,
        nombre_completo: parsed.nombre_completo || null,
        fecha_nacimiento: parsed.fecha_nacimiento || null,
        confianza: parsed.confianza || 'media',
      };
    } catch (error) {
      this.logger.error(`Error al parsear respuesta de DUI completo: ${error.message}`);
      this.logger.debug(`Respuesta original: ${response}`);

      // Intentar extraer DUI con regex como fallback
      const duiMatch = response.match(/\d{8}-\d/);
      return {
        dui_encontrado: duiMatch ? duiMatch[0] : null,
        nombre_completo: null,
        fecha_nacimiento: null,
        confianza: 'baja',
      };
    }
  }

  /**
   * Valida el formato de fecha YYYY-MM-DD
   */
  private isValidDateFormat(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;

    // Validar que sea una fecha válida
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
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
        colonia: null,
        municipio: null,
        departamento: null,
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
          `Colonia: ${result.colonia || 'N/A'}, ` +
          `Municipio: ${result.municipio || 'N/A'}, ` +
          `Departamento: ${result.departamento || 'N/A'}, ` +
          `Tipo: ${tipoServicio}, Confianza: ${confianza}`,
        );

        return {
          numero_contrato: result.numero_contrato,
          direccion: result.direccion,
          colonia: result.colonia,
          municipio: result.municipio,
          departamento: result.departamento,
          tipo_servicio: tipoServicio,
          confianza,
          mensaje: 'Datos del recibo extraídos exitosamente',
        };
      }

      return {
        numero_contrato: null,
        direccion: null,
        colonia: null,
        municipio: null,
        departamento: null,
        tipo_servicio: tipoServicio,
        confianza: 'baja',
        mensaje: 'No se pudieron extraer datos del recibo',
      };
    } catch (error) {
      this.logger.error(`Error al extraer datos del recibo: ${error.message}`);
      return {
        numero_contrato: null,
        direccion: null,
        colonia: null,
        municipio: null,
        departamento: null,
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
    colonia: string | null;
    municipio: string | null;
    departamento: string | null;
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
        colonia: parsed.colonia || null,
        municipio: parsed.municipio || null,
        departamento: parsed.departamento || null,
        tipo_servicio: parsed.tipo_servicio || 'DESCONOCIDO',
        confianza: parsed.confianza || 'media',
      };
    } catch (error) {
      this.logger.error(`Error al parsear respuesta de recibo: ${error.message}`);
      this.logger.debug(`Respuesta original: ${response}`);

      return {
        numero_contrato: null,
        direccion: null,
        colonia: null,
        municipio: null,
        departamento: null,
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

  // ==================== CLASIFICACIÓN DE DOCUMENTOS ====================

  /**
   * Clasifica el tipo de documento usando IA
   * Útil para migración de documentos desde sistemas legacy
   * @param imageBuffer Buffer de la imagen del documento
   * @param mimeType Tipo MIME de la imagen
   */
  async classifyDocument(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
  ): Promise<DocumentClassificationResult> {
    // Verificar si OpenAI está disponible
    if (!this.openaiService.isAvailable()) {
      this.logger.warn('OpenAI no está disponible para clasificación de documento');
      return {
        tipo_documento: 'DESCONOCIDO',
        confianza: 'baja',
        mensaje: 'El servicio de IA no está disponible',
      };
    }

    try {
      this.logger.log('Iniciando clasificación de documento con GPT-4 Vision...');

      const response = await this.openaiService.analyzeImage(
        imageBuffer,
        this.DOCUMENT_CLASSIFICATION_PROMPT,
        mimeType,
      );

      this.logger.debug(`Respuesta de OpenAI (Clasificación): ${response}`);

      // Parsear la respuesta JSON
      const result = this.parseDocumentClassificationResponse(response);

      this.logger.log(
        `Documento clasificado: ${result.tipo_documento} (confianza: ${result.confianza})`,
      );

      return {
        tipo_documento: result.tipo_documento,
        confianza: this.parseConfianza(result.confianza),
        mensaje: `Documento clasificado como ${result.tipo_documento}`,
      };
    } catch (error) {
      this.logger.error(`Error al clasificar documento: ${error.message}`);
      return {
        tipo_documento: 'DESCONOCIDO',
        confianza: 'baja',
        mensaje: `Error en la clasificación: ${error.message}`,
      };
    }
  }

  /**
   * Parsea la respuesta de OpenAI para clasificación de documentos
   */
  private parseDocumentClassificationResponse(response: string): {
    tipo_documento: DocumentType;
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
      const tipoDocumento = this.parseDocumentType(parsed.tipo_documento);

      return {
        tipo_documento: tipoDocumento,
        confianza: parsed.confianza || 'media',
      };
    } catch (error) {
      this.logger.error(`Error al parsear respuesta de clasificación: ${error.message}`);
      this.logger.debug(`Respuesta original: ${response}`);

      return {
        tipo_documento: 'DESCONOCIDO',
        confianza: 'baja',
      };
    }
  }

  /**
   * Parsea y valida el tipo de documento
   */
  private parseDocumentType(tipo: string): DocumentType {
    const normalized = tipo?.toUpperCase();
    const validTypes: DocumentType[] = [
      'DUI_FRENTE', 'DUI_TRASERA', 'NIT_FRENTE', 'NIT_TRASERA', 'RECIBO', 'FIRMA', 'DESCONOCIDO',
    ];

    if (validTypes.includes(normalized as DocumentType)) {
      return normalized as DocumentType;
    }

    return 'DESCONOCIDO';
  }
}
