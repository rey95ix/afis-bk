import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ClienteAuth } from '../cliente-auth/decorators/cliente-auth.decorator';
import { GetCliente } from '../cliente-auth/decorators/get-cliente.decorator';
import type { ClienteAutenticado } from '../cliente-auth/interfaces';
import { ClientePortalService } from './cliente-portal.service';

@ApiTags('Portal de Clientes - Contratos')
@ClienteAuth()
@Controller('cliente-portal')
export class ClientePortalController {
  constructor(private readonly portalService: ClientePortalService) {}

  @Get('contratos')
  @ApiOperation({ summary: 'Listar contratos del cliente autenticado' })
  async getContratos(@GetCliente() cliente: ClienteAutenticado) {
    const data = await this.portalService.obtenerContratos(cliente.id_cliente);
    return { data };
  }

  @Get('contratos/:id')
  @ApiOperation({ summary: 'Detalle de un contrato' })
  @ApiParam({ name: 'id', type: Number })
  async getContratoDetalle(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.portalService.obtenerContratoDetalle(
      cliente.id_cliente,
      id,
    );
    return { data };
  }

  @Get('contratos/:id/facturas')
  @ApiOperation({ summary: 'Facturas de un contrato' })
  @ApiParam({ name: 'id', type: Number })
  async getFacturasContrato(
    @GetCliente() cliente: ClienteAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.portalService.obtenerFacturasContrato(
      cliente.id_cliente,
      id,
    );
    return { data };
  }
}
