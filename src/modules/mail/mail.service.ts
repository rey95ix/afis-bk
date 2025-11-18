
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
