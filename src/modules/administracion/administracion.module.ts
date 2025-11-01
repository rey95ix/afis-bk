import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
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

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [
    CategoriasController,
    CatalogoController,
    UsuariosController,
    RolesController,
    DepartamentosController,
    MunicipiosController,
    ColoniasController,
    DteCatalogosController,
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
  ],
})
export class AdministracionModule { }
