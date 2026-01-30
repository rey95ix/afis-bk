import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { CategoriasController } from './categorias/categorias.controller';
import { CategoriasService } from './categorias/categorias.service';
import { CatalogoController } from './catalogo/catalogo.controller';
import { CatalogoService } from './catalogo/catalogo.service';
import { UsuariosController } from './usuarios/usuarios.controller';
import { UsuariosService } from './usuarios/usuarios.service';
import { RolesService } from './roles/roles.service';
import { RolesController } from './roles/roles.controller';
import { DepartamentosController } from './departamentos/departamentos.controller';
import { DepartamentosService } from './departamentos/departamentos.service';
import { MunicipiosController } from './municipios/municipios.controller';
import { MunicipiosService } from './municipios/municipios.service';
import { ColoniasController } from './colonias/colonias.controller';
import { ColoniasService } from './colonias/colonias.service';
import { DteCatalogosController } from './dte-catalogos/dte-catalogos.controller';
import { DteCatalogosService } from './dte-catalogos/dte-catalogos.service';
import { DiagnosticosCatalogoService } from './diagnosticos-catalogo/diagnosticos-catalogo.service';
import { DiagnosticosCatalogoController } from './diagnosticos-catalogo/diagnosticos-catalogo.controller';
import { AtcPlanController } from './atc-plan/atc-plan.controller';
import { AtcPlanService } from './atc-plan/atc-plan.service';
import { MarcasController } from './marcas/marcas.controller';
import { MarcasService } from './marcas/marcas.service';
import { ModelosController } from './modelos/modelos.controller';
import { ModelosService } from './modelos/modelos.service';
import { FacturasBloquesController } from './facturas-bloques/facturas-bloques.controller';
import { FacturasBloquesService } from './facturas-bloques/facturas-bloques.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    MailModule
  ],
  controllers: [
    CategoriasController,
    CatalogoController,
    UsuariosController,
    RolesController,
    DepartamentosController,
    MunicipiosController,
    ColoniasController,
    DteCatalogosController,
    DiagnosticosCatalogoController,
    AtcPlanController,
    MarcasController,
    ModelosController,
    FacturasBloquesController
  ],
  providers: [
    CategoriasService,
    CatalogoService,
    UsuariosService,
    RolesService,
    DepartamentosService,
    MunicipiosService,
    ColoniasService,
    DteCatalogosService,
    DiagnosticosCatalogoService,
    AtcPlanService,
    MarcasService,
    ModelosService,
    FacturasBloquesService
  ],
})
export class AdministracionModule { }
