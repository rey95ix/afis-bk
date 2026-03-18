import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';
import { PrismaService } from '../prisma/prisma.service';
import { OltCommandResult } from './interfaces/olt-command.interface';
import * as crypto from 'crypto';

@Injectable()
export class OltConnectionService {
  private readonly logger = new Logger(OltConnectionService.name);
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getEncryptionKey(): Buffer {
    const key = this.configService.get<string>('OLT_ENCRYPTION_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'OLT_ENCRYPTION_KEY no está configurada',
      );
    }
    return Buffer.from(key, 'hex');
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.getEncryptionKey(),
      iv,
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new InternalServerErrorException(
        'Formato de credencial encriptada inválido',
      );
    }
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.getEncryptionKey(),
      iv,
    );
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async executeCommand(
    idOltEquipo: number,
    command: string,
  ): Promise<OltCommandResult> {
    const credencial = await this.prisma.olt_credencial.findUnique({
      where: { id_olt_equipo: idOltEquipo },
      include: { equipo: true },
    });

    if (!credencial) {
      return {
        success: false,
        output: '',
        error: `No se encontraron credenciales para el equipo OLT ${idOltEquipo}`,
      };
    }

    const host = credencial.equipo.ip_address;
    const port = credencial.ssh_puerto;
    const username = this.decrypt(credencial.ssh_usuario);
    const password = this.decrypt(credencial.ssh_password);
    const promptPattern = credencial.prompt_pattern;

    const sshTimeout = this.configService.get<number>('OLT_SSH_TIMEOUT', 10000);
    const commandDelay = this.configService.get<number>(
      'OLT_COMMAND_DELAY',
      500,
    );
    const responseTimeout = this.configService.get<number>(
      'OLT_RESPONSE_TIMEOUT',
      15000,
    );

    return new Promise((resolve) => {
      const conn = new Client();
      let fullOutput = '';

      const timeout = setTimeout(() => {
        conn.end();
        resolve({
          success: false,
          output: fullOutput,
          error: 'Timeout de conexión SSH excedido',
        });
      }, responseTimeout + sshTimeout);

      conn
        .on('ready', () => {
          this.logger.log(`SSH conectado a ${host}:${port}`);

          conn.shell((err, stream) => {
            if (err) {
              clearTimeout(timeout);
              conn.end();
              resolve({ success: false, output: '', error: err.message });
              return;
            }

            stream.on('data', (data: Buffer) => {
              fullOutput += data.toString();
            });

            stream.on('close', () => {
              clearTimeout(timeout);
              conn.end();
              resolve({ success: true, output: fullOutput });
            });

            // Send commands line by line with delays
            const lines = command.split('\n');
            let lineIndex = 0;

            const sendNextLine = () => {
              if (lineIndex < lines.length) {
                stream.write(lines[lineIndex] + '\n');
                lineIndex++;
                setTimeout(sendNextLine, commandDelay);
              } else {
                // Wait for final response then close
                setTimeout(() => {
                  stream.end('quit\n');
                }, responseTimeout);
              }
            };

            // Wait for initial prompt then start sending
            setTimeout(sendNextLine, commandDelay);
          });
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          this.logger.error(`SSH error a ${host}:${port}: ${err.message}`);
          resolve({ success: false, output: fullOutput, error: err.message });
        })
        .connect({
          host,
          port,
          username,
          password,
          readyTimeout: sshTimeout,
          algorithms: {
            kex: [
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha256',
              'diffie-hellman-group14-sha1',
              'diffie-hellman-group1-sha1',
            ],
            cipher: [
              'aes256-ctr',
              'aes192-ctr',
              'aes128-ctr',
              'aes256-cbc',
              'aes128-cbc',
              '3des-cbc',
            ],
          },
        });
    });
  }

  async executeQuery(idOltEquipo: number, command: string): Promise<string> {
    const result = await this.executeCommand(idOltEquipo, command);
    if (!result.success) {
      throw new InternalServerErrorException(
        result.error || 'Error al consultar OLT',
      );
    }
    return result.output;
  }
}
