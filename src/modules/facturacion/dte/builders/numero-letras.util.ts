/**
 * Utilidad para convertir números a letras en español
 * Requerido para el campo totalLetras del DTE
 */

const UNIDADES = [
  '',
  'UN',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
];

const DECENAS = [
  '',
  'DIEZ',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const ESPECIALES = [
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISEIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

function convertirGrupo(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  let resultado = '';
  const centena = Math.floor(n / 100);
  const resto = n % 100;

  if (centena > 0) {
    resultado = CENTENAS[centena];
  }

  if (resto > 0) {
    if (resultado) resultado += ' ';

    if (resto < 10) {
      resultado += UNIDADES[resto];
    } else if (resto < 20) {
      resultado += ESPECIALES[resto - 10];
    } else if (resto < 30 && resto > 20) {
      resultado += 'VEINTI' + UNIDADES[resto - 20];
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      resultado += DECENAS[decena];
      if (unidad > 0) {
        resultado += ' Y ' + UNIDADES[unidad];
      }
    }
  }

  return resultado;
}

/**
 * Convierte un número a su representación en letras
 * @param numero El número a convertir
 * @param moneda La moneda (default: "DOLAR")
 * @returns El número en letras con formato para facturación
 * @example
 * numeroALetras(1234.56) // "MIL DOSCIENTOS TREINTA Y CUATRO DOLARES CON 56/100"
 */
export function numeroALetras(numero: number, moneda: string = 'DOLAR'): string {
  if (numero === 0) return `CERO ${moneda}ES CON 00/100`;

  const parteEntera = Math.floor(Math.abs(numero));
  const centavos = Math.round((Math.abs(numero) - parteEntera) * 100);

  let resultado = '';

  if (parteEntera === 0) {
    resultado = 'CERO';
  } else {
    // Millones
    const millones = Math.floor(parteEntera / 1000000);
    const resto = parteEntera % 1000000;

    if (millones > 0) {
      if (millones === 1) {
        resultado = 'UN MILLON';
      } else {
        resultado = convertirGrupo(millones) + ' MILLONES';
      }
    }

    // Miles
    const miles = Math.floor(resto / 1000);
    const unidades = resto % 1000;

    if (miles > 0) {
      if (resultado) resultado += ' ';
      if (miles === 1) {
        resultado += 'MIL';
      } else {
        resultado += convertirGrupo(miles) + ' MIL';
      }
    }

    // Unidades
    if (unidades > 0) {
      if (resultado) resultado += ' ';
      resultado += convertirGrupo(unidades);
    }
  }

  // Agregar moneda
  const monedaPlural = parteEntera === 1 ? moneda : moneda + 'ES';
  resultado += ` ${monedaPlural}`;

  // Agregar centavos
  const centavosStr = centavos.toString().padStart(2, '0');
  resultado += ` CON ${centavosStr}/100`;

  return resultado.trim();
}

/**
 * Formatea un número con 2 decimales
 */
export function formatearMonto(monto: number): number {
  return Math.round(monto * 100) / 100;
}

/**
 * Redondea un monto según las reglas de MH (2 decimales, redondeo estándar)
 */
export function redondearMonto(monto: number, decimales: number = 2): number {
  const factor = Math.pow(10, decimales);
  return Math.round(monto * factor) / factor;
}
