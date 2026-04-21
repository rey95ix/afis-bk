import { IVA_RATE } from '../const/impuestos';

export interface LineaInput {
  costo_unitario: number;
  cantidad: number;
  descuento_monto?: number;
}

export interface LineaCalculada {
  subtotal: number;
  iva: number;
  total: number;
  descuento_monto: number;
}

export interface TotalesCalculados {
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  tasaIVA: number;
  precioConIvaIncluido: boolean;
  lineas: LineaCalculada[];
}

const round = (n: number, decimals = 4): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
};

export function calcularLinea(
  linea: LineaInput,
  tasaIVA: number = IVA_RATE,
  precioConIvaIncluido = false,
): LineaCalculada {
  const costo = linea.costo_unitario || 0;
  const cantidad = linea.cantidad || 0;
  const descuento = linea.descuento_monto || 0;
  const bruto = costo * cantidad - descuento;

  if (precioConIvaIncluido) {
    const subtotalSinIva = bruto / (1 + tasaIVA);
    return {
      subtotal: round(subtotalSinIva),
      iva: round(bruto - subtotalSinIva),
      total: round(bruto),
      descuento_monto: round(descuento),
    };
  }

  const iva = bruto * tasaIVA;
  return {
    subtotal: round(bruto),
    iva: round(iva),
    total: round(bruto + iva),
    descuento_monto: round(descuento),
  };
}

export function calcularTotales(
  lineas: LineaInput[],
  tasaIVA: number = IVA_RATE,
  precioConIvaIncluido = false,
): TotalesCalculados {
  const lineasCalc = lineas.map((l) => calcularLinea(l, tasaIVA, precioConIvaIncluido));

  let subtotalBruto = 0;
  let descuentoTotal = 0;

  for (const l of lineas) {
    subtotalBruto += (l.costo_unitario || 0) * (l.cantidad || 0);
    descuentoTotal += l.descuento_monto || 0;
  }

  const baseBruto = subtotalBruto - descuentoTotal;
  let iva: number;
  let total: number;

  if (precioConIvaIncluido) {
    const baseSinIva = baseBruto / (1 + tasaIVA);
    iva = baseBruto - baseSinIva;
    total = baseBruto;
    subtotalBruto = baseBruto - iva;
  } else {
    iva = baseBruto * tasaIVA;
    total = baseBruto + iva;
  }

  return {
    subtotal: round(subtotalBruto),
    descuento: round(descuentoTotal),
    iva: round(iva),
    total: round(total),
    tasaIVA,
    precioConIvaIncluido,
    lineas: lineasCalc,
  };
}
