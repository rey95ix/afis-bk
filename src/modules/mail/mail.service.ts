
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

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

  private async sendMail(to: string, subject: string, text: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      console.log(error)
    }
  }
}
