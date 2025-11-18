
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { CatalogosProveedoresService } from './catalogos-proveedores.service';

@ApiTags('Catalogos Proveedores')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('inventario/catalogos-proveedores')
@Auth()
export class CatalogosProveedoresController {
  constructor(private readonly catalogosService: CatalogosProveedoresService) {}

  @RequirePermissions('inventario.catalogos:ver')
  @Get('municipios')
  @ApiOperation({ summary: 'Obtener todos los municipios activos' })
  @ApiResponse({ status: 200, description: 'Retorna todos los municipios activos.' })
  findAllMunicipios() {
    return this.catalogosService.findAllMunicipios();
  }

  @RequirePermissions('inventario.catalogos:ver')
  @Get('tipos-documentos')
  @ApiOperation({ summary: 'Obtener todos los tipos de documentos de identificación activos' })
  @ApiResponse({ status: 200, description: 'Retorna todos los tipos de documentos de identificación activos.' })
  findAllTiposDocumentos() {
    return this.catalogosService.findAllTiposDocumentos();
  }

  @RequirePermissions('inventario.catalogos:ver')
  @Get('actividades-economicas')
  @ApiOperation({ summary: 'Obtener todas las actividades económicas activas' })
  @ApiResponse({ status: 200, description: 'Retorna todas las actividades económicas activas.' })
  findAllActividadesEconomicas() {
    return this.catalogosService.findAllActividadesEconomicas();
  }
}
