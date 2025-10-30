import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoriasController } from './categorias/categorias.controller';
import { CategoriasService } from './categorias/categorias.service';
import { CatalogoController } from './catalogo/catalogo.controller';
import { CatalogoService } from './catalogo/catalogo.service';
@Module({

  imports: [AuthModule, PrismaModule],
  controllers: [CategoriasController, CatalogoController],
  providers: [CategoriasService, CatalogoService],
})
export class AdministracionModule { }
