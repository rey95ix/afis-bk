import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ExecutionContext } from '@nestjs/common';

/**
 * Interface para el contexto de evaluación de una política
 */
export interface PolicyContext {
  user: any; // Usuario autenticado
  resource?: any; // Recurso al que se intenta acceder (opcional)
  params?: any; // Parámetros de la request
  query?: any; // Query params
  body?: any; // Body de la request
}

/**
 * Interface para handlers de políticas
 */
export interface PolicyHandler {
  handle(context: PolicyContext, config: any): boolean | Promise<boolean>;
}

/**
 * Servicio para evaluar políticas de autorización
 * Las políticas son reglas condicionales que validan contexto adicional
 */
@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  // Registro de handlers de políticas
  private policyHandlers = new Map<string, PolicyHandler>();

  constructor(private readonly prisma: PrismaService) {
    // Registrar handlers predefinidos
    this.registerDefaultHandlers();
  }

  /**
   * Registra los handlers de políticas predefinidos del sistema
   */
  private registerDefaultHandlers(): void {
    // Política: Misma Sucursal
    this.registerHandler('SameSucursalPolicy', {
      handle: (context, config) => {
        const userSucursal = context.user?.id_sucursal;
        const resourceSucursal = context.resource?.[config.campo_recurso || 'id_sucursal'];

        if (!userSucursal) {
          this.logger.warn('Usuario sin sucursal asignada');
          return false;
        }

        if (!resourceSucursal) {
          // Si el recurso no tiene sucursal, permitir acceso
          return true;
        }

        return userSucursal === resourceSucursal;
      }
    });

    // Política: Es Propietario
    this.registerHandler('IsOwnerPolicy', {
      handle: (context, config) => {
        const userId = context.user?.id_usuario;
        const resourceUserId = context.resource?.[config.campo_recurso || 'id_usuario'];

        if (!userId) {
          return false;
        }

        if (!resourceUserId) {
          // Si el recurso no tiene propietario, denegar acceso
          return false;
        }

        return userId === resourceUserId;
      }
    });

    // Política: Ticket No Cerrado
    this.registerHandler('TicketNotClosedPolicy', {
      handle: (context, config) => {
        const estado = context.resource?.estado;

        if (!estado) {
          // Si no hay estado, permitir (será validado en otro nivel)
          return true;
        }

        const estadosPermitidos = config.estados_permitidos || ['ABIERTO', 'EN_DIAGNOSTICO', 'ESCALADO'];
        return estadosPermitidos.includes(estado);
      }
    });

    // Política: Orden No Completada
    this.registerHandler('OrdenNotCompletedPolicy', {
      handle: (context, config) => {
        const estado = context.resource?.estado;

        if (!estado) {
          return true;
        }

        const estadosBloqueados = config.estados_bloqueados || ['COMPLETADA', 'CANCELADA'];
        return !estadosBloqueados.includes(estado);
      }
    });

    // Política: Requisición Pendiente
    this.registerHandler('RequisicionPendientePolicy', {
      handle: (context, config) => {
        const estado = context.resource?.estado;

        if (!estado) {
          return false;
        }

        const estadosPermitidos = config.estados_permitidos || ['PENDIENTE'];
        return estadosPermitidos.includes(estado);
      }
    });

    // Política: Ajuste Pendiente de Autorización
    this.registerHandler('AjustePendientePolicy', {
      handle: (context, config) => {
        const estado = context.resource?.estado;

        if (!estado) {
          return false;
        }

        const estadosPermitidos = config.estados_permitidos || ['PENDIENTE_AUTORIZACION'];
        return estadosPermitidos.includes(estado);
      }
    });

    this.logger.log('Handlers de políticas predefinidos registrados');
  }

  /**
   * Registra un handler personalizado de política
   * @param handlerName Nombre del handler (debe coincidir con el campo 'handler' en BD)
   * @param handler Implementación del handler
   */
  registerHandler(handlerName: string, handler: PolicyHandler): void {
    this.policyHandlers.set(handlerName, handler);
    this.logger.debug(`Handler registrado: ${handlerName}`);
  }

  /**
   * Evalúa una política específica
   * @param policyCode Código de la política (ej: 'same_sucursal')
   * @param context Contexto de evaluación
   * @returns true si la política se cumple, false en caso contrario
   */
  async evaluatePolicy(policyCode: string, context: PolicyContext): Promise<boolean> {
    // Obtener política de la base de datos
    const policy = await this.prisma.politicas.findFirst({
      where: {
        codigo: policyCode,
        estado: 'ACTIVO'
      }
    });

    if (!policy) {
      this.logger.warn(`Política '${policyCode}' no encontrada o inactiva`);
      return false;
    }

    // Obtener handler
    const handler = this.policyHandlers.get(policy.handler);

    if (!handler) {
      this.logger.error(`Handler '${policy.handler}' no registrado para política '${policyCode}'`);
      return false;
    }

    // Evaluar política
    try {
      const result = await handler.handle(context, policy.configuracion || {});
      this.logger.debug(`Política '${policyCode}' evaluada: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Error evaluando política '${policyCode}': ${error.message}`);
      return false;
    }
  }

  /**
   * Evalúa múltiples políticas (todas deben cumplirse)
   * @param policyCodes Array de códigos de políticas
   * @param context Contexto de evaluación
   * @returns true si todas las políticas se cumplen
   */
  async evaluateAllPolicies(policyCodes: string[], context: PolicyContext): Promise<boolean> {
    const results = await Promise.all(
      policyCodes.map(code => this.evaluatePolicy(code, context))
    );

    return results.every(result => result === true);
  }

  /**
   * Evalúa múltiples políticas (al menos una debe cumplirse)
   * @param policyCodes Array de códigos de políticas
   * @param context Contexto de evaluación
   * @returns true si al menos una política se cumple
   */
  async evaluateAnyPolicy(policyCodes: string[], context: PolicyContext): Promise<boolean> {
    const results = await Promise.all(
      policyCodes.map(code => this.evaluatePolicy(code, context))
    );

    return results.some(result => result === true);
  }

  /**
   * Obtiene políticas asociadas a un permiso
   * @param permissionCode Código del permiso
   * @returns Array de códigos de políticas
   */
  async getPoliciesForPermission(permissionCode: string): Promise<string[]> {
    const permiso = await this.prisma.permisos.findUnique({
      where: { codigo: permissionCode },
      include: {
        permiso_politicas: {
          include: {
            politicas: true
          },
          where: {
            politicas: { estado: 'ACTIVO' }
          }
        }
      }
    });

    if (!permiso) {
      return [];
    }

    return permiso.permiso_politicas.map((pp: any) => pp.politicas.codigo);
  }

  /**
   * Construye un contexto de política desde un ExecutionContext de NestJS
   * @param executionContext ExecutionContext de NestJS
   * @param resource Recurso opcional (debe ser cargado previamente)
   * @returns PolicyContext
   */
  buildContextFromExecution(executionContext: ExecutionContext, resource?: any): PolicyContext {
    const request = executionContext.switchToHttp().getRequest();

    return {
      user: request.user,
      resource,
      params: request.params,
      query: request.query,
      body: request.body
    };
  }
}
