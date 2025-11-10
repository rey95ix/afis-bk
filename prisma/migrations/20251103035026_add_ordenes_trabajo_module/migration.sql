-- CreateEnum
CREATE TYPE "estado_ticket" AS ENUM ('ABIERTO', 'EN_DIAGNOSTICO', 'ESCALADO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "canal_contacto" AS ENUM ('TELEFONO', 'WHATSAPP', 'EMAIL', 'APP', 'WEB');

-- CreateEnum
CREATE TYPE "severidad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "estado_orden" AS ENUM ('PENDIENTE_ASIGNACION', 'ASIGNADA', 'AGENDADA', 'EN_RUTA', 'EN_PROGRESO', 'EN_ESPERA_CLIENTE', 'REPROGRAMADA', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "tipo_orden" AS ENUM ('INCIDENCIA', 'INSTALACION', 'MANTENIMIENTO', 'REUBICACION', 'RETIRO', 'MEJORA');

-- CreateEnum
CREATE TYPE "resultado_orden" AS ENUM ('RESUELTO', 'NO_RESUELTO', 'REQUIERE_SEGUNDA_VISITA', 'CLIENTE_AUSENTE', 'ACCESO_DENEGADO', 'FALLO_EQUIPO');

-- CreateTable
CREATE TABLE "ticket_soporte" (
    "id_ticket" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "canal" "canal_contacto" NOT NULL,
    "descripcion_problema" TEXT NOT NULL,
    "severidad" "severidad" NOT NULL DEFAULT 'MEDIA',
    "id_direccion_servicio" INTEGER,
    "diagnostico_inicial" TEXT,
    "id_diagnostico_catalogo" INTEGER,
    "pruebas_remotas" TEXT,
    "requiere_visita" BOOLEAN NOT NULL DEFAULT false,
    "estado" "estado_ticket" NOT NULL DEFAULT 'ABIERTO',
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),
    "cerrado_por_usuario" INTEGER,
    "observaciones_cierre" TEXT,

    CONSTRAINT "ticket_soporte_pkey" PRIMARY KEY ("id_ticket")
);

-- CreateTable
CREATE TABLE "diagnostico_catalogo" (
    "id_diagnostico" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostico_catalogo_pkey" PRIMARY KEY ("id_diagnostico")
);

-- CreateTable
CREATE TABLE "solucion_catalogo" (
    "id_solucion" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solucion_catalogo_pkey" PRIMARY KEY ("id_solucion")
);

-- CreateTable
CREATE TABLE "motivo_cierre_catalogo" (
    "id_motivo" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motivo_cierre_catalogo_pkey" PRIMARY KEY ("id_motivo")
);

-- CreateTable
CREATE TABLE "orden_trabajo" (
    "id_orden" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "id_ticket" INTEGER NOT NULL,
    "tipo" "tipo_orden" NOT NULL,
    "estado" "estado_orden" NOT NULL DEFAULT 'PENDIENTE_ASIGNACION',
    "id_cliente" INTEGER NOT NULL,
    "id_direccion_servicio" INTEGER NOT NULL,
    "id_tecnico_asignado" INTEGER,
    "ventana_programada_inicio" TIMESTAMP(3),
    "ventana_programada_fin" TIMESTAMP(3),
    "fecha_asignacion" TIMESTAMP(3),
    "fecha_llegada" TIMESTAMP(3),
    "fecha_inicio_trabajo" TIMESTAMP(3),
    "fecha_fin_trabajo" TIMESTAMP(3),
    "resultado" "resultado_orden",
    "id_motivo_cierre" INTEGER,
    "observaciones_tecnico" TEXT,
    "firma_cliente_url" TEXT,
    "calificacion_cliente" INTEGER,
    "notas_cierre" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orden_trabajo_pkey" PRIMARY KEY ("id_orden")
);

-- CreateTable
CREATE TABLE "ot_historial_estado" (
    "id_historial" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "estado" "estado_orden" NOT NULL,
    "comentario" TEXT,
    "cambiado_por" INTEGER NOT NULL,
    "fecha_cambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ot_historial_estado_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "ot_actividades" (
    "id_actividad" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "id_solucion" INTEGER,
    "descripcion" TEXT NOT NULL,
    "valor_medido" TEXT,
    "requerido_firma" BOOLEAN NOT NULL DEFAULT false,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ot_actividades_pkey" PRIMARY KEY ("id_actividad")
);

-- CreateTable
CREATE TABLE "ot_materiales" (
    "id_material" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "serie" TEXT,
    "costo_unitario" DECIMAL(10,2),
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ot_materiales_pkey" PRIMARY KEY ("id_material")
);

-- CreateTable
CREATE TABLE "ot_evidencias" (
    "id_evidencia" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "metadata" TEXT,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subido_por" INTEGER NOT NULL,

    CONSTRAINT "ot_evidencias_pkey" PRIMARY KEY ("id_evidencia")
);

-- CreateTable
CREATE TABLE "agenda_visitas" (
    "id_agenda" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "id_tecnico" INTEGER,
    "motivo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_por" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_visitas_pkey" PRIMARY KEY ("id_agenda")
);

-- CreateIndex
CREATE UNIQUE INDEX "diagnostico_catalogo_codigo_key" ON "diagnostico_catalogo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "solucion_catalogo_codigo_key" ON "solucion_catalogo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "motivo_cierre_catalogo_codigo_key" ON "motivo_cierre_catalogo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "orden_trabajo_codigo_key" ON "orden_trabajo"("codigo");

-- AddForeignKey
ALTER TABLE "ticket_soporte" ADD CONSTRAINT "ticket_soporte_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_soporte" ADD CONSTRAINT "ticket_soporte_id_direccion_servicio_fkey" FOREIGN KEY ("id_direccion_servicio") REFERENCES "clienteDirecciones"("id_cliente_direccion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_soporte" ADD CONSTRAINT "ticket_soporte_id_diagnostico_catalogo_fkey" FOREIGN KEY ("id_diagnostico_catalogo") REFERENCES "diagnostico_catalogo"("id_diagnostico") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "ticket_soporte"("id_ticket") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_id_direccion_servicio_fkey" FOREIGN KEY ("id_direccion_servicio") REFERENCES "clienteDirecciones"("id_cliente_direccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_id_tecnico_asignado_fkey" FOREIGN KEY ("id_tecnico_asignado") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_id_motivo_cierre_fkey" FOREIGN KEY ("id_motivo_cierre") REFERENCES "motivo_cierre_catalogo"("id_motivo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_historial_estado" ADD CONSTRAINT "ot_historial_estado_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "orden_trabajo"("id_orden") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_actividades" ADD CONSTRAINT "ot_actividades_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "orden_trabajo"("id_orden") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_actividades" ADD CONSTRAINT "ot_actividades_id_solucion_fkey" FOREIGN KEY ("id_solucion") REFERENCES "solucion_catalogo"("id_solucion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_materiales" ADD CONSTRAINT "ot_materiales_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "orden_trabajo"("id_orden") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_evidencias" ADD CONSTRAINT "ot_evidencias_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "orden_trabajo"("id_orden") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_visitas" ADD CONSTRAINT "agenda_visitas_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "orden_trabajo"("id_orden") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_visitas" ADD CONSTRAINT "agenda_visitas_id_tecnico_fkey" FOREIGN KEY ("id_tecnico") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
/*
  Warnings:

  - Made the column `id_direccion_servicio` on table `ticket_soporte` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."orden_trabajo" DROP CONSTRAINT "orden_trabajo_id_ticket_fkey";

-- DropForeignKey
ALTER TABLE "public"."ticket_soporte" DROP CONSTRAINT "ticket_soporte_id_direccion_servicio_fkey";

-- AlterTable
ALTER TABLE "orden_trabajo" ALTER COLUMN "id_ticket" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ticket_soporte" ALTER COLUMN "id_direccion_servicio" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ticket_soporte" ADD CONSTRAINT "ticket_soporte_id_direccion_servicio_fkey" FOREIGN KEY ("id_direccion_servicio") REFERENCES "clienteDirecciones"("id_cliente_direccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "ticket_soporte"("id_ticket") ON DELETE SET NULL ON UPDATE CASCADE;
-- AlterEnum
ALTER TYPE "estado" ADD VALUE 'SUPENDIDO';

-- AddForeignKey
ALTER TABLE "ot_historial_estado" ADD CONSTRAINT "ot_historial_estado_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_evidencias" ADD CONSTRAINT "ot_evidencias_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
