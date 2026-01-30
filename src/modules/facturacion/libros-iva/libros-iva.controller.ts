import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { LibrosIvaService, ResumenLibroIva } from './libros-iva.service';
import { LibrosIvaExcelService } from './libros-iva-excel.service';
import { LibrosIvaPdfService } from './libros-iva-pdf.service';
import {
  QueryLibroIvaDto,
  TipoLibroIva,
  LibroIvaAnexo1ResponseDto,
  LibroIvaAnexo2ResponseDto,
  LibroIvaAnexo5ResponseDto,
} from './dto';

@ApiTags('Libros de IVA')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('facturacion/libros-iva')
@Auth()
export class LibrosIvaController {
  constructor(
    private readonly librosIvaService: LibrosIvaService,
    private readonly excelService: LibrosIvaExcelService,
    private readonly pdfService: LibrosIvaPdfService,
  ) {}

  @Get()
  @RequirePermissions('facturacion.libros_iva:ver')
  @ApiOperation({
    summary: 'Obtener datos del libro de IVA',
    description: 'Retorna los datos paginados del libro de IVA según el tipo (Anexo 1, 2 o 5)',
  })
  @ApiQuery({
    name: 'tipo_libro',
    enum: TipoLibroIva,
    description: 'Tipo de libro de IVA',
    example: 'ANEXO_1',
  })
  @ApiQuery({
    name: 'fecha_inicio',
    type: String,
    description: 'Fecha de inicio del período (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'fecha_fin',
    type: String,
    description: 'Fecha de fin del período (YYYY-MM-DD)',
    example: '2024-01-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del libro de IVA',
    type: LibroIvaAnexo1ResponseDto,
  })
  async getLibroIva(
    @Query() queryDto: QueryLibroIvaDto,
  ): Promise<LibroIvaAnexo1ResponseDto | LibroIvaAnexo2ResponseDto | LibroIvaAnexo5ResponseDto> {
    return this.librosIvaService.getLibroIva(queryDto);
  }

  @Get('resumen')
  @RequirePermissions('facturacion.libros_iva:ver')
  @ApiOperation({
    summary: 'Obtener resumen consolidado del libro de IVA',
    description: 'Retorna los totales consolidados del período seleccionado',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen del libro de IVA',
  })
  async getResumen(@Query() queryDto: QueryLibroIvaDto): Promise<ResumenLibroIva> {
    return this.librosIvaService.getResumen(queryDto);
  }

  @Get('excel')
  @RequirePermissions('facturacion.libros_iva:exportar')
  @ApiOperation({
    summary: 'Descargar libro de IVA en Excel',
    description: 'Genera y descarga el libro de IVA en formato Excel (.xlsx)',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo Excel del libro de IVA',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
    },
  })
  async downloadExcel(
    @Query() queryDto: QueryLibroIvaDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.excelService.generateExcel(queryDto);
    const filename = this.excelService.getFilename(
      queryDto.tipo_libro,
      queryDto.fecha_inicio,
      queryDto.fecha_fin,
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  @Get('pdf')
  @RequirePermissions('facturacion.libros_iva:exportar')
  @ApiOperation({
    summary: 'Descargar libro de IVA en PDF',
    description: 'Genera y descarga el libro de IVA en formato PDF',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo PDF del libro de IVA',
    content: {
      'application/pdf': {},
    },
  })
  async downloadPdf(
    @Query() queryDto: QueryLibroIvaDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.pdfService.generatePdf(queryDto);
    const filename = this.pdfService.getFilename(
      queryDto.tipo_libro,
      queryDto.fecha_inicio,
      queryDto.fecha_fin,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }
}
