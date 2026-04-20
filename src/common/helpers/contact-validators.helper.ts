export type RazonTelefonoInvalido =
  | 'VACIO'
  | 'LONGITUD_INVALIDA'
  | 'PREFIJO_INVALIDO'
  | 'CARACTERES_INVALIDOS'
  | 'NUMERO_DUMMY';

export interface ResultadoValidacionTelefono {
  valido: boolean;
  numeroLimpio: string;
  razon?: RazonTelefonoInvalido;
}

export type RazonEmailInvalido = 'VACIO' | 'FORMATO_INVALIDO' | 'DOMINIO_INVALIDO';

export interface ResultadoValidacionEmail {
  valido: boolean;
  razon?: RazonEmailInvalido;
}

export function validarTelefonoSV(raw: string | null | undefined): ResultadoValidacionTelefono {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { valido: false, numeroLimpio: '', razon: 'VACIO' };
  }

  const primero = String(raw).split(/[,\/]/)[0].trim();

  let limpio = primero.replace(/[\s\-\(\)]/g, '');

  if (limpio.startsWith('+503')) {
    limpio = limpio.slice(4);
  } else if (limpio.startsWith('503') && limpio.length > 8) {
    limpio = limpio.slice(3);
  }

  if (!/^\d+$/.test(limpio)) {
    return { valido: false, numeroLimpio: limpio, razon: 'CARACTERES_INVALIDOS' };
  }

  if (limpio.length !== 8) {
    return { valido: false, numeroLimpio: limpio, razon: 'LONGITUD_INVALIDA' };
  }

  if (/^(\d)\1{7}$/.test(limpio) || limpio === '00000000') {
    return { valido: false, numeroLimpio: limpio, razon: 'NUMERO_DUMMY' };
  }

  if (!/^[67]/.test(limpio)) {
    return { valido: false, numeroLimpio: limpio, razon: 'PREFIJO_INVALIDO' };
  }

  return { valido: true, numeroLimpio: limpio };
}

const DOMINIOS_INVALIDOS = ['newtel.com.sv', 'newtel.com', 'ixcnet.sv'];

export function validarEmail(raw: string | null | undefined): ResultadoValidacionEmail {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { valido: false, razon: 'VACIO' };
  }

  const valor = String(raw).trim();

  const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

  if (!regex.test(valor)) {
    const partes = valor.split('@');
    if (partes.length === 2 && (partes[1].startsWith('.') || partes[1].includes('..'))) {
      return { valido: false, razon: 'DOMINIO_INVALIDO' };
    }
    return { valido: false, razon: 'FORMATO_INVALIDO' };
  }

  const valorLower = valor.toLowerCase();

  if (valorLower.endsWith('.xxx') || valorLower.endsWith('.com.sv')) {
    return { valido: false, razon: 'DOMINIO_INVALIDO' };
  }

  const dominio = valorLower.split('@')[1] ?? '';
  if (DOMINIOS_INVALIDOS.includes(dominio)) {
    return { valido: false, razon: 'DOMINIO_INVALIDO' };
  }

  return { valido: true };
}
