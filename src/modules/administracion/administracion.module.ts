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
@Module({

  imports: [AuthModule, PrismaModule],
  controllers: [CategoriasController, CatalogoController, UsuariosController, RolesController],
  providers: [CategoriasService, CatalogoService, UsuariosService, RolesService],
})
export class AdministracionModule { }
