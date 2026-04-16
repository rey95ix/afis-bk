import {
  olt_cliente,
  olt_tarjeta,
  olt_equipo,
  olt_cliente_ip,
  olt_red,
  olt_modelo,
} from '@prisma/client';

export interface OltSlotPortOnt {
  slot: number;
  port: number;
  ontId: number;
}

export interface OltInstallParams extends OltSlotPortOnt {
  serviceport: number;
  sn?: string;
  password?: string;
  tipoAuth: 'SN' | 'LOID';
  vlan: number;
  userVlan: number;
  srvprofileOlt?: string;
}

export interface OltDeleteParams extends OltSlotPortOnt {
  serviceport: number;
}

export interface OltPlanChangeParams extends OltSlotPortOnt {
  serviceport: number;
  idTraficoUp: number;
  idTraficoDown: number;
}

export interface OltCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface OltOperationResult {
  success: boolean;
  message: string;
  output?: string;
}

export interface OntWanInfo {
  idCliente: number;
  output: string;
}

export type OltClienteConRelaciones = olt_cliente & {
  tarjeta: olt_tarjeta & { equipo: olt_equipo };
  modelo: olt_modelo | null;
};

export interface ClienteOltInfo {
  idCliente: number;
  oltCliente: OltClienteConRelaciones;
  tarjeta: olt_tarjeta & { equipo: olt_equipo };
  equipo: olt_equipo;
  credencial: boolean;
  ip?: (olt_cliente_ip & { red: olt_red }) | undefined;
}

export interface DisponiblesResult {
  ontIds: number[];
  serviceports: number[];
}

export interface DiscoveredOnt {
  frame: number;
  slot: number;
  port: number;
  number: number;
  serialNumber: string;
  password?: string;
  loid?: string;
  vendorId?: string;
  equipmentId?: string;
  version?: string;
  softwareVersion?: string;
  discoveredAt?: string;
  idOltTarjeta?: number;
  tarjetaNombre?: string;
}
