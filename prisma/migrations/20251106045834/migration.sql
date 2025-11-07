/*
  Warnings:

  - You are about to drop the column `costo_total` on the `inventario` table. All the data in the column will be lost.
  - You are about to drop the column `costo_unitario` on the `inventario` table. All the data in the column will be lost.
  - You are about to drop the column `existencia` on the `inventario` table. All the data in the column will be lost.
  - You are about to drop the column `id_compras_detalle` on the `inventario` table. All the data in the column will be lost.
  - You are about to drop the column `serie` on the `ot_materiales` table. All the data in the column will be lost.
  - You are about to drop the `Compras` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kardex` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[id_catalogo,id_bodega,id_estante]` on the table `inventario` will be added. If there are existing duplicate values, this will fail.
  - Made the column `id_bodega` on table `inventario` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "tipo_ubicacion" AS ENUM ('BODEGA', 'CUADRILLA');

-- CreateEnum
CREATE TYPE "estado_inventario" AS ENUM ('DISPONIBLE', 'RESERVADO', 'EN_TRANSITO', 'ASIGNADO', 'DEFECTUOSO', 'BAJA');

-- CreateEnum
CREATE TYPE "estado_importacion" AS ENUM ('COTIZACION', 'ORDEN_COLOCADA', 'EN_TRANSITO', 'EN_ADUANA', 'LIBERADA', 'RECIBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "tipo_gasto_importacion" AS ENUM ('FLETE_INTERNACIONAL', 'SEGURO', 'AGENTE_ADUANAL', 'ALMACENAJE', 'TRANSPORTE_LOCAL', 'DAI', 'IVA_IMPORTACION', 'OTROS_IMPUESTOS', 'OTROS');

-- CreateEnum
CREATE TYPE "tipo_movimiento" AS ENUM ('ENTRADA_COMPRA', 'ENTRADA_IMPORTACION', 'SALIDA_OT', 'TRANSFERENCIA', 'AJUSTE_INVENTARIO', 'DEVOLUCION', 'BAJA');

-- DropForeignKey
ALTER TABLE "public"."Compras" DROP CONSTRAINT "fk_compra_usuario";

-- DropForeignKey
ALTER TABLE "public"."Compras" DROP CONSTRAINT "fk_compras_bodega";

-- DropForeignKey
ALTER TABLE "public"."Compras" DROP CONSTRAINT "fk_compras_metodo_pago";

-- DropForeignKey
ALTER TABLE "public"."Compras" DROP CONSTRAINT "fk_compras_proveedor";

-- DropForeignKey
ALTER TABLE "public"."Compras" DROP CONSTRAINT "fk_compras_sucursal";

-- DropForeignKey
ALTER TABLE "public"."Compras" DROP CONSTRAINT "fk_compras_tipo_factura";

-- DropForeignKey
ALTER TABLE "public"."comprasDetalle" DROP CONSTRAINT "fk_compra_detalle";

-- DropForeignKey
ALTER TABLE "public"."inventario" DROP CONSTRAINT "fk_inventario_bodega";

-- DropForeignKey
ALTER TABLE "public"."inventario" DROP CONSTRAINT "fk_inventario_catalogo";

-- DropForeignKey
ALTER TABLE "public"."inventario" DROP CONSTRAINT "fk_inventario_detalle";

-- DropForeignKey
ALTER TABLE "public"."inventario" DROP CONSTRAINT "fk_inventario_estante";

-- DropForeignKey
ALTER TABLE "public"."kardex" DROP CONSTRAINT "fk_kardex_catalogo";

-- DropForeignKey
ALTER TABLE "public"."kardex" DROP CONSTRAINT "fk_kardex_detalle";

-- DropIndex
DROP INDEX "public"."fk_inventario_detalle_id";

-- AlterTable
ALTER TABLE "bodegas" ADD COLUMN     "id_responsable" INTEGER,
ADD COLUMN     "placa_vehiculo" TEXT,
ADD COLUMN     "tipo" "tipo_ubicacion" NOT NULL DEFAULT 'BODEGA';

-- AlterTable
ALTER TABLE "comprasDetalle" ADD COLUMN     "tiene_serie" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "estantes" ADD COLUMN     "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "inventario" DROP COLUMN "costo_total",
DROP COLUMN "costo_unitario",
DROP COLUMN "existencia",
DROP COLUMN "id_compras_detalle",
ADD COLUMN     "cantidad_disponible" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cantidad_maxima" INTEGER DEFAULT 0,
ADD COLUMN     "cantidad_minima" INTEGER DEFAULT 0,
ADD COLUMN     "cantidad_reservada" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "costo_promedio" DECIMAL(10,2),
ADD COLUMN     "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id_bodega" SET NOT NULL;

-- AlterTable
ALTER TABLE "ot_materiales" DROP COLUMN "serie",
ADD COLUMN     "descargado_inventario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fecha_descarga" TIMESTAMP(3),
ADD COLUMN     "id_bodega_origen" INTEGER,
ADD COLUMN     "id_catalogo" INTEGER,
ADD COLUMN     "id_serie" INTEGER,
ALTER COLUMN "sku" DROP NOT NULL,
ALTER COLUMN "nombre" DROP NOT NULL;

-- AlterTable
ALTER TABLE "proveedores" ADD COLUMN     "es_internacional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pais" TEXT;

-- DropTable
DROP TABLE "public"."Compras";

-- DropTable
DROP TABLE "public"."kardex";

-- CreateTable
CREATE TABLE "compras" (
    "id_compras" SERIAL NOT NULL,
    "numero_factura" TEXT NOT NULL DEFAULT '0',
    "numero_quedan" TEXT DEFAULT '0',
    "detalle" TEXT,
    "nombre_proveedor" TEXT DEFAULT '',
    "id_proveedor" INTEGER,
    "id_forma_pago" INTEGER,
    "id_usuario" INTEGER NOT NULL,
    "dias_credito" INTEGER DEFAULT 0,
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "descuento" DOUBLE PRECISION DEFAULT 0,
    "cesc" DOUBLE PRECISION DEFAULT 0,
    "fovial" DOUBLE PRECISION DEFAULT 0,
    "cotrans" DOUBLE PRECISION DEFAULT 0,
    "iva" DOUBLE PRECISION DEFAULT 0,
    "iva_retenido" DOUBLE PRECISION DEFAULT 0,
    "iva_percivido" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "id_sucursal" INTEGER,
    "id_bodega" INTEGER,
    "id_tipo_factura" INTEGER DEFAULT 2,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_factura" TIMESTAMP(3),
    "fecha_de_pago" TIMESTAMP(3),
    "is_dte" BOOLEAN NOT NULL DEFAULT false,
    "json_dte" TEXT,
    "numeroControl" TEXT DEFAULT '',
    "codigoGeneracion" TEXT DEFAULT '',

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id_compras")
);

-- CreateTable
CREATE TABLE "importaciones" (
    "id_importacion" SERIAL NOT NULL,
    "numero_orden" TEXT NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "id_usuario_solicita" INTEGER NOT NULL,
    "estado" "estado_importacion" NOT NULL DEFAULT 'COTIZACION',
    "numero_factura_proveedor" TEXT,
    "numero_tracking" TEXT,
    "incoterm" TEXT,
    "puerto_origen" TEXT,
    "puerto_destino" TEXT,
    "naviera_courier" TEXT,
    "fecha_orden" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_embarque" TIMESTAMP(3),
    "fecha_arribo_estimado" TIMESTAMP(3),
    "fecha_arribo_real" TIMESTAMP(3),
    "fecha_liberacion_aduana" TIMESTAMP(3),
    "fecha_recepcion" TIMESTAMP(3),
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "subtotal_mercancia" DECIMAL(12,2) NOT NULL,
    "flete_internacional" DECIMAL(12,2) DEFAULT 0,
    "seguro" DECIMAL(12,2) DEFAULT 0,
    "total_fob" DECIMAL(12,2),
    "tipo_cambio" DECIMAL(10,4) NOT NULL,
    "total_mercancia_local" DECIMAL(12,2),
    "total_gastos_importacion" DECIMAL(12,2) DEFAULT 0,
    "total_importacion" DECIMAL(12,2),
    "numero_declaracion" TEXT,
    "agente_aduanal" TEXT,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importaciones_pkey" PRIMARY KEY ("id_importacion")
);

-- CreateTable
CREATE TABLE "importaciones_detalle" (
    "id_importacion_detalle" SERIAL NOT NULL,
    "id_importacion" INTEGER NOT NULL,
    "id_catalogo" INTEGER,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidad_ordenada" INTEGER NOT NULL,
    "cantidad_recibida" INTEGER NOT NULL DEFAULT 0,
    "precio_unitario_usd" DECIMAL(10,2) NOT NULL,
    "subtotal_usd" DECIMAL(12,2) NOT NULL,
    "precio_unitario_local" DECIMAL(10,2),
    "subtotal_local" DECIMAL(12,2),
    "costo_unitario_final" DECIMAL(10,2),
    "costo_total_final" DECIMAL(12,2),
    "peso_kg" DECIMAL(10,2),
    "volumen_m3" DECIMAL(10,4),
    "tiene_serie" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importaciones_detalle_pkey" PRIMARY KEY ("id_importacion_detalle")
);

-- CreateTable
CREATE TABLE "importaciones_gastos" (
    "id_gasto" SERIAL NOT NULL,
    "id_importacion" INTEGER NOT NULL,
    "tipo" "tipo_gasto_importacion" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "tipo_cambio" DECIMAL(10,4),
    "monto_local" DECIMAL(12,2),
    "aplica_retaceo" BOOLEAN NOT NULL DEFAULT true,
    "metodo_retaceo" TEXT DEFAULT 'VALOR',
    "numero_factura" TEXT,
    "fecha_factura" TIMESTAMP(3),
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importaciones_gastos_pkey" PRIMARY KEY ("id_gasto")
);

-- CreateTable
CREATE TABLE "retaceo_importacion" (
    "id_retaceo" SERIAL NOT NULL,
    "id_importacion" INTEGER NOT NULL,
    "id_gasto" INTEGER NOT NULL,
    "metodo_aplicado" TEXT NOT NULL,
    "monto_total_distribuir" DECIMAL(12,2) NOT NULL,
    "fecha_calculo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculado_por" INTEGER NOT NULL,

    CONSTRAINT "retaceo_importacion_pkey" PRIMARY KEY ("id_retaceo")
);

-- CreateTable
CREATE TABLE "retaceo_detalle" (
    "id_retaceo_detalle" SERIAL NOT NULL,
    "id_retaceo" INTEGER NOT NULL,
    "id_importacion_detalle" INTEGER NOT NULL,
    "base_calculo" DECIMAL(12,4) NOT NULL,
    "porcentaje_asignado" DECIMAL(8,4) NOT NULL,
    "monto_asignado" DECIMAL(12,2) NOT NULL,
    "monto_unitario" DECIMAL(10,2) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retaceo_detalle_pkey" PRIMARY KEY ("id_retaceo_detalle")
);

-- CreateTable
CREATE TABLE "inventario_series" (
    "id_serie" SERIAL NOT NULL,
    "id_inventario" INTEGER NOT NULL,
    "numero_serie" TEXT NOT NULL,
    "mac_address" TEXT,
    "estado" "estado_inventario" NOT NULL DEFAULT 'DISPONIBLE',
    "id_compra_detalle" INTEGER,
    "id_orden_trabajo" INTEGER,
    "id_cliente" INTEGER,
    "costo_adquisicion" DECIMAL(10,2),
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_asignacion" TIMESTAMP(3),
    "fecha_instalacion" TIMESTAMP(3),
    "fecha_baja" TIMESTAMP(3),
    "motivo_baja" TEXT,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_series_pkey" PRIMARY KEY ("id_serie")
);

-- CreateTable
CREATE TABLE "importaciones_series" (
    "id_importacion_serie" SERIAL NOT NULL,
    "id_importacion_detalle" INTEGER NOT NULL,
    "numero_serie" TEXT NOT NULL,
    "mac_address" TEXT,
    "recibido" BOOLEAN NOT NULL DEFAULT false,
    "fecha_recepcion" TIMESTAMP(3),
    "id_inventario_serie" INTEGER,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importaciones_series_pkey" PRIMARY KEY ("id_importacion_serie")
);

-- CreateTable
CREATE TABLE "historial_series" (
    "id_historial" SERIAL NOT NULL,
    "id_serie" INTEGER NOT NULL,
    "estado_anterior" "estado_inventario" NOT NULL,
    "estado_nuevo" "estado_inventario" NOT NULL,
    "id_bodega_anterior" INTEGER,
    "id_bodega_nueva" INTEGER,
    "id_usuario" INTEGER NOT NULL,
    "id_orden_trabajo" INTEGER,
    "observaciones" TEXT,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_series_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id_movimiento" SERIAL NOT NULL,
    "tipo" "tipo_movimiento" NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "id_bodega_origen" INTEGER,
    "id_bodega_destino" INTEGER,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(10,2),
    "id_compra" INTEGER,
    "id_importacion" INTEGER,
    "id_orden_trabajo" INTEGER,
    "id_usuario" INTEGER NOT NULL,
    "observaciones" TEXT,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "reservas_inventario" (
    "id_reserva" SERIAL NOT NULL,
    "id_orden_trabajo" INTEGER NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "id_bodega" INTEGER NOT NULL,
    "cantidad_reservada" INTEGER NOT NULL,
    "cantidad_utilizada" INTEGER NOT NULL DEFAULT 0,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_reserva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" TIMESTAMP(3),
    "fecha_completado" TIMESTAMP(3),
    "id_usuario" INTEGER NOT NULL,

    CONSTRAINT "reservas_inventario_pkey" PRIMARY KEY ("id_reserva")
);

-- CreateIndex
CREATE INDEX "fk_compras_tipo_factura_id" ON "compras"("id_tipo_factura");

-- CreateIndex
CREATE INDEX "fk_compras_sucursal_id" ON "compras"("id_sucursal");

-- CreateIndex
CREATE INDEX "fk_compras_bodega_id" ON "compras"("id_bodega");

-- CreateIndex
CREATE INDEX "fk_compra_usuario_id" ON "compras"("id_usuario");

-- CreateIndex
CREATE INDEX "fk_compras_proveedor_id" ON "compras"("id_proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "importaciones_numero_orden_key" ON "importaciones"("numero_orden");

-- CreateIndex
CREATE INDEX "importaciones_estado_idx" ON "importaciones"("estado");

-- CreateIndex
CREATE INDEX "importaciones_id_proveedor_idx" ON "importaciones"("id_proveedor");

-- CreateIndex
CREATE INDEX "importaciones_fecha_orden_idx" ON "importaciones"("fecha_orden");

-- CreateIndex
CREATE INDEX "importaciones_detalle_id_importacion_idx" ON "importaciones_detalle"("id_importacion");

-- CreateIndex
CREATE INDEX "importaciones_detalle_id_catalogo_idx" ON "importaciones_detalle"("id_catalogo");

-- CreateIndex
CREATE INDEX "importaciones_gastos_id_importacion_idx" ON "importaciones_gastos"("id_importacion");

-- CreateIndex
CREATE INDEX "importaciones_gastos_tipo_idx" ON "importaciones_gastos"("tipo");

-- CreateIndex
CREATE INDEX "retaceo_importacion_id_importacion_idx" ON "retaceo_importacion"("id_importacion");

-- CreateIndex
CREATE INDEX "retaceo_importacion_id_gasto_idx" ON "retaceo_importacion"("id_gasto");

-- CreateIndex
CREATE INDEX "retaceo_detalle_id_retaceo_idx" ON "retaceo_detalle"("id_retaceo");

-- CreateIndex
CREATE INDEX "retaceo_detalle_id_importacion_detalle_idx" ON "retaceo_detalle"("id_importacion_detalle");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_series_numero_serie_key" ON "inventario_series"("numero_serie");

-- CreateIndex
CREATE INDEX "inventario_series_numero_serie_idx" ON "inventario_series"("numero_serie");

-- CreateIndex
CREATE INDEX "inventario_series_estado_idx" ON "inventario_series"("estado");

-- CreateIndex
CREATE INDEX "inventario_series_id_inventario_idx" ON "inventario_series"("id_inventario");

-- CreateIndex
CREATE UNIQUE INDEX "importaciones_series_numero_serie_key" ON "importaciones_series"("numero_serie");

-- CreateIndex
CREATE INDEX "importaciones_series_id_importacion_detalle_idx" ON "importaciones_series"("id_importacion_detalle");

-- CreateIndex
CREATE INDEX "importaciones_series_numero_serie_idx" ON "importaciones_series"("numero_serie");

-- CreateIndex
CREATE INDEX "historial_series_id_serie_idx" ON "historial_series"("id_serie");

-- CreateIndex
CREATE INDEX "movimientos_inventario_tipo_idx" ON "movimientos_inventario"("tipo");

-- CreateIndex
CREATE INDEX "movimientos_inventario_id_catalogo_idx" ON "movimientos_inventario"("id_catalogo");

-- CreateIndex
CREATE INDEX "movimientos_inventario_fecha_movimiento_idx" ON "movimientos_inventario"("fecha_movimiento");

-- CreateIndex
CREATE INDEX "reservas_inventario_id_orden_trabajo_idx" ON "reservas_inventario"("id_orden_trabajo");

-- CreateIndex
CREATE INDEX "reservas_inventario_estado_idx" ON "reservas_inventario"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_id_catalogo_id_bodega_id_estante_key" ON "inventario"("id_catalogo", "id_bodega", "id_estante");

-- AddForeignKey
ALTER TABLE "bodegas" ADD CONSTRAINT "fk_bodega_responsable" FOREIGN KEY ("id_responsable") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compras_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compras_metodo_pago" FOREIGN KEY ("id_forma_pago") REFERENCES "dTEFormaPago"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compra_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compras_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compras_bodega" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compras_tipo_factura" FOREIGN KEY ("id_tipo_factura") REFERENCES "facturasTipos"("id_tipo_factura") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprasDetalle" ADD CONSTRAINT "fk_compra_detalle" FOREIGN KEY ("id_compras") REFERENCES "compras"("id_compras") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ot_materiales" ADD CONSTRAINT "ot_materiales_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_materiales" ADD CONSTRAINT "ot_materiales_id_bodega_origen_fkey" FOREIGN KEY ("id_bodega_origen") REFERENCES "bodegas"("id_bodega") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_materiales" ADD CONSTRAINT "ot_materiales_id_serie_fkey" FOREIGN KEY ("id_serie") REFERENCES "inventario_series"("id_serie") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_id_usuario_solicita_fkey" FOREIGN KEY ("id_usuario_solicita") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones_detalle" ADD CONSTRAINT "importaciones_detalle_id_importacion_fkey" FOREIGN KEY ("id_importacion") REFERENCES "importaciones"("id_importacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones_detalle" ADD CONSTRAINT "importaciones_detalle_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones_gastos" ADD CONSTRAINT "importaciones_gastos_id_importacion_fkey" FOREIGN KEY ("id_importacion") REFERENCES "importaciones"("id_importacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retaceo_importacion" ADD CONSTRAINT "retaceo_importacion_id_importacion_fkey" FOREIGN KEY ("id_importacion") REFERENCES "importaciones"("id_importacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retaceo_importacion" ADD CONSTRAINT "retaceo_importacion_id_gasto_fkey" FOREIGN KEY ("id_gasto") REFERENCES "importaciones_gastos"("id_gasto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retaceo_importacion" ADD CONSTRAINT "retaceo_importacion_calculado_por_fkey" FOREIGN KEY ("calculado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retaceo_detalle" ADD CONSTRAINT "retaceo_detalle_id_retaceo_fkey" FOREIGN KEY ("id_retaceo") REFERENCES "retaceo_importacion"("id_retaceo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retaceo_detalle" ADD CONSTRAINT "retaceo_detalle_id_importacion_detalle_fkey" FOREIGN KEY ("id_importacion_detalle") REFERENCES "importaciones_detalle"("id_importacion_detalle") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_bodega_fkey" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_estante_fkey" FOREIGN KEY ("id_estante") REFERENCES "estantes"("id_estante") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_series" ADD CONSTRAINT "inventario_series_id_inventario_fkey" FOREIGN KEY ("id_inventario") REFERENCES "inventario"("id_inventario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_series" ADD CONSTRAINT "inventario_series_id_compra_detalle_fkey" FOREIGN KEY ("id_compra_detalle") REFERENCES "comprasDetalle"("id_compras_detalle") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_series" ADD CONSTRAINT "inventario_series_id_orden_trabajo_fkey" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_series" ADD CONSTRAINT "inventario_series_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones_series" ADD CONSTRAINT "importaciones_series_id_importacion_detalle_fkey" FOREIGN KEY ("id_importacion_detalle") REFERENCES "importaciones_detalle"("id_importacion_detalle") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones_series" ADD CONSTRAINT "importaciones_series_id_inventario_serie_fkey" FOREIGN KEY ("id_inventario_serie") REFERENCES "inventario_series"("id_serie") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_series" ADD CONSTRAINT "historial_series_id_serie_fkey" FOREIGN KEY ("id_serie") REFERENCES "inventario_series"("id_serie") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_series" ADD CONSTRAINT "historial_series_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_id_bodega_origen_fkey" FOREIGN KEY ("id_bodega_origen") REFERENCES "bodegas"("id_bodega") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_id_bodega_destino_fkey" FOREIGN KEY ("id_bodega_destino") REFERENCES "bodegas"("id_bodega") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_id_compra_fkey" FOREIGN KEY ("id_compra") REFERENCES "compras"("id_compras") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_id_importacion_fkey" FOREIGN KEY ("id_importacion") REFERENCES "importaciones"("id_importacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_id_orden_trabajo_fkey" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_inventario" ADD CONSTRAINT "reservas_inventario_id_orden_trabajo_fkey" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_inventario" ADD CONSTRAINT "reservas_inventario_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_inventario" ADD CONSTRAINT "reservas_inventario_id_bodega_fkey" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_inventario" ADD CONSTRAINT "reservas_inventario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "fk_inventario_bodega_id" RENAME TO "inventario_id_bodega_idx";

-- RenameIndex
ALTER INDEX "fk_inventario_catalogo_id" RENAME TO "inventario_id_catalogo_idx";
