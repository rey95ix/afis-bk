import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Query,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { CreateOrdenDto } from './dto/create-orden.dto';
import { UpdateOrdenDto } from './dto/update-orden.dto';
import { QueryOrdenDto } from './dto/query-orden.dto';
import { AsignarOrdenDto } from './dto/asignar-orden.dto';
import { AgendarOrdenDto } from './dto/agendar-orden.dto';
import { ReprogramarOrdenDto } from './dto/reprogramar-orden.dto';
import { CambiarEstadoOrdenDto } from './dto/cambiar-estado-orden.dto';
import { IniciarOrdenDto } from './dto/iniciar-orden.dto';
import { CerrarOrdenDto } from './dto/cerrar-orden.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger'; 
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { Auth } from 'src/modules/auth/decorators';

@ApiTags('Órdenes de Trabajo')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Auth()
@Controller('api/ordenes')
export class OrdenesTrabajoController {
  constructor(
    private readonly ordenesTrabajoService: OrdenesTrabajoService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una nueva orden de trabajo',
    description:
      'Crea una orden de trabajo manualmente (sin ticket) o desde un ticket escalado. Genera automáticamente el código de orden (OT-YYYYMM-#####).',
  })
  @ApiResponse({
    status: 201,
    description: 'Orden de trabajo creada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente, dirección o técnico no encontrado',
  })
  create(@Body() createOrdenDto: CreateOrdenDto, @Request() req) {
    return this.ordenesTrabajoService.create(
      createOrdenDto,
      req.user.id_usuario,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listar órdenes de trabajo con filtros',
    description:
      'Obtiene una lista paginada de órdenes de trabajo con opciones de filtrado por estado, técnico, tipo, cliente y rango de fechas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes obtenida exitosamente',
  })
  findAll(@Query() queryDto: QueryOrdenDto) {
    return this.ordenesTrabajoService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una orden de trabajo por ID',
    description:
      'Obtiene los detalles completos de una orden incluyendo cliente, dirección, técnico, ticket, actividades, materiales, evidencias, agenda e historial de estados.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordenesTrabajoService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar una orden de trabajo',
    description: 'Permite actualizar campos generales de la orden de trabajo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo actualizada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrdenDto: UpdateOrdenDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.update(
      id,
      updateOrdenDto,
      req.user.id_usuario,
    );
  }

  @Post(':id/asignar')
  @ApiOperation({
    summary: 'Asignar técnico a una orden de trabajo',
    description:
      'Asigna un técnico a la orden y actualiza el estado a ASIGNADA. Registra la fecha de asignación y crea un registro en el historial de estados.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Técnico asignado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo o técnico no encontrado',
  })
  asignar(
    @Param('id', ParseIntPipe) id: number,
    @Body() asignarDto: AsignarOrdenDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.asignar(id, asignarDto, req.user.id_usuario);
  }

  @Post(':id/agendar')
  @ApiOperation({
    summary: 'Agendar una visita técnica',
    description:
      'Crea una agenda de visita con ventana de tiempo (inicio/fin). Marca agendas anteriores como inactivas. Actualiza el estado de la orden a AGENDADA.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Visita agendada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de agenda inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  agendar(
    @Param('id', ParseIntPipe) id: number,
    @Body() agendarDto: AgendarOrdenDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.agendar(id, agendarDto, req.user.id_usuario);
  }

  @Post(':id/reprogramar')
  @ApiOperation({
    summary: 'Reprogramar una visita técnica',
    description:
      'Reprograma la visita técnica creando una nueva agenda con un motivo. Marca la agenda anterior como inactiva y actualiza el estado a REPROGRAMADA.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Visita reprogramada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de reprogramación inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  reprogramar(
    @Param('id', ParseIntPipe) id: number,
    @Body() reprogramarDto: ReprogramarOrdenDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.reprogramar(
      id,
      reprogramarDto,
      req.user.id_usuario,
    );
  }

  @Post(':id/cambiar-estado')
  @UseInterceptors(
    FilesInterceptor('archivos', 10, {
      storage: diskStorage({
        destination: './uploads/evidencias',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `evidencia-${uniqueSuffix}${ext}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/pdf',
          'image/gif',
          'video/mp4',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              'Tipo de archivo no permitido. Solo se aceptan imágenes, PDFs y videos.',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ApiOperation({
    summary: 'Cambiar el estado de una orden de trabajo',
    description:
      'Cambia el estado de la orden y registra el cambio en el historial con un comentario opcional. Opcionalmente permite subir archivos de evidencia.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Estado cambiado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() cambiarEstadoDto: CambiarEstadoOrdenDto,
    @Request() req,
    @UploadedFiles() archivos?: Express.Multer.File[],
  ) {
    return this.ordenesTrabajoService.cambiarEstado(
      id,
      cambiarEstadoDto,
      req.user.id_usuario,
      archivos,
    );
  }

  @Post(':id/iniciar')
  @ApiOperation({
    summary: 'Iniciar el trabajo en campo',
    description:
      'Marca el inicio del trabajo en campo. Registra fecha de llegada y fecha de inicio. Actualiza el estado a EN_PROGRESO.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Trabajo iniciado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  iniciar(
    @Param('id', ParseIntPipe) id: number,
    @Body() iniciarDto: IniciarOrdenDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.iniciar(id, iniciarDto, req.user.id_usuario);
  }

  @Post(':id/cerrar')
  @UseInterceptors(
    FilesInterceptor('archivos', 10, {
      storage: diskStorage({
        destination: './uploads/evidencias',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `evidencia-cierre-${uniqueSuffix}${ext}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/pdf',
          'image/gif',
          'video/mp4',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              'Tipo de archivo no permitido. Solo se aceptan imágenes, PDFs y videos.',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ApiOperation({
    summary: 'Cerrar una orden de trabajo',
    description:
      'Cierra la orden con un resultado (RESUELTO, NO_RESUELTO, etc.). Permite subir archivos de evidencia. Registra notas de cierre, motivo y calificación del cliente opcional.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Orden cerrada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'No se puede cerrar la orden (falta evidencias)',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  cerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cerrarDto: CerrarOrdenDto,
    @Request() req,
    @UploadedFiles() archivos?: Express.Multer.File[],
  ) {
    return this.ordenesTrabajoService.cerrar(id, cerrarDto, req.user.id_usuario, archivos);
  }

  // === Actividades ===

  @Post(':id/actividades')
  @ApiOperation({
    summary: 'Crear una actividad en la orden de trabajo',
    description:
      'Registra una actividad realizada por el técnico durante la visita. Puede incluir valores medidos (potencia, SNR, etc.) y referencia a soluciones del catálogo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Actividad creada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  createActividad(
    @Param('id', ParseIntPipe) id: number,
    @Body() createActividadDto: CreateActividadDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.createActividad(
      id,
      createActividadDto,
      req.user.id_usuario,
    );
  }

  @Put(':id/actividades/:idActividad')
  @ApiOperation({
    summary: 'Actualizar una actividad',
    description: 'Actualiza los datos de una actividad existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiParam({
    name: 'idActividad',
    description: 'ID de la actividad',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Actividad actualizada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Actividad no encontrada',
  })
  updateActividad(
    @Param('id', ParseIntPipe) id: number,
    @Param('idActividad', ParseIntPipe) idActividad: number,
    @Body() updateActividadDto: UpdateActividadDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.updateActividad(
      id,
      idActividad,
      updateActividadDto,
      req.user.id_usuario,
    );
  }

  // === Materiales ===

  @Post(':id/materiales')
  @ApiOperation({
    summary: 'Agregar un material a la orden de trabajo',
    description:
      'Registra un material/insumo utilizado durante la visita técnica. Incluye SKU, nombre, cantidad, serie (si aplica) y costo unitario.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Material agregado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  createMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Body() createMaterialDto: CreateMaterialDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.createMaterial(
      id,
      createMaterialDto,
      req.user.id_usuario,
    );
  }

  @Delete(':id/materiales/:idMaterial')
  @ApiOperation({
    summary: 'Eliminar un material de la orden de trabajo',
    description: 'Elimina un material previamente registrado.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiParam({
    name: 'idMaterial',
    description: 'ID del material',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Material eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Material no encontrado',
  })
  deleteMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Param('idMaterial', ParseIntPipe) idMaterial: number,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.deleteMaterial(
      id,
      idMaterial,
      req.user.id_usuario,
    );
  }

  // === Evidencias ===

  @Post(':id/evidencias')
  @ApiOperation({
    summary: 'Agregar una evidencia a la orden de trabajo',
    description:
      'Sube metadata de evidencia (foto, speedtest, firma, audio). El archivo real se debe subir previamente a S3/Cloud y proporcionar la URL. Incluye tipo de evidencia y metadata opcional en JSON.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Evidencia agregada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  createEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @Body() createEvidenciaDto: CreateEvidenciaDto,
    @Request() req,
  ) {
    return this.ordenesTrabajoService.createEvidencia(
      id,
      createEvidenciaDto,
      req.user.id_usuario,
    );
  }

  @Get(':id/evidencias')
  @ApiOperation({
    summary: 'Obtener todas las evidencias de una orden de trabajo',
    description:
      'Obtiene la lista completa de evidencias asociadas a la orden de trabajo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de evidencias obtenida exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada',
  })
  getEvidencias(@Param('id', ParseIntPipe) id: number) {
    return this.ordenesTrabajoService.getEvidencias(id);
  }
}
