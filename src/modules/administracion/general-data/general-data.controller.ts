// src/modules/administracion/general-data/general-data.controller.ts
import { Controller, Get, Body, Put, Req } from '@nestjs/common';
import { GeneralDataService } from './general-data.service';
import { UpdateGeneralDataDto } from './dto/update-general-data.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from 'src/modules/auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';

@ApiTags('General Data')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('general-data')
@Auth()
export class GeneralDataController {
  constructor(private readonly generalDataService: GeneralDataService) {}

  @Get()
  @RequirePermissions('administracion.general-data:ver')
  @ApiOperation({ summary: 'Obtener la configuración general del sistema' })
  @ApiResponse({ status: 200, description: 'Retorna la configuración general.' })
  findOne() {
    return this.generalDataService.findOne();
  }

  @Put()
  @RequirePermissions('administracion.general-data:editar')
  @ApiOperation({ summary: 'Actualizar la configuración general del sistema' })
  @ApiResponse({ status: 200, description: 'La configuración ha sido actualizada.' })
  @ApiResponse({ status: 400, description: 'Petición inválida.' })
  update(@Body() updateGeneralDataDto: UpdateGeneralDataDto, @Req() req: any) {
    const id_usuario = req.user?.id_usuario;
    return this.generalDataService.update(updateGeneralDataDto, id_usuario);
  }
}
