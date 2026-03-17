/**
 * Interfaces para el mapeo de IDs entre MySQL y PostgreSQL
 * y configuración de migración
 */

// Mapeo de IDs viejos a nuevos
export interface IdMapping {
  oldId: number;
  newId: number;
}

// Mapeo completo por tabla
export interface TableMappings {
  departamentos: Map<number, number>;
  municipios: Map<number, number>;
  colonias: Map<number, number>;
  estadoCivil: Map<number, number>;
  estadoVivienda: Map<number, number>;
  clientes: Map<number, number>;
  direcciones: Map<number, number>;
  planes: Map<number, number>;
  ciclosFacturacion: Map<number, number>;
  contratos: Map<number, number>;
  facturas: Map<number, number>;
  documentos: Map<number, number>; // tbl_contract_media.id → clienteDocumentos.id
  oltEquipos: Map<number, number>;
  oltMarcas: Map<number, number>;
  oltModelos: Map<number, number>;
  oltTarjetas: Map<number, number>;
  oltTrafico: Map<number, number>;
  oltRedes: Map<number, number>;
}

// Resultado de migración por módulo
export interface MigrationModuleResult {
  module: string;
  success: boolean;
  totalRecords: number;
  migratedRecords: number;
  skippedRecords: number;
  errors: MigrationError[];
  duration: number; // en milisegundos
  startedAt: Date;
  completedAt: Date;
}

// Error de migración
export interface MigrationError {
  table: string;
  recordId: number;
  field?: string;
  message: string;
  originalData?: unknown;
}

// Estado de migración global
export interface MigrationStatus {
  isRunning: boolean;
  currentModule: string | null;
  completedModules: string[];
  pendingModules: string[];
  totalProgress: number; // porcentaje 0-100
  startedAt: Date | null;
  lastUpdatedAt: Date | null;
  results: MigrationModuleResult[];
  clientProgress?: {
    currentClientIndex: number;
    totalClients: number;
    currentMysqlId: number | null;
    successCount: number;
    errorCount: number;
  };
}

// Configuración de conexión MySQL
export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

// Opciones de migración por módulo
export interface MigrationOptions {
  batchSize: number;
  skipExisting: boolean; // usar upsert
  dryRun: boolean; // solo simular
  continueOnError: boolean;
  maxRetries: number;
  includeDocumentos?: boolean;
  concurrency?: number;
}

// Resultado de preview
export interface MigrationPreview {
  module: string;
  totalSourceRecords: number;
  existingDestRecords: number;
  toBeCreated: number;
  toBeUpdated: number;
  sampleData: unknown[];
}

// Log de migración
export interface MigrationLog {
  id: number;
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  module: string;
  message: string;
  details?: unknown;
}

// Resultado de validación de conexión
export interface ConnectionValidation {
  mysql: {
    connected: boolean;
    version?: string;
    database?: string;
    error?: string;
  };
  postgres: {
    connected: boolean;
    version?: string;
    database?: string;
    error?: string;
  };
  tablesFound: {
    table: string;
    count: number;
  }[];
}

// Mapeo de estados MySQL a enums Prisma
export const ESTADO_CLIENTE_MAP: Record<number, string> = {
  0: 'SIN_INSTALAR',
  1: 'ACTIVO',
  2: 'SUSPENDIDO',
  3: 'BAJA_DEFINITIVA',
  4: 'EN_ESPERA',
  5: 'SIN_LIQUIDAR',
  6: 'INCONCLUSO',
  7: 'SIN_GESTION_CALIDAD',
  8: 'BAJA_CAMBIO_NOMBRE',
  9: 'VELOCIDAD_REDUCIDA',
  10: 'MOROSO_INCOBRABLE',
  11: 'SIN_COBERTURA',
  12: 'SUSPENDIDO_TEMPORAL',
  13: 'CONVENIO_ESPECIAL',
  14: 'BAJA_ADMINISTRATIVA',
};

// Mapeo de estado del CLIENTE a estado del CONTRATO
// El estado autoritativo del servicio es tbl_customers.customers_status, no status_contract
export const ESTADO_CLIENTE_TO_CONTRATO_MAP: Record<number, string> = {
  0: 'PENDIENTE_INSTALACION',   // SIN_INSTALAR
  1: 'INSTALADO_ACTIVO',        // ACTIVO
  2: 'SUSPENDIDO',              // SUSPENDIDO
  3: 'BAJA_DEFINITIVA',         // BAJA_DEFINITIVA
  4: 'PENDIENTE_INSTALACION',   // EN_ESPERA
  5: 'CANCELADO',               // SIN_LIQUIDAR
  6: 'CANCELADO',               // INCONCLUSO
  7: 'PENDIENTE_INSTALACION',   // SIN_GESTION_CALIDAD
  8: 'BAJA_CAMBIO_TITULAR',     // BAJA_CAMBIO_NOMBRE
  9: 'VELOCIDAD_REDUCIDA',      // VELOCIDAD_REDUCIDA
  10: 'EN_MORA',                // MOROSO_INCOBRABLE
  11: 'CANCELADO',              // SIN_COBERTURA
  12: 'SUSPENDIDO_TEMPORAL',    // SUSPENDIDO_TEMPORAL
  13: 'INSTALADO_ACTIVO',       // CONVENIO_ESPECIAL
  14: 'BAJA_DEFINITIVA',        // BAJA_ADMINISTRATIVA
};

export const ESTADO_CONTRATO_MAP: Record<number, string> = {
  1: 'INSTALADO_ACTIVO',
  2: 'SUSPENDIDO',
  3: 'CANCELADO',
  4: 'PENDIENTE_FIRMA',
  5: 'PENDIENTE_INSTALACION',
};

export const ESTADO_FACTURA_MAP: Record<number, string> = {
  1: 'PROCESADO',
  2: 'BORRADOR',
  3: 'INVALIDADO',
};

export const TIPO_PERSONA_MAP: Record<number, string> = {
  1: 'PERSONA',
  2: 'EMPRESA',
};

// Resultado de migración masiva unificada por clientes
export interface BulkClienteMigrationResult {
  totalClients: number;
  successCount: number;
  errorCount: number;
  clientErrors: Array<{ mysqlId: number; errors: MigrationError[] }>;
  duration: number;
}

// Resultado de migración de un cliente individual
export interface SingleClienteMigrationResult {
  cliente: {
    mysqlId: number;
    postgresId: number;
    migrated: boolean;
    dui: string;
  };
  direcciones: {
    total: number;
    migrated: number;
  };
  datosFacturacion: {
    migrated: boolean;
  };
  contratos?: {
    total: number;
    migrated: number;
    ids: number[];
  };
  documentos?: {
    total: number;
    migrated: number;
  };
  facturas?: {
    total: number;
    migrated: number;
  };
  olt?: {
    asignaciones: number;
    ips: number;
    telefonos: number;
  };
  errors: MigrationError[];
  duration: number;
}
