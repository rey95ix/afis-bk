import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { FirmaContratoService } from './firma-contrato.service';
import { FirmarContratoOnlineDto } from './dto/firmar-contrato-online.dto';

@ApiTags('Firma de Contrato Online')
@Controller('firma-contrato')
@UseGuards(ThrottlerGuard)
export class FirmaContratoController {
  constructor(private readonly firmaContratoService: FirmaContratoService) {}

  @Get(':token/validar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Validar token de firma',
    description: 'Valida el token y retorna información básica del contrato.',
  })
  @ApiParam({ name: 'token', description: 'Token de firma único' })
  @ApiResponse({ status: 200, description: 'Token válido, retorna datos del contrato.' })
  @ApiResponse({ status: 400, description: 'Token expirado o contrato ya firmado.' })
  @ApiResponse({ status: 404, description: 'Token no encontrado.' })
  validarToken(@Param('token') token: string) {
    return this.firmaContratoService.validarToken(token);
  }

  @Get(':token/pdf')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Obtener PDF del contrato',
    description: 'Genera y retorna el PDF del contrato asociado al token.',
  })
  @ApiParam({ name: 'token', description: 'Token de firma único' })
  @ApiResponse({ status: 200, description: 'PDF del contrato.' })
  @ApiResponse({ status: 400, description: 'Token expirado o inválido.' })
  @ApiResponse({ status: 404, description: 'Token no encontrado.' })
  async obtenerPdf(@Param('token') token: string, @Res() res: Response) {
    const pdfBuffer = await this.firmaContratoService.obtenerPdf(token);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Contrato.pdf"',
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post(':token/firmar')
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @ApiOperation({
    summary: 'Firmar contrato en línea',
    description: 'Recibe la firma en base64 y procesa la firma del contrato.',
  })
  @ApiParam({ name: 'token', description: 'Token de firma único' })
  @ApiResponse({ status: 200, description: 'Contrato firmado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Token expirado, contrato ya firmado o firma inválida.' })
  @ApiResponse({ status: 404, description: 'Token no encontrado.' })
  firmar(
    @Param('token') token: string,
    @Body() dto: FirmarContratoOnlineDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const safeUserAgent = (userAgent || '').slice(0, 512);
    return this.firmaContratoService.firmar(token, dto.firma_base64, ip, safeUserAgent);
  }
}
