import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);

  onModuleInit() {
    if (!admin.apps.length) {
      try {
        // Usa GOOGLE_APPLICATION_CREDENTIALS del .env
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        this.logger.log('Firebase Admin SDK inicializado correctamente');
      } catch (error) {
        this.logger.error(`Error inicializando Firebase Admin SDK: ${error.message}`);
      }
    }
  }

  /**
   * Envía una notificación push a un dispositivo específico
   * @param token - Token FCM del dispositivo
   * @param title - Título de la notificación
   * @param body - Cuerpo de la notificación
   * @param data - Datos adicionales para la app (navegación, etc.)
   * @returns true si se envió correctamente, false si hubo error
   */
  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!token) {
      this.logger.warn('Intento de enviar notificación sin token');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title,
          body,
        },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'afis_channel',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Notificación enviada exitosamente. ID: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Error enviando notificación: ${error.message}`);
      // Si el token es inválido, podríamos limpiarlo de la BD
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        this.logger.warn(`Token FCM inválido o no registrado: ${token.substring(0, 20)}...`);
      }
      return false;
    }
  }

  /**
   * Envía una notificación push a múltiples dispositivos
   * @param tokens - Array de tokens FCM
   * @param title - Título de la notificación
   * @param body - Cuerpo de la notificación
   * @param data - Datos adicionales para la app
   * @returns Objeto con conteo de éxitos y fallos
   */
  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ success: number; failure: number }> {
    if (!tokens || tokens.length === 0) {
      return { success: 0, failure: 0 };
    }

    const results = await Promise.all(
      tokens.map(token => this.sendNotification(token, title, body, data)),
    );

    return {
      success: results.filter(r => r).length,
      failure: results.filter(r => !r).length,
    };
  }

  /**
   * Envía una notificación de orden asignada al técnico
   * @param fcmToken - Token FCM del técnico
   * @param codigoOrden - Código de la orden (ej: OT-202412-00001)
   * @param idOrden - ID numérico de la orden
   */
  async notificarOrdenAsignada(
    fcmToken: string,
    codigoOrden: string,
    idOrden: number,
  ): Promise<boolean> {
    return this.sendNotification(
      fcmToken,
      'Nueva Orden Asignada',
      `Se te ha asignado la orden ${codigoOrden}`,
      {
        type: 'ORDEN_ASIGNADA',
        id_orden: idOrden.toString(),
        codigo: codigoOrden,
      },
    );
  }

  /**
   * Envía una notificación de visita agendada al técnico
   * @param fcmToken - Token FCM del técnico
   * @param codigoOrden - Código de la orden
   * @param idOrden - ID numérico de la orden
   * @param fechaInicio - Fecha y hora de la visita
   */
  async notificarVisitaAgendada(
    fcmToken: string,
    codigoOrden: string,
    idOrden: number,
    fechaInicio: Date | string,
  ): Promise<boolean> {
    const fecha = new Date(fechaInicio);
    const fechaFormateada = fecha.toLocaleString('es-SV', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return this.sendNotification(
      fcmToken,
      'Visita Agendada',
      `Tienes una visita programada para ${fechaFormateada}`,
      {
        type: 'ORDEN_AGENDADA',
        id_orden: idOrden.toString(),
        codigo: codigoOrden,
        fecha_inicio: fecha.toISOString(),
      },
    );
  }
}
