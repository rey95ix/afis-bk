/**
 * Pruebas HTTP de los endpoints de notificaciones por ciclo.
 *
 * Uso (con el backend corriendo en http://localhost:4000):
 *   npx ts-node test/ciclos-notificaciones.http-test.ts [idCiclo] [idClienteParaPatch]
 *
 * Ejemplo:
 *   npx ts-node test/ciclos-notificaciones.http-test.ts 1
 */
import axios, { AxiosError } from 'axios';

const BASE = process.env.BASE_URL ?? 'http://localhost:4000';
const TOKEN =
  process.env.AFIS_TOKEN ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoxLCJpZF9zdWN1cnNhbCI6MSwiaWF0IjoxNzc2Mjk4MDgzLCJleHAiOjE3NzYzMjY4ODN9.8v3Olufx_vFqP_wJmnWAMjJywPLfXXZmBPiahUtrzHU';

const idCiclo = Number(process.argv[2] ?? 1);
const idClienteOverride = process.argv[3] ? Number(process.argv[3]) : undefined;

const http = axios.create({
  baseURL: BASE,
  headers: { Authorization: `Bearer ${TOKEN}` },
  validateStatus: () => true,
});

interface NotifResponse {
  resumen: {
    totalClientes: number;
    telefonosValidos: number;
    telefonosInvalidos: number;
    correosValidos: number;
    correosInvalidos: number;
  };
  clientes: Array<{
    id: number;
    nombre: string;
    telefono1: string;
    telefonoValido: boolean;
    telefonoLimpio: string;
    telefonoRazon: string;
    correoElectronico: string;
    correoValido: boolean;
    correoRazon: string;
  }>;
}

function asPayload(res: { data: any }) {
  return res.data?.data ?? res.data;
}

async function expectStatus(label: string, fn: () => Promise<{ status: number; data: any }>, expected: number) {
  const res = await fn();
  const ok = res.status === expected ? 'OK' : 'FAIL';
  console.log(`[${ok}] ${label} → ${res.status} (esperado ${expected})`);
  if (res.status !== expected) {
    console.log('   body:', JSON.stringify(res.data));
  }
  return res;
}

(async () => {
  console.log(`\n== Pruebas notificaciones ciclo ${idCiclo} ==`);

  const okGet = await expectStatus(
    `GET /facturacion/ciclos/${idCiclo}/notificaciones`,
    () => http.get(`/facturacion/ciclos/${idCiclo}/notificaciones`),
    200,
  );
  const payload = asPayload(okGet) as NotifResponse;
  if (payload?.resumen) {
    console.log('   resumen:', payload.resumen);
    console.log(`   clientes recibidos: ${payload.clientes?.length ?? 0}`);
  }

  await expectStatus(
    'GET /facturacion/ciclos/99999/notificaciones (no existe)',
    () => http.get('/facturacion/ciclos/99999/notificaciones'),
    404,
  );

  const idCliente = idClienteOverride ?? payload?.clientes?.[0]?.id;
  if (!idCliente) {
    console.log('No hay cliente para probar PATCH; saltando pruebas de actualizacion.');
    return;
  }

  await expectStatus(
    `PATCH .../clientes/${idCliente}/contacto (telefono valido)`,
    () =>
      http.patch(`/facturacion/ciclos/${idCiclo}/clientes/${idCliente}/contacto`, {
        telefono1: '7123-4567',
      }),
    200,
  );

  await expectStatus(
    `PATCH .../clientes/${idCliente}/contacto (telefono invalido)`,
    () =>
      http.patch(`/facturacion/ciclos/${idCiclo}/clientes/${idCliente}/contacto`, {
        telefono1: '123',
      }),
    400,
  );

  await expectStatus(
    `PATCH .../clientes/${idCliente}/contacto (correo invalido)`,
    () =>
      http.patch(`/facturacion/ciclos/${idCiclo}/clientes/${idCliente}/contacto`, {
        correo_electronico: 'xx@.com',
      }),
    400,
  );

  await expectStatus(
    `PATCH ciclo inexistente`,
    () =>
      http.patch(`/facturacion/ciclos/99999/clientes/${idCliente}/contacto`, {
        telefono1: '71234567',
      }),
    404,
  );

  await expectStatus(
    `PATCH cliente que no pertenece al ciclo`,
    () =>
      http.patch(`/facturacion/ciclos/${idCiclo}/clientes/9999999/contacto`, {
        telefono1: '71234567',
      }),
    404,
  );

  console.log('\n== Fin pruebas ==\n');
})().catch((e: AxiosError) => {
  console.error('Error inesperado:', e.message);
  process.exit(1);
});
