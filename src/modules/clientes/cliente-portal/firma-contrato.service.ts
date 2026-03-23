import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { ContratosService } from 'src/modules/atencion-al-cliente/contratos/contratos.service';

@Injectable()
export class FirmaContratoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contratosService: ContratosService,
  ) {}

  private static readonly INVALID_TOKEN_MSG = 'El enlace de firma no es válido o ha expirado';

  /**
   * Valida un token de firma y retorna info básica del contrato
   */
  async validarToken(token: string) {
    const firmaToken = await this.prisma.atcContratoFirmaToken.findUnique({
      where: { token },
      include: {
        contrato: {
          include: {
            cliente: {
              select: { titular: true, dui: true },
            },
            plan: {
              select: { nombre: true, precio: true },
            },
            direccionServicio: {
              include: {
                municipio: true,
                departamento: true,
              },
            },
          },
        },
      },
    });

    if (!firmaToken || firmaToken.is_used || new Date() > firmaToken.expires_at) {
      throw new BadRequestException(FirmaContratoService.INVALID_TOKEN_MSG);
    }

    if (firmaToken.contrato.estado !== 'PENDIENTE_FIRMA') {
      throw new BadRequestException(FirmaContratoService.INVALID_TOKEN_MSG);
    }

    const { contrato } = firmaToken;
    return {
      valid: true,
      contrato: {
        codigo: contrato.codigo,
        cliente_nombre: contrato.cliente?.titular || 'N/A',
        cliente_dui: contrato.cliente?.dui || 'N/A',
        plan_nombre: contrato.plan?.nombre || 'N/A',
        plan_precio: contrato.plan?.precio,
        direccion: contrato.direccionServicio?.direccion || '',
        municipio: contrato.direccionServicio?.municipio?.nombre || '',
        departamento: contrato.direccionServicio?.departamento?.nombre || '',
        meses_contrato: contrato.meses_contrato,
      },
    };
  }

  /**
   * Obtiene el PDF del contrato asociado al token
   */
  async obtenerPdf(token: string): Promise<Buffer> {
    const firmaToken = await this.validarTokenInterno(token);
    return this.contratosService.generatePdf(firmaToken.id_contrato);
  }

  private static readonly PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  /**
   * Procesa la firma online del contrato
   */
  async firmar(
    token: string,
    firma_base64: string,
    ip: string,
    userAgent: string,
  ) {
    const firmaToken = await this.validarTokenInterno(token);

    // Decodificar base64
    const base64Data = firma_base64.replace(/^data:image\/\w+;base64,/, '');
    const firmaBuffer = Buffer.from(base64Data, 'base64');

    // Validate PNG magic bytes
    if (firmaBuffer.length < 1000 || !firmaBuffer.subarray(0, 8).equals(FirmaContratoService.PNG_MAGIC)) {
      throw new BadRequestException('La firma proporcionada no es válida');
    }

    const contratoActualizado = await this.contratosService.marcarComoFirmadoOnline(
      firmaToken.id_contrato,
      firmaBuffer,
      ip,
      userAgent,
      token,
    );

    return {
      message: 'Contrato firmado exitosamente',
      contrato: {
        codigo: contratoActualizado.codigo,
        estado: contratoActualizado.estado,
      },
    };
  }

  /**
   * Validación interna del token (retorna el registro completo)
   */
  private async validarTokenInterno(token: string) {
    const firmaToken = await this.prisma.atcContratoFirmaToken.findUnique({
      where: { token },
    });

    if (!firmaToken || firmaToken.is_used || new Date() > firmaToken.expires_at) {
      throw new BadRequestException(FirmaContratoService.INVALID_TOKEN_MSG);
    }

    return firmaToken;
  }
}
