/**
 * Utilidad para generación de NPE (Número de Pago Electrónico) y código de barras GS1-128
 * Basado en la "Guía de Estándar Recibos de Pago 2020" de GS1 El Salvador
 *
 * Dos cálculos distintos:
 * - CC (Carácter de Control del barcode): MOD 103, calculado automáticamente por bwip-js
 * - VR (Verificador del NPE): Algoritmo base 10 (Anexo 2, pág. 19), calculado aquí
 */
import * as bwipjs from 'bwip-js';

export interface NpeParams {
  gln: string;
  amount: number;
  maxPaymentDate?: Date | null;
  reference: string;
}

export interface NpeReferenceSource {
  id_contrato?: number | null;
  id_factura_directa?: number | null;
  id_cliente_directo?: number | null;
  codigo_generacion?: string | null;
}

/**
 * Resuelve la referencia de pago (IA 8020) según §8.2 de la guía NPE/GS1-128.
 * Prioridad: factura directa → cliente directo → dígitos del UUID codigo_generacion.
 *
 * Esta función debe ser la única fuente de verdad para la referencia, así
 * el NPE almacenado en dte_json y el barcode renderizado en el PDF siempre
 * coinciden.
 */
export function resolveNpeReference(source: NpeReferenceSource): string {
  if (source.id_factura_directa) {
    return String(source.id_factura_directa).padStart(10, '0');
  }
  if (source.id_cliente_directo) {
    return String(source.id_cliente_directo).padStart(10, '0');
  }
  const uuidDigits = (source.codigo_generacion || '').replace(/\D/g, '');
  return (uuidDigits.length >= 2 ? uuidDigits : uuidDigits.padStart(2, '0')).slice(0, 24);
}

/**
 * Valida los parámetros de entrada para NPE/barcode.
 * Lanza error si los datos no cumplen con el estándar GS1.
 */
function validateNpeParams(params: NpeParams): void {
  if (!/^\d{13}$/.test(params.gln)) {
    throw new Error(`GLN debe ser exactamente 13 dígitos numéricos, recibido: "${params.gln}"`);
  }
  if (params.amount <= 0) {
    throw new Error('El monto del NPE debe ser positivo');
  }
  const ref = params.reference.replace(/\D/g, '');
  if (ref.length < 2) {
    throw new Error(`La referencia NPE debe contener al menos 2 dígitos numéricos, recibido: "${params.reference}"`);
  }
}

/**
 * Calcula el dígito verificador del NPE según el Anexo 2 de la guía GS1 (pág. 19).
 *
 * Algoritmo (iteración de IZQUIERDA a DERECHA, posición 1 = primer carácter):
 *
 * Paso 1: Posiciones IMPARES (1,3,5...): multiplicar × 2.
 *         Si el producto >= 10, SUMAR 1 al producto (NO restar 9).
 *         Ejemplo: 7 × 2 = 14, como 14 >= 10 → 14 + 1 = 15
 *
 * Paso 2: Posiciones PARES (2,4,6...): sumar directo.
 *
 * Paso 3: A = suma_impares + suma_pares
 *         B = floor(A / 10)
 *         C = B × 10
 *         D = A - C           (equivale a A % 10)
 *         E = 10 - D
 *         F = floor(E / 10)
 *         G = F × 10
 *         VR = E - G          (equivale a E % 10, que es (10 - (A % 10)) % 10)
 */
export function calculateNpeCheckDigit(numericString: string): number {
  const digits = numericString.split('').map(Number);
  let sumImpares = 0;
  let sumPares = 0;

  for (let i = 0; i < digits.length; i++) {
    const position = i + 1; // 1-based, izquierda a derecha
    if (position % 2 === 1) {
      // Posición impar: multiplicar por 2
      let product = digits[i] * 2;
      // Si el producto >= 10, sumar 1 (según la guía, NO restar 9)
      if (product >= 10) product += 1;
      sumImpares += product;
    } else {
      // Posición par: sumar directo
      sumPares += digits[i];
    }
  }

  // Paso 3: calcular VR
  const A = sumImpares + sumPares;
  const B = Math.floor(A / 10);
  const C = B * 10;
  const D = A - C;
  const E = 10 - D;
  const F = Math.floor(E / 10);
  const G = F * 10;
  const VR = E - G;

  return VR;
}

/**
 * Formatea una fecha como YYYYMMDD usando UTC para evitar
 * problemas de timezone en el servidor.
 */
function formatDateYYYYMMDD(date: Date): string {
  const d = new Date(date);
  const year = d.getUTCFullYear().toString();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Construye los segmentos del NPE a partir de los parámetros de factura.
 *
 * Según la tabla de la Sección 10.1.3 (pág. 18):
 *
 * | IA   | Barcode          | NPE                        |
 * |------|------------------|----------------------------|
 * | 415  | 13 caracteres    | 4 caracteres (Penúltimos 4)|
 * | 3902 | 10 caracteres    | 6 caracteres (últimos 6)   |
 * | 96   | 8 caracteres     | 8 caracteres (completo)    |
 * | 8020 | 2-24 caracteres  | 2-24 caracteres (completo) |
 */
function buildNpeSegments(params: NpeParams): {
  glnSegment: string;
  amountSegment: string;
  dateSegment: string;
  referenceSegment: string;
} {
  // GLN: tomar los PENÚLTIMOS 4 dígitos (posiciones 9-12 de 13)
  // Ejemplo: "7419700000006" → "0000" (no "0006")
  const glnSegment = params.gln.slice(-5, -1);

  // Monto: multiplicar por 100 (2 decimales), zero-pad a 10 dígitos, tomar ÚLTIMOS 6
  const amountCents = Math.round(params.amount * 100);
  const amountFull = amountCents.toString().padStart(10, '0');
  const amountSegment = amountFull.slice(-6);

  // Fecha: YYYYMMDD completo (solo si hay fecha)
  const dateSegment = params.maxPaymentDate
    ? formatDateYYYYMMDD(params.maxPaymentDate)
    : '';

  // Referencia: completa, asegurar que sea numérica y entre 2-24 dígitos
  const referenceSegment = params.reference.replace(/\D/g, '').slice(0, 24);

  return { glnSegment, amountSegment, dateSegment, referenceSegment };
}

/**
 * Calcula el NPE completo, formateado en grupos de 4 dígitos.
 *
 * Estructura: [penúltimos 4 GLN][monto 6 dígitos][fecha YYYYMMDD][pad?][referencia][VR]
 *
 * Según el gráfico de la pág. 18, si la concatenación total es par, se inserta un "0"
 * ANTES de la referencia (entre la fecha/monto y la referencia) para hacer la cadena impar.
 * El "0" que "Hace Impar la Cadena" está posicionado justo antes de la referencia en el gráfico.
 *
 * Ejemplo de la guía (pág. 18):
 *   Barcode: (415)7419700000006(3902)0000025065(96)20150702(8020)0704081998
 *   Segmentos: 0000 + 025065 + 20150702 + 0704081998 = 28 chars (par)
 *   Con pad:   0000 + 025065 + 20150702 + 0 + 0704081998 = 29 chars (impar)
 *   VR = 3
 *   NPE final: 0000 0250 6520 1507 0200 7040 8199 83
 */
export function calculateNpe(params: NpeParams): string {
  validateNpeParams(params);

  const { glnSegment, amountSegment, dateSegment, referenceSegment } =
    buildNpeSegments(params);

  // Parte fija (antes de la referencia)
  const prefix = `${glnSegment}${amountSegment}${dateSegment}`;
  const totalLength = prefix.length + referenceSegment.length;

  // Si la longitud total es par, insertar "0" entre el prefijo y la referencia
  const pad = totalLength % 2 === 0 ? '0' : '';
  const concatenated = `${prefix}${pad}${referenceSegment}`;

  const checkDigit = calculateNpeCheckDigit(concatenated);
  const npeRaw = `${concatenated}${checkDigit}`;

  // Formatear en grupos de 4 dígitos (Sección 10.1.2)
  return npeRaw.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Construye el string de datos GS1-128 con los Identificadores de Aplicación.
 *
 * Estructura según la guía (Sección 5, pág. 12):
 * (415)[GLN 13 dígitos](3902)[monto 10 dígitos](96)[YYYYMMDD](8020)[referencia]
 *
 * El barcode usa los datos COMPLETOS (no reducidos como el NPE).
 * Para bwip-js, los paréntesis alrededor de los IA son la forma estándar
 * de indicar los Application Identifiers en el texto de entrada.
 */
export function buildGs1128Data(params: NpeParams): string {
  validateNpeParams(params);

  const { gln, amount, maxPaymentDate, reference } = params;

  // IA 415: GLN (13 dígitos, obligatorio, siempre primero)
  let barcodeData = `(415)${gln}`;

  // IA 3902: Monto en USD con 2 decimales (10 dígitos)
  const amountCents = Math.round(amount * 100);
  const amountStr = amountCents.toString().padStart(10, '0');
  barcodeData += `(3902)${amountStr}`;

  // IA 96: Fecha máxima de pago (YYYYMMDD, opcional)
  if (maxPaymentDate) {
    barcodeData += `(96)${formatDateYYYYMMDD(maxPaymentDate)}`;
  }

  // IA 8020: Referencia del recibo (2-24 dígitos, obligatorio, siempre último)
  const ref = reference.replace(/\D/g, '').slice(0, 24);
  barcodeData += `(8020)${ref}`;

  return barcodeData;
}

/**
 * Genera una imagen PNG del código de barras GS1-128 como data URL base64.
 * Usa bwip-js para la generación server-side.
 * El CC (Carácter de Control MOD 103) es calculado automáticamente por bwip-js.
 */
export async function generateGs1128BarcodeBase64(
  barcodeData: string,
): Promise<string> {
  const pngBuffer = await bwipjs.toBuffer({
    bcid: 'gs1-128',
    text: barcodeData,
    scale: 3,
    height: 15,
    includetext: false,
    textxalign: 'center',
  });

  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
