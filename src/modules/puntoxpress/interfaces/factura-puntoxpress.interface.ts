export interface FacturaPuntoXpress {
  id_factura: number;
  numero_factura: string;
  fecha_vencimiento: string;
  periodo_facturado: string;
  monto: number;
  monto_mora: number;
  saldo_pendiente: number;
  cliente: string;
  codigo_cliente: number;
  vencida: any;
  estado_factura: string;
  resolucion: string;
  serie: string;
}
