/**
 * Payload del JWT para clientes del portal
 * Contiene la información mínima necesaria para identificar al cliente y su sesión
 */
export interface JwtClientePayload {
  /** ID único del cliente */
  id_cliente: number;

  /** ID de la sesión activa (para poder revocar tokens específicos) */
  session_id: number;

  /** DUI del cliente (para logging y auditoría) */
  dui: string;

  /** Tipo de token (access o refresh) */
  type: 'access' | 'refresh';

  /** Timestamp de emisión (automático por JWT) */
  iat?: number;

  /** Timestamp de expiración (automático por JWT) */
  exp?: number;
}

/**
 * Datos del cliente autenticado que se adjuntan al request
 * Después de validar el JWT, estos datos están disponibles en req.cliente
 */
export interface ClienteAutenticado {
  id_cliente: number;
  titular: string;
  dui: string;
  correo_electronico: string;
  telefono1: string;
  estado: string;
  cuenta_activada: boolean;
  cuenta_bloqueada: boolean;
  session_id: number;
}
