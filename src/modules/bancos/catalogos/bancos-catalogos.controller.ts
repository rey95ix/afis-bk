
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from 'src/modules/auth/decorators';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { HEADER_API_BEARER_AUTH } from 'src/common/const';
import { BancosCatalogosService } from './bancos-catalogos.service';

@ApiTags('Catalogos Bancos')
@ApiBearerAuth(HEADER_API_BEARER_AUTH)
@Controller('bancos/catalogos')
@Auth()
export class BancosCatalogosController {
  constructor(private readonly catalogosService: BancosCatalogosService) {}

  @RequirePermissions('bancos.cuentas:ver')
  @Get('bancos')
  @ApiOperation({ summary: 'Obtener todos los bancos activos' })
  @ApiResponse({ status: 200, description: 'Retorna todos los bancos activos.' })
  findAllBancos() {
    return this.catalogosService.findAllBancos();
  }

  @RequirePermissions('bancos.cuentas:ver')
  @Get('tipos-cuenta')
  @ApiOperation({ summary: 'Obtener todos los tipos de cuenta bancaria activos' })
  @ApiResponse({ status: 200, description: 'Retorna todos los tipos de cuenta bancaria activos.' })
  findAllTiposCuenta() {
    return this.catalogosService.findAllTiposCuenta();
  }
}
