/**
 * Interfaces para las tablas MySQL de origen (legacy NEWTEL ISP)
 * Estas interfaces representan la estructura de las tablas MySQL
 */

// ============= CATÁLOGOS BASE =============

export interface MysqlDepartamento {
  id_parameters_departament: number;
  name: string;
  id_parameters_country: number;
  codigo_hacienda: string;
}

export interface MysqlMunicipio {
  id_parameters_municipality: number;
  name: string;
  id_parameters_departament: number;
  codigo_hacienda: string;
}

export interface MysqlColonia {
  id_parameters_city: number;
  name: string;
  id_parameters_municipality: number;
  id_parameters_agency: number;
}

export interface MysqlEstadoCivil {
  id_marital_status: number;
  name: string;
}

export interface MysqlEstadoVivienda {
  id_customers_house_status: number;
  name: string;
}

// ============= CLIENTES =============

export interface MysqlCustomer {
  id_customers: number;
  customers_status: number;
  customers_type: number;
  name: string;
  dui: string;
  nit: string;
  nrc: string;
  economic_activity: string;
  web_address: string;
  nic_caess: string;
  account_anda: string;
  birth_date: string | Date;
  id_customers_marital_status: number;
  id_house_status: number;
  company_job: string;
  position_company: string;
  address_company_job: string;
  id_gender: number;
  phone: string;
  cellphone: string;
  phone_job: string;
  whatsapp: string;
  mail: string;
  facebook: string;
  name_sp: string;
  mail_sp: string;
  company_job_sp: string;
  company_phone_sp: string;
  cellphone_sp: string;
  name_contact: string;
  tipo_persona: number;
  economic_activity_code: number;
}

export interface MysqlCustomerLocation {
  id_customers_location: number;
  id_customers: number;
  address_type: number;
  address: string;
  avenue: string;
  street: string;
  id_parameters_city: number;
  gps_latitud: string;
  gps_longitud: string;
}

export interface MysqlCustomerReference {
  id_customers_references: number;
  id_customers: number;
  references_type: number;
  name: string;
  mail: string;
  company_work: string;
  address_job: string;
  phone_job: string;
  cellphone: string;
}

// ============= CONTRATOS =============

export interface MysqlContract {
  id_customers_contract: number;
  id_system_user: number;
  id_customers: number;
  number_contract: string;
  status_contract: number;
  type_contract: number;
  id_customers_versions_contracts: number;
}

export interface MysqlPlan {
  id_customers_plan: number;
  name: string;
  description: string;
  pay: number;
  plan_status: number;
  id_customers_plan_types: number;
  id_parameters_olt_traffic_down: number;
  id_parameters_olt_traffic_up: number;
  id_customers_plan_difference: string;
  id_customers_plan_installation: number;
  month_contract: number;
  date_start: string | Date;
  date_end: string | Date;
  double_speed: number;
}

export interface MysqlPlanType {
  id_customers_plan_types: number;
  plan_name: string;
  comment: string;
  id_customers_plan_service_types: number;
}

export interface MysqlCustomerService {
  id_customers_service: number;
  id_customers: number;
  id_customers_plan: number;
  id_customers_cycle: number;
  contract_month: number | null;
  date_sale: string | Date | null;
  date_installation: string | Date | null;
  date_contract_start: string | Date | null;
  date_contract_end: string | Date | null;
  status_service: number;
  service_type: number | null;
}

// ============= FACTURACIÓN =============

export interface MysqlBill {
  id_bill: number;
  print_status: number;
  id_customers: number;
  bill_status: number;
  correlative_bill: string;
  correlative_inside: string;
  bill_concept: number;
  name_customers: string;
  customers_pay_address: string;
  nrc: string;
  economic_activity: string;
  month: string;
  bill_date: string | Date;
  print_date: string | Date;
  periodo_start: string | Date;
  periodo_end: string | Date;
  expiration_date: string | Date;
  comment: string;
  service_type: number;
  id_bill_block: number;
  bill_comment: string;
  numero_control: number;
  codigo_generacion: string;
  estado_declaracion: number;
  sello_recepcion: string;
  fecha_generacion: string | Date;
  id_dte_status: number;
  generation_code: string;
}

export interface MysqlBillDetail {
  id_details_bill: number;
  id_bill: number;
  detail_type: number;
  quantity: number;
  name: string;
  unit_price: number;
  sub_total: number;
}

export interface MysqlBillCycle {
  id_bill_cycle: number;
  name: string;
  date_cut: number;
  date_expiration: number;
  status: number;
}

// ============= USUARIOS (mínimo para FKs) =============

export interface MysqlSystemUser {
  id_system_user: number;
  user: string;
  password: string;
  name: string;
  user_status: number;
  type_user: number;
}

// ============= DOCUMENTOS / MEDIA =============

/**
 * Almacena los archivos binarios (LONGBLOB)
 */
export interface MysqlContractMedia {
  id_contract_media: number;
  media: any | null;
  date: Date | string;
}

/**
 * Relaciona archivos con contratos
 * Cada columna FK apunta a un registro en tbl_contract_media
 */
export interface MysqlCustomersContractMedia {
  id_customers_contract_media: number;
  id_customers_contract: number;
  from_identification: number | null;    // DUI frente
  reverse_identification: number | null; // DUI trasera
  from_nit: number | null;               // NIT frente
  reverse_nit: number | null;            // NIT trasera
  receipt: number | null;                // Recibo de servicio
  signature: number | null;              // Firma
}
