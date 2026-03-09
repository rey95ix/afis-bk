import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  Request,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CajaService } from './caja.service';
import { CajaPdfService } from './caja-pdf.service';
import { QueryCierresUsuariosDto } from './dto/caja.dto';

@ApiTags('Facturación - Caja')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('facturacion/caja')
export class CajaController {
  constructor(
    private readonly cajaService: CajaService,
    private readonly cajaPdfService: CajaPdfService,
  ) {}

  @Get('movimientos')
  @Auth()
  @ApiOperation({ summary: 'Obtener movimientos propios pendientes de cierre' })
  async getMovimientos(@Request() req: any) {
    const data = await this.cajaService.obtenerMovimientosPendientes(req.user.id_usuario);
    return { data };
  }

  @Post('cierre-usuario')
  @Auth()
  @ApiOperation({ summary: 'Generar cierre de caja del usuario autenticado' })
  async generarCierreUsuario(@Request() req: any) {
    const data = await this.cajaService.generarCierreUsuario(req.user.id_usuario);
    return { data };
  }

  @Get('mis-cierres')
  @Auth()
  @ApiOperation({ summary: 'Listar cierres propios del usuario autenticado' })
  async getMisCierres(@Request() req: any, @Query() query: PaginationDto) {
    const data = await this.cajaService.listarMisCierres(
      req.user.id_usuario,
      query.page,
      query.limit,
    );
    return data;
  }

  @Get('cierre-usuario/:id')
  @Auth()
  @ApiOperation({ summary: 'Ver detalle de un cierre de usuario' })
  async getCierreUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const data = await this.cajaService.obtenerCierreUsuario(id, req.user.id_usuario);
    return { data };
  }

  @Get('cierres-usuarios')
  @Auth()
  @RequirePermissions('caja.cierres:ver_todos')
  @ApiOperation({ summary: 'Listar todos los cierres de usuario (admin)' })
  async getCierresUsuarios(@Query() query: QueryCierresUsuariosDto) {
    const data = await this.cajaService.listarCierresUsuarios(
      query.page,
      query.limit,
      query.idUsuario,
    );
    return data;
  }

  @Get('cierres-usuarios/:id')
  @Auth()
  @RequirePermissions('caja.cierres:ver_todos')
  @ApiOperation({ summary: 'Ver detalle de un cierre de usuario (admin)' })
  async getCierreUsuarioAdmin(@Param('id', ParseIntPipe) id: number) {
    const data = await this.cajaService.obtenerCierreUsuario(id);
    return { data };
  }

  @Get('movimientos-diario')
  @Auth()
  @RequirePermissions('caja.cierre_diario:gestionar')
  @ApiOperation({ summary: 'Obtener movimientos pendientes de cierre diario' })
  async getMovimientosDiario() {
    const data = await this.cajaService.obtenerMovimientosPendientesDiario();
    return { data };
  }

  @Post('cierre-diario')
  @Auth()
  @RequirePermissions('caja.cierre_diario:gestionar')
  @ApiOperation({ summary: 'Generar cierre diario consolidado' })
  async generarCierreDiario(@Request() req: any) {
    const data = await this.cajaService.generarCierreDiario(req.user.id_usuario);
    return { data };
  }

  @Get('cierres-diarios')
  @Auth()
  @RequirePermissions('caja.cierre_diario:gestionar')
  @ApiOperation({ summary: 'Listar cierres diarios' })
  async getCierresDiarios(@Query() query: PaginationDto) {
    const data = await this.cajaService.listarCierresDiarios(query.page, query.limit);
    return data;
  }

  @Get('cierre-diario/:id')
  @Auth()
  @RequirePermissions('caja.cierre_diario:gestionar')
  @ApiOperation({ summary: 'Ver detalle de un cierre diario' })
  async getCierreDiario(@Param('id', ParseIntPipe) id: number) {
    const data = await this.cajaService.obtenerCierreDiario(id);
    return { data };
  }

  // ─── PDF Endpoints ───

  @Get('cierre-usuario/:id/pdf')
  @Auth()
  @ApiOperation({ summary: 'Descargar PDF de un cierre de usuario' })
  async getPdfCierreUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.cajaPdfService.generarPdfCierreUsuario(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Cierre_Usuario_${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('cierres-usuarios/:id/pdf')
  @Auth()
  @RequirePermissions('caja.cierres:ver_todos')
  @ApiOperation({ summary: 'Descargar PDF de un cierre de usuario (admin)' })
  async getPdfCierreUsuarioAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.cajaPdfService.generarPdfCierreUsuario(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Cierre_Usuario_${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('cierre-diario/:id/pdf')
  @Auth()
  @RequirePermissions('caja.cierre_diario:gestionar')
  @ApiOperation({ summary: 'Descargar PDF de un cierre diario' })
  async getPdfCierreDiario(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.cajaPdfService.generarPdfCierreDiario(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Cierre_Diario_${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('movimientos/pdf')
  @Auth()
  @ApiOperation({ summary: 'Descargar PDF de movimientos pendientes propios' })
  async getPdfMovimientosPendientes(
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const nombreUsuario = `${req.user.nombres} ${req.user.apellidos}`;
    const buffer = await this.cajaPdfService.generarPdfMovimientosPendientes(
      req.user.id_usuario,
      nombreUsuario,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Movimientos_Pendientes.pdf"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('movimientos-diario/pdf')
  @Auth()
  @RequirePermissions('caja.cierre_diario:gestionar')
  @ApiOperation({ summary: 'Descargar PDF de movimientos pendientes de cierre diario' })
  async getPdfMovimientosPendientesDiario(
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.cajaPdfService.generarPdfMovimientosPendientesDiario();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Movimientos_Pendientes_Diario.pdf"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
