/**
 * Información de una sesión de cliente
 */
export interface ClienteSession {
  id_sesion: number;
  id_cliente: number;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  dispositivo: string | null;
  fecha_creacion: Date;
  fecha_expiracion: Date;
  ultima_actividad: Date;
  revocada: boolean;
  fecha_revocacion: Date | null;
}

/**
 * Respuesta de sesión para mostrar al cliente
 * (sin información sensible como token_hash)
 */
export interface ClienteSessionResponse {
  id_sesion: number;
  dispositivo: string | null;
  ip_address: string | null;
  ultima_actividad: Date;
  fecha_creacion: Date;
  es_sesion_actual: boolean;
}

/**
 * Tokens generados para el cliente
 */
export interface ClienteTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number; // segundos hasta expiración
}

/**
 * Respuesta completa de login
 */
export interface LoginResponse {
  cliente: {
    id_cliente: number;
    titular: string;
    dui: string;
    correo_electronico: string;
    telefono1: string;
    ultimo_login: Date | null;
  };
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/**
 * Acciones para el log de cliente
 */
export enum ClienteLogAccion {
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  LOGOUT_ALL = 'LOGOUT_ALL',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ACTIVATION_REQUEST = 'ACTIVATION_REQUEST',
  ACTIVATION_SUCCESS = 'ACTIVATION_SUCCESS',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  SESSION_REVOKED = 'SESSION_REVOKED',
}
