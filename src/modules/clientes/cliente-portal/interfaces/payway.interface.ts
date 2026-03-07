export interface PayWayPagoParams {
  nombreTarjetahabiente: string;
  numeroTarjeta: string;
  fechaExpiracion: string; // YYYYMM
  cvv2: string;
  monto: number;
  conceptoPago: string;
  ipCliente?: string;
  usuarioCliente?: string;
}

export interface PayWayResponse {
  exitoso: boolean;
  codigoRetorno: string;
  mensajeRetorno: string;
  numeroAutorizacion?: string;
  numeroReferencia?: string;
  terminacionTarjeta?: string;
  fechaTransaccion?: string;
}
