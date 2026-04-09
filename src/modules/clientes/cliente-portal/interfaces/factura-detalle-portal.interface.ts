// Respuesta del endpoint GET /cliente-portal/contratos/:id/facturas/:idFactura
// Vista de solo lectura del detalle de una factura del cliente autenticado.

export interface FacturaDetallePortalItem {
  idDetalle: number;
  numItem: number;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  precioUnitario: number;
  ventaGravada: number;
  ventaExenta: number;
  ventaNoSujeto: number;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
}

export interface FacturaDetallePortal {
  // Identificación
  idFactura: number;
  numeroFactura: string | null;
  fechaCreacion: string;

  // Cliente (snapshot)
  clienteNombre: string | null;
  clienteNit: string | null;
  clienteNrc: string | null;
  clienteDireccion: string | null;
  clienteTelefono: string | null;
  clienteCorreo: string | null;

  // Totales
  subtotal: number;
  descuento: number;
  totalGravada: number;
  totalExenta: number;
  totalNoSuj: number;
  iva: number;
  total: number;
  totalLetras: string | null;

  // Condición / pago
  condicionOperacion: number;
  metodoPago: string | null;

  // DTE
  tipoFactura: string | null;
  tipoFacturaCodigo: string | null;
  estadoDte: string;
  codigoGeneracion: string | null;
  numeroControl: string | null;
  selloRecepcion: string | null;
  fechaRecepcionMh: string | null;

  // Estado de cobro
  estado: string;
  estadoPago: string;
  montoAbonado: number;
  saldoPendiente: number;

  // Detalle de cuota
  numeroCuota: number | null;
  totalCuotas: number | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  fechaVencimiento: string | null;
  esInstalacion: boolean;
  montoMora: number;

  // Líneas
  detalles: FacturaDetallePortalItem[];
}
