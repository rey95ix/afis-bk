/**
 * Funciones de transformación para migración de datos
 * MySQL (legacy) → PostgreSQL (Prisma)
 */

import {
  ESTADO_CLIENTE_MAP,
  ESTADO_CONTRATO_MAP,
  ESTADO_FACTURA_MAP,
  TIPO_PERSONA_MAP,
} from '../interfaces/mapping.interface';

/**
 * Parsea una fecha de MySQL a Date de JavaScript
 * Maneja formatos: 'YYYY-MM-DD', 'DD/MM/YYYY', Date object
 */
export function parseDate(dateValue: string | Date | null | undefined): Date | null {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  // Intentar parsear como ISO
  let date = new Date(dateValue);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Intentar formato DD/MM/YYYY
  const parts = dateValue.split('/');
  if (parts.length === 3) {
    date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Combina múltiples campos de teléfono en dos campos
 */
export function combinePhones(
  phone: string | null,
  cellphone: string | null,
  whatsapp: string | null,
): { telefono1: string | null; telefono2: string | null } {
  const phones = [phone, cellphone, whatsapp]
    .filter((p) => p && p.trim())
    .map((p) => p!.trim());

  return {
    telefono1: phones[0] || null,
    telefono2: phones.length > 1 ? phones.slice(1).join(', ') : null,
  };
}

/**
 * Limpia y normaliza un string
 */
export function cleanString(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim();
}

/**
 * Limpia un string y devuelve null si está vacío
 */
export function cleanStringOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Mapea estado de cliente MySQL a enum Prisma
 */
export function mapEstadoCliente(mysqlStatus: number | null | undefined): string {
  if (mysqlStatus === null || mysqlStatus === undefined) {
    return 'INACTIVO';
  }
  return ESTADO_CLIENTE_MAP[mysqlStatus] || 'INACTIVO';
}

/**
 * Mapea estado de contrato MySQL a enum Prisma
 */
export function mapEstadoContrato(mysqlStatus: number | null | undefined): string {
  if (mysqlStatus === null || mysqlStatus === undefined) {
    return 'PENDIENTE_FIRMA';
  }
  return ESTADO_CONTRATO_MAP[mysqlStatus] || 'PENDIENTE_FIRMA';
}

/**
 * Mapea estado de factura MySQL a enum Prisma
 */
export function mapEstadoFactura(mysqlStatus: number | null | undefined): string {
  if (mysqlStatus === null || mysqlStatus === undefined) {
    return 'BORRADOR';
  }
  return ESTADO_FACTURA_MAP[mysqlStatus] || 'BORRADOR';
}

/**
 * Mapea tipo de persona MySQL a enum Prisma
 */
export function mapTipoPersona(tipoPersona: number | null | undefined): string {
  if (tipoPersona === null || tipoPersona === undefined) {
    return 'PERSONA';
  }
  return TIPO_PERSONA_MAP[tipoPersona] || 'PERSONA';
}

/**
 * Genera un código único para contratos
 * Formato: CTR-YYYYMM-#####
 */
export function generateContractCode(sequence: number, date?: Date): string {
  const d = date || new Date();
  const yearMonth = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `CTR-${yearMonth}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Genera un código UUID v4 para DTE
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Convierte un número a Decimal de Prisma
 */
export function toDecimal(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Number(value.toFixed(2));
}

/**
 * Combina dirección de múltiples campos
 */
export function combineAddress(
  address: string | null,
  avenue: string | null,
  street: string | null,
): string {
  const parts = [address, avenue, street]
    .filter((p) => p && p.trim())
    .map((p) => p!.trim());

  return parts.join(', ') || 'Sin dirección';
}

/**
 * Extrae el código de departamento del código de hacienda
 * El código de hacienda tiene formato: "01", "02", etc.
 */
export function extractDepartmentCode(codigoHacienda: string | null): string {
  if (!codigoHacienda) return '';
  return codigoHacienda.padStart(2, '0');
}

/**
 * Normaliza DUI (formato: ########-#)
 */
export function normalizeDUI(dui: string | null | undefined): string | null {
  if (!dui) return null;

  // Remover espacios y guiones
  const cleaned = dui.replace(/[\s-]/g, '');

  // Validar longitud
  if (cleaned.length !== 9) {
    return dui.trim(); // Devolver original si no tiene formato esperado
  }

  // Formatear como ########-#
  return `${cleaned.slice(0, 8)}-${cleaned.slice(8)}`;
}

/**
 * Normaliza NIT (formato: ####-######-###-#)
 */
export function normalizeNIT(nit: string | null | undefined): string | null {
  if (!nit) return null;

  // Remover espacios y guiones
  const cleaned = nit.replace(/[\s-]/g, '');

  // Validar longitud
  if (cleaned.length !== 14) {
    return nit.trim(); // Devolver original si no tiene formato esperado
  }

  // Formatear como ####-######-###-#
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 10)}-${cleaned.slice(10, 13)}-${cleaned.slice(13)}`;
}

/**
 * Genera hora actual en formato HH:MM:SS
 */
export function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

/**
 * Mapea tipo de documento de factura MySQL a código DTE
 */
export function mapTipoDTE(billConcept: number | null): string {
  // 1 = Factura consumidor final, 3 = CCF
  switch (billConcept) {
    case 1:
      return '01'; // Factura
    case 2:
      return '03'; // Crédito Fiscal (CCF)
    case 3:
      return '03'; // CCF
    default:
      return '01'; // Por defecto Factura
  }
}

/**
 * Trunca un string a una longitud máxima
 */
export function truncateString(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  return value.length > maxLength ? value.substring(0, maxLength) : value;
}
