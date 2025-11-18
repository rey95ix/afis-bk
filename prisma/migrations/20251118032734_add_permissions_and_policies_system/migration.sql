-- CreateEnum
CREATE TYPE "tipo_permiso" AS ENUM ('RECURSO', 'FUNCIONAL');

-- CreateEnum
CREATE TYPE "tipo_accion" AS ENUM ('VER', 'CREAR', 'EDITAR', 'ELIMINAR', 'APROBAR', 'RECHAZAR', 'EXPORTAR', 'IMPRIMIR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "tipo_politica" AS ENUM ('SUCURSAL', 'PROPIETARIO', 'ESTADO_RECURSO', 'CUSTOM');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "descripcion" TEXT;

-- CreateTable
CREATE TABLE "permisos" (
    "id_permiso" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "modulo" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "accion" "tipo_accion" NOT NULL,
    "tipo" "tipo_permiso" NOT NULL DEFAULT 'RECURSO',
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "es_critico" BOOLEAN NOT NULL DEFAULT false,
    "requiere_auditoria" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id_permiso")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "id_rol_permiso" SERIAL NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("id_rol_permiso")
);

-- CreateTable
CREATE TABLE "usuario_permisos" (
    "id_usuario_permiso" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "asignado_por" INTEGER,
    "motivo" TEXT,
    "fecha_expiracion" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_permisos_pkey" PRIMARY KEY ("id_usuario_permiso")
);

-- CreateTable
CREATE TABLE "politicas" (
    "id_politica" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "tipo_politica" NOT NULL,
    "configuracion" JSONB,
    "handler" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "politicas_pkey" PRIMARY KEY ("id_politica")
);

-- CreateTable
CREATE TABLE "permiso_politicas" (
    "id_permiso_politica" SERIAL NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "id_politica" INTEGER NOT NULL,
    "es_obligatoria" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permiso_politicas_pkey" PRIMARY KEY ("id_permiso_politica")
);

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "permisos_modulo_idx" ON "permisos"("modulo");

-- CreateIndex
CREATE INDEX "permisos_recurso_idx" ON "permisos"("recurso");

-- CreateIndex
CREATE INDEX "permisos_accion_idx" ON "permisos"("accion");

-- CreateIndex
CREATE INDEX "permisos_estado_idx" ON "permisos"("estado");

-- CreateIndex
CREATE INDEX "rol_permisos_id_rol_idx" ON "rol_permisos"("id_rol");

-- CreateIndex
CREATE INDEX "rol_permisos_id_permiso_idx" ON "rol_permisos"("id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "rol_permisos_id_rol_id_permiso_key" ON "rol_permisos"("id_rol", "id_permiso");

-- CreateIndex
CREATE INDEX "usuario_permisos_id_usuario_idx" ON "usuario_permisos"("id_usuario");

-- CreateIndex
CREATE INDEX "usuario_permisos_id_permiso_idx" ON "usuario_permisos"("id_permiso");

-- CreateIndex
CREATE INDEX "usuario_permisos_fecha_expiracion_idx" ON "usuario_permisos"("fecha_expiracion");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_permisos_id_usuario_id_permiso_key" ON "usuario_permisos"("id_usuario", "id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_codigo_key" ON "politicas"("codigo");

-- CreateIndex
CREATE INDEX "politicas_tipo_idx" ON "politicas"("tipo");

-- CreateIndex
CREATE INDEX "politicas_estado_idx" ON "politicas"("estado");

-- CreateIndex
CREATE INDEX "permiso_politicas_id_permiso_idx" ON "permiso_politicas"("id_permiso");

-- CreateIndex
CREATE INDEX "permiso_politicas_id_politica_idx" ON "permiso_politicas"("id_politica");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_politicas_id_permiso_id_politica_key" ON "permiso_politicas"("id_permiso", "id_politica");

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id_permiso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permisos" ADD CONSTRAINT "usuario_permisos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permisos" ADD CONSTRAINT "usuario_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id_permiso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permiso_politicas" ADD CONSTRAINT "permiso_politicas_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id_permiso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permiso_politicas" ADD CONSTRAINT "permiso_politicas_id_politica_fkey" FOREIGN KEY ("id_politica") REFERENCES "politicas"("id_politica") ON DELETE CASCADE ON UPDATE CASCADE;
