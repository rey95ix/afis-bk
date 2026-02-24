
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interfaz para adjuntos de correo electrónico
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<boolean>('SMTP_SECURE'),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendPasswordResetEmail(user: { nombres: string; correo_electronico: string }, token: string) {
    const url = `${this.configService.get<string>('FRONTEND_URL')}/#/auth/reset-password/${token}`;
    const templatePath = path.join(process.cwd(), 'templates', 'auth', 'reset-password.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    html = html.replace(/{{name}}/g, user.nombres);
    html = html.replace(/{{url}}/g, url);

    await this.sendMail(
      user.correo_electronico,
      'Recuperación de Contraseña',
      `Para restablecer tu contraseña, por favor haz clic en el siguiente enlace: ${url}`,
      html,
    );
  }

  async sendWelcomeEmail(user: { nombres: string; correo_electronico: string }, temporaryPassword: string) {
    const loginUrl = `${this.configService.get<string>('FRONTEND_URL')}/#/auth/login`;
    const templatePath = path.join(process.cwd(), 'templates', 'auth', 'welcome.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    html = html.replace(/{{name}}/g, user.nombres);
    html = html.replace(/{{email}}/g, user.correo_electronico);
    html = html.replace(/{{password}}/g, temporaryPassword);
    html = html.replace(/{{loginUrl}}/g, loginUrl);

    await this.sendMail(
      user.correo_electronico,
      'Bienvenido a AFIS - Credenciales de Acceso',
      `Tu usuario ha sido creado. Usuario: ${user.correo_electronico}, Contraseña temporal: ${temporaryPassword}. Accede en: ${loginUrl}`,
      html,
    );
  }

  // ========================
  // MÉTODOS PARA PORTAL DE CLIENTES
  // ========================

  /**
   * Enviar correo de activación de cuenta para clientes del portal
   */
  async sendClienteActivacion(email: string, nombre: string, urlActivacion: string) {
    const templatePath = path.join(process.cwd(), 'templates', 'cliente-auth', 'activacion.html');
    let html: string;

    try {
      html = fs.readFileSync(templatePath, 'utf-8');
      html = html.replace(/{{nombre}}/g, nombre);
      html = html.replace(/{{url}}/g, urlActivacion);
      html = html.replace(/{{expiracion}}/g, '24 horas');
    } catch (error) {
      // Si no existe la plantilla, usar HTML básico
      html = this.getClienteActivacionHtmlFallback(nombre, urlActivacion);
    }

    await this.sendMail(
      email,
      'Activa tu cuenta - Portal de Clientes',
      `Hola ${nombre}, para activar tu cuenta en el portal de clientes, haz clic en: ${urlActivacion}. Este enlace expira en 24 horas.`,
      html,
    );
  }

  /**
   * Enviar correo de recuperación de contraseña para clientes del portal
   */
  async sendClienteResetPassword(email: string, nombre: string, urlReset: string) {
    const templatePath = path.join(process.cwd(), 'templates', 'cliente-auth', 'reset-password.html');
    let html: string;

    try {
      html = fs.readFileSync(templatePath, 'utf-8');
      html = html.replace(/{{nombre}}/g, nombre);
      html = html.replace(/{{url}}/g, urlReset);
      html = html.replace(/{{expiracion}}/g, '30 minutos');
    } catch (error) {
      // Si no existe la plantilla, usar HTML básico
      html = this.getClienteResetPasswordHtmlFallback(nombre, urlReset);
    }

    await this.sendMail(
      email,
      'Restablecer contraseña - Portal de Clientes',
      `Hola ${nombre}, para restablecer tu contraseña, haz clic en: ${urlReset}. Este enlace expira en 30 minutos.`,
      html,
    );
  }

  /**
   * HTML de respaldo para activación de cuenta
   */
  private getClienteActivacionHtmlFallback(nombre: string, url: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Portal de Clientes</h1>
          </div>
          <div class="content">
            <h2>Hola ${nombre},</h2>
            <p>Has solicitado activar tu cuenta en el Portal de Clientes.</p>
            <p>Haz clic en el siguiente botón para establecer tu contraseña y activar tu cuenta:</p>
            <p style="text-align: center;">
              <a href="${url}" class="button">Activar mi cuenta</a>
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 15px;">
              Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
            </p>
            <p style="font-size: 12px; color: #2563eb; word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">
              ${url}
            </p>
            <div class="warning">
              <strong>Importante:</strong> Este enlace expira en 24 horas. Si no solicitaste esta activación, ignora este correo.
            </div>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * HTML de respaldo para reset de contraseña
   */
  private getClienteResetPasswordHtmlFallback(nombre: string, url: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Restablecer Contraseña</h1>
          </div>
          <div class="content">
            <h2>Hola ${nombre},</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en el Portal de Clientes.</p>
            <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
            <p style="text-align: center;">
              <a href="${url}" class="button">Restablecer contraseña</a>
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 15px;">
              Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
            </p>
            <p style="font-size: 12px; color: #dc2626; word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">
              ${url}
            </p>
            <div class="warning">
              <strong>Importante:</strong> Este enlace expira en 30 minutos. Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá siendo válida.
            </div>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Enviar notificación de orden de compra aprobada al encargado
   */
  async sendOrdenCompraAprobada(
    email: string,
    nombre: string,
    codigoOC: string,
    observaciones?: string,
  ) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: #ffffff; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .info-box p { margin: 5px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Orden de Compra Aprobada</h1>
          </div>
          <div class="content">
            <h2>Hola ${nombre},</h2>
            <p>Se le informa que la siguiente orden de compra ha sido <strong>aprobada</strong> y requiere su seguimiento:</p>
            <div class="info-box">
              <p><strong>Código OC:</strong> ${codigoOC}</p>
              ${observaciones ? `<p><strong>Observaciones:</strong> ${observaciones}</p>` : ''}
            </div>
            <p>Por favor ingrese al sistema para revisar los detalles y dar seguimiento a esta orden de compra.</p>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} AFIS. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendMail(
      email,
      `Orden de Compra Aprobada - ${codigoOC}`,
      `La orden de compra ${codigoOC} ha sido aprobada y requiere su seguimiento.${observaciones ? ` Observaciones: ${observaciones}` : ''}`,
      html,
    );
  }

  private async sendMail(
    to: string,
    subject: string,
    text: string,
    html: string,
    attachments?: EmailAttachment[],
  ) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to,
        subject,
        text,
        html,
        attachments: attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      });
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Envía la factura electrónica (DTE) por correo con PDF y JSON adjuntos
   */
  async sendFacturaEmail(
    email: string,
    nombreCliente: string,
    numeroControl: string,
    codigoGeneracion: string,
    pdfBuffer: Buffer,
    dteJson: string,
  ): Promise<void> {
    const templatePath = path.join(
      process.cwd(),
      'templates',
      'facturacion',
      'email-factura.html',
    );
    let html: string;

    try {
      html = fs.readFileSync(templatePath, 'utf-8');
      html = html.replace(/{{nombreCliente}}/g, nombreCliente);
      html = html.replace(/{{numeroControl}}/g, numeroControl);
      html = html.replace(/{{codigoGeneracion}}/g, codigoGeneracion);
      html = html.replace(/{{fecha}}/g, new Date().toLocaleDateString('es-SV'));
    } catch (error) {
      html = this.getFacturaEmailFallback(
        nombreCliente,
        numeroControl,
        codigoGeneracion,
      );
    }

    const attachments: EmailAttachment[] = [
      {
        filename: `${codigoGeneracion}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
      {
        filename: `${codigoGeneracion}.json`,
        content: dteJson,
        contentType: 'application/json',
      },
    ];

    await this.sendMail(
      email,
      `Su Factura Electrónica - ${numeroControl}`,
      `Adjunto su documento tributario electrónico ${numeroControl}`,
      html,
      attachments,
    );
  }

  /**
   * HTML de respaldo para email de factura
   */
  private getFacturaEmailFallback(
    nombreCliente: string,
    numeroControl: string,
    codigoGeneracion: string,
  ): string {
    const fecha = new Date().toLocaleDateString('es-SV');
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2a3e52; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: #ffffff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .info-box p { margin: 5px 0; }
          .attachments { background: #e8f4fd; padding: 15px; border-radius: 4px; margin-top: 20px; }
          .attachments h4 { margin: 0 0 10px 0; color: #0066cc; }
          .attachments ul { margin: 0; padding-left: 20px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Documento Tributario Electrónico</h1>
          </div>
          <div class="content">
            <h2>Estimado/a ${nombreCliente},</h2>
            <p>Adjunto encontrará su Documento Tributario Electrónico (DTE) correspondiente a su transacción.</p>

            <div class="info-box">
              <p><strong>Número de Control:</strong> ${numeroControl}</p>
              <p><strong>Código de Generación:</strong> ${codigoGeneracion}</p>
              <p><strong>Fecha:</strong> ${fecha}</p>
            </div>

            <div class="attachments">
              <h4>Archivos adjuntos:</h4>
              <ul>
                <li>DTE-${numeroControl}.pdf - Documento en formato PDF</li>
                <li>DTE-${numeroControl}.json - Documento en formato JSON</li>
              </ul>
            </div>

            <p style="margin-top: 20px;">Puede verificar la autenticidad de este documento en el portal del Ministerio de Hacienda de El Salvador.</p>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} AFIS. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
