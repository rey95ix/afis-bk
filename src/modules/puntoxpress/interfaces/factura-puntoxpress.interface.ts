export interface FacturaPuntoXpress {
  id_factura: number;
  numero_factura: string;
  fecha_vencimiento: string;
  periodo_facturado: string;
  monto: number;
  saldo_pendiente: number;
  cliente: string;
  codigo_cliente: number;
  vencida: boolean;
  estado_factura: string;
}
