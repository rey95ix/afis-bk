import { validarTelefonoSV, validarEmail } from './contact-validators.helper';

describe('validarTelefonoSV', () => {
  it('acepta numero con guion', () => {
    const r = validarTelefonoSV('7757-0490');
    expect(r.valido).toBe(true);
    expect(r.numeroLimpio).toBe('77570490');
  });

  it('acepta numero con espacios', () => {
    const r = validarTelefonoSV('7117 7172');
    expect(r.valido).toBe(true);
    expect(r.numeroLimpio).toBe('71177172');
  });

  it('acepta numero con prefijo +503', () => {
    const r = validarTelefonoSV('+503 7123 4567');
    expect(r.valido).toBe(true);
    expect(r.numeroLimpio).toBe('71234567');
  });

  it('acepta numero con prefijo 503 sin signo', () => {
    const r = validarTelefonoSV('50371234567');
    expect(r.valido).toBe(true);
    expect(r.numeroLimpio).toBe('71234567');
  });

  it('acepta numero que inicia en 6', () => {
    expect(validarTelefonoSV('6192 9926').valido).toBe(true);
  });

  it('rechaza vacio', () => {
    expect(validarTelefonoSV('').razon).toBe('VACIO');
    expect(validarTelefonoSV(null).razon).toBe('VACIO');
    expect(validarTelefonoSV('   ').razon).toBe('VACIO');
  });

  it('rechaza numero dummy 0000-0000', () => {
    const r = validarTelefonoSV('0000-0000');
    expect(r.valido).toBe(false);
    expect(r.razon).toBe('NUMERO_DUMMY');
  });

  it('rechaza numero que no inicia en 6 o 7', () => {
    const r = validarTelefonoSV('25123456');
    expect(r.valido).toBe(false);
    expect(r.razon).toBe('PREFIJO_INVALIDO');
  });

  it('rechaza longitud invalida', () => {
    expect(validarTelefonoSV('7123').razon).toBe('LONGITUD_INVALIDA');
    expect(validarTelefonoSV('712345678').razon).toBe('LONGITUD_INVALIDA');
  });

  it('rechaza caracteres no numericos', () => {
    expect(validarTelefonoSV('7abc1234').razon).toBe('CARACTERES_INVALIDOS');
  });

  it('valida solo el primer numero cuando hay varios separados por coma', () => {
    const r = validarTelefonoSV('7123-4567, 6111-2233');
    expect(r.valido).toBe(true);
    expect(r.numeroLimpio).toBe('71234567');
  });
});

describe('validarEmail', () => {
  it('acepta email valido', () => {
    expect(validarEmail('facturacion@newtel.com.sv').valido).toBe(true);
    expect(validarEmail('user.name+tag@gmail.com').valido).toBe(true);
  });

  it('rechaza vacio', () => {
    expect(validarEmail('').razon).toBe('VACIO');
    expect(validarEmail(null).razon).toBe('VACIO');
  });

  it('rechaza dominio que inicia con punto', () => {
    const r = validarEmail('isaias.lizamatobar@.com');
    expect(r.valido).toBe(false);
    expect(r.razon).toBe('DOMINIO_INVALIDO');
  });

  it('rechaza formato invalido sin arroba', () => {
    expect(validarEmail('noesemail').razon).toBe('FORMATO_INVALIDO');
  });

  it('rechaza dominio sin tld', () => {
    expect(validarEmail('user@dominio').razon).toBe('FORMATO_INVALIDO');
  });
});
