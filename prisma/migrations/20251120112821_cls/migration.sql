-- CreateEnum
CREATE TYPE "estado_salida_temporal" AS ENUM ('PROCESADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "salidas_temporales_ot" (
    "id_salida_temporal" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "id_orden_trabajo" INTEGER NOT NULL,
    "id_bodega_origen" INTEGER NOT NULL,
    "id_usuario_crea" INTEGER NOT NULL,
    "url_foto_formulario" TEXT NOT NULL,
    "estado" "estado_salida_temporal" NOT NULL DEFAULT 'PROCESADA',
    "observaciones" TEXT,
    "fecha_salida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salidas_temporales_ot_pkey" PRIMARY KEY ("id_salida_temporal")
);

-- CreateTable
CREATE TABLE "salidas_temporales_ot_detalle" (
    "id_detalle" SERIAL NOT NULL,
    "id_salida_temporal" INTEGER NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "id_serie" INTEGER,
    "costo_unitario" DECIMAL(10,2),
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salidas_temporales_ot_detalle_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateIndex
CREATE UNIQUE INDEX "salidas_temporales_ot_codigo_key" ON "salidas_temporales_ot"("codigo");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_codigo_idx" ON "salidas_temporales_ot"("codigo");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_id_orden_trabajo_idx" ON "salidas_temporales_ot"("id_orden_trabajo");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_id_bodega_origen_idx" ON "salidas_temporales_ot"("id_bodega_origen");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_id_usuario_crea_idx" ON "salidas_temporales_ot"("id_usuario_crea");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_estado_idx" ON "salidas_temporales_ot"("estado");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_fecha_salida_idx" ON "salidas_temporales_ot"("fecha_salida");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_detalle_id_salida_temporal_idx" ON "salidas_temporales_ot_detalle"("id_salida_temporal");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_detalle_id_catalogo_idx" ON "salidas_temporales_ot_detalle"("id_catalogo");

-- CreateIndex
CREATE INDEX "salidas_temporales_ot_detalle_id_serie_idx" ON "salidas_temporales_ot_detalle"("id_serie");

-- AddForeignKey
ALTER TABLE "salidas_temporales_ot" ADD CONSTRAINT "salidas_temporales_ot_id_orden_trabajo_fkey" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salidas_temporales_ot" ADD CONSTRAINT "salidas_temporales_ot_id_bodega_origen_fkey" FOREIGN KEY ("id_bodega_origen") REFERENCES "bodegas"("id_bodega") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salidas_temporales_ot" ADD CONSTRAINT "salidas_temporales_ot_id_usuario_crea_fkey" FOREIGN KEY ("id_usuario_crea") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salidas_temporales_ot_detalle" ADD CONSTRAINT "salidas_temporales_ot_detalle_id_salida_temporal_fkey" FOREIGN KEY ("id_salida_temporal") REFERENCES "salidas_temporales_ot"("id_salida_temporal") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salidas_temporales_ot_detalle" ADD CONSTRAINT "salidas_temporales_ot_detalle_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salidas_temporales_ot_detalle" ADD CONSTRAINT "salidas_temporales_ot_detalle_id_serie_fkey" FOREIGN KEY ("id_serie") REFERENCES "inventario_series"("id_serie") ON DELETE SET NULL ON UPDATE CASCADE;
-- DropForeignKey
ALTER TABLE "public"."salidas_temporales_ot" DROP CONSTRAINT "salidas_temporales_ot_id_orden_trabajo_fkey";

-- AlterTable
ALTER TABLE "salidas_temporales_ot" ALTER COLUMN "id_orden_trabajo" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "salidas_temporales_ot" ADD CONSTRAINT "salidas_temporales_ot_id_orden_trabajo_fkey" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
/*
  Warnings:

  - You are about to drop the column `id_orden_trabajo` on the `salidas_temporales_ot` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."salidas_temporales_ot" DROP CONSTRAINT "salidas_temporales_ot_id_orden_trabajo_fkey";

-- DropIndex
DROP INDEX "public"."salidas_temporales_ot_id_orden_trabajo_idx";

-- AlterTable
ALTER TABLE "salidas_temporales_ot" DROP COLUMN "id_orden_trabajo";
