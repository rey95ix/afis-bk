// src/modules/facturacion/cobranza/helpers/bucket-mora.helper.ts
import { bucket_mora } from '@prisma/client';
import {
  getInicioDiaElSalvador,
  diasEntreFechasElSalvador,
} from '../../../../common/helpers/dates.helper';

/**
 * Calcula el bucket de antigüedad de mora a partir de una fecha de vencimiento.
 *
 * Buckets:
 *   1-30   días  → DIAS_1_30
 *   31-60  días  → DIAS_31_60
 *   61-90  días  → DIAS_61_90
 *   91+    días  → DIAS_91_MAS
 */
export function calcularBucket(fechaVencimiento: Date, hoy?: Date): bucket_mora {
  const dias = calcularDiasAtraso(fechaVencimiento, hoy);
  if (dias <= 30) return 'DIAS_1_30';
  if (dias <= 60) return 'DIAS_31_60';
  if (dias <= 90) return 'DIAS_61_90';
  return 'DIAS_91_MAS';
}

/**
 * Días de atraso entre la fecha de vencimiento y "hoy" (zona horaria El Salvador).
 * Devuelve 0 cuando la factura aún no está vencida.
 */
export function calcularDiasAtraso(fechaVencimiento: Date, hoy?: Date): number {
  const inicioHoy = getInicioDiaElSalvador(hoy ?? new Date());
  const dias = diasEntreFechasElSalvador(fechaVencimiento, inicioHoy);
  return dias > 0 ? dias : 0;
}

/**
 * Devuelve el rango [desde, hasta] de fechas de vencimiento para un bucket.
 * Útil para construir filtros Prisma `between` y evitar paginar en memoria.
 */
export function rangoFechasBucket(
  bucket: bucket_mora,
  hoy?: Date,
): { gte: Date; lte: Date } {
  const inicioHoy = getInicioDiaElSalvador(hoy ?? new Date());
  const day = 24 * 60 * 60 * 1000;

  const offsetByBucket: Record<bucket_mora, [number, number]> = {
    DIAS_1_30: [30, 1],
    DIAS_31_60: [60, 31],
    DIAS_61_90: [90, 61],
    // 91+ días: tope inferior arbitrario en 100 años atrás
    DIAS_91_MAS: [365 * 100, 91],
  };

  const [diasMax, diasMin] = offsetByBucket[bucket];
  const gte = new Date(inicioHoy.getTime() - diasMax * day);
  const lte = new Date(inicioHoy.getTime() - diasMin * day);
  return { gte, lte };
}

export const ALL_BUCKETS: bucket_mora[] = [
  'DIAS_1_30',
  'DIAS_31_60',
  'DIAS_61_90',
  'DIAS_91_MAS',
];
