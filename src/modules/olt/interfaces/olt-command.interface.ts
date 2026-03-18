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

export interface ClienteOltInfo {
  idCliente: number;
  oltCliente: any;
  tarjeta: any;
  equipo: any;
  credencial: boolean;
  ip?: any;
}

export interface DisponiblesResult {
  ontIds: number[];
  serviceports: number[];
}
