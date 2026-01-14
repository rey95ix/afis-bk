/**
 * Resultado de la extracción de datos del comprobante bancario por IA
 */
export interface ComprobanteExtractionResult {
  monto: number | null;
  fecha_transaccion: string | null; // Formato YYYY-MM-DD
  numero_referencia: string | null;
  banco: string | null;
  cuenta_origen: string | null;
  cuenta_destino: string | null;
  nombre_titular: string | null;
  confianza: 'alta' | 'media' | 'baja';
}
