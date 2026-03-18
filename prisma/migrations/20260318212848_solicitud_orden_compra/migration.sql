-- CreateEnum
CREATE TYPE "estado_solicitud_compra" AS ENUM ('BORRADOR', 'PENDIENTE_REVISION', 'AUTORIZADA', 'EN_COTIZACION', 'COTIZACION_APROBADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "prioridad_solicitud_compra" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "estado_cotizacion_compra" AS ENUM ('PENDIENTE', 'REGISTRADA', 'SELECCIONADA', 'DESCARTADA');

-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "id_cotizacion_compra" INTEGER,
ADD COLUMN     "id_solicitud_compra" INTEGER;

-- CreateTable
CREATE TABLE "solicitudes_compra" (
    "id_solicitud_compra" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado_solicitud_compra" NOT NULL DEFAULT 'BORRADOR',
    "prioridad" "prioridad_solicitud_compra" NOT NULL DEFAULT 'MEDIA',
    "motivo" TEXT,
    "id_sucursal" INTEGER,
    "id_bodega" INTEGER,
    "id_usuario_solicita" INTEGER NOT NULL,
    "id_usuario_revisa" INTEGER,
    "observaciones" TEXT,
    "observaciones_revision" TEXT,
    "motivo_rechazo" TEXT,
    "fecha_revision" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_compra_pkey" PRIMARY KEY ("id_solicitud_compra")
);

-- CreateTable
CREATE TABLE "solicitudes_compra_detalle" (
    "id_solicitud_compra_detalle" SERIAL NOT NULL,
    "id_solicitud_compra" INTEGER NOT NULL,
    "id_catalogo" INTEGER,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tiene_serie" BOOLEAN NOT NULL DEFAULT false,
    "afecta_inventario" BOOLEAN NOT NULL DEFAULT true,
    "cantidad_solicitada" DOUBLE PRECISION NOT NULL,
    "cantidad_aprobada" DOUBLE PRECISION,
    "costo_estimado" DOUBLE PRECISION,
    "observaciones" TEXT,

    CONSTRAINT "solicitudes_compra_detalle_pkey" PRIMARY KEY ("id_solicitud_compra_detalle")
);

-- CreateTable
CREATE TABLE "cotizaciones_compra" (
    "id_cotizacion_compra" SERIAL NOT NULL,
    "id_solicitud_compra" INTEGER NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "estado" "estado_cotizacion_compra" NOT NULL DEFAULT 'PENDIENTE',
    "numero_cotizacion" TEXT,
    "fecha_cotizacion" TIMESTAMP(3),
    "fecha_vencimiento" TIMESTAMP(3),
    "condiciones_pago" TEXT,
    "dias_credito" INTEGER,
    "dias_entrega" INTEGER,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "descuento" DOUBLE PRECISION DEFAULT 0,
    "iva" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "observaciones" TEXT,
    "archivo_cotizacion" TEXT,
    "motivo_seleccion" TEXT,
    "id_usuario_registra" INTEGER NOT NULL,
    "id_usuario_selecciona" INTEGER,
    "fecha_seleccion" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizaciones_compra_pkey" PRIMARY KEY ("id_cotizacion_compra")
);

-- CreateTable
CREATE TABLE "cotizaciones_compra_detalle" (
    "id_cotizacion_compra_detalle" SERIAL NOT NULL,
    "id_cotizacion_compra" INTEGER NOT NULL,
    "id_solicitud_compra_detalle" INTEGER NOT NULL,
    "costo_unitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuento_porcentaje" DOUBLE PRECISION DEFAULT 0,
    "descuento_monto" DOUBLE PRECISION DEFAULT 0,
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "iva" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "disponibilidad" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "cotizaciones_compra_detalle_pkey" PRIMARY KEY ("id_cotizacion_compra_detalle")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_compra_codigo_key" ON "solicitudes_compra"("codigo");

-- CreateIndex
CREATE INDEX "solicitudes_compra_estado_idx" ON "solicitudes_compra"("estado");

-- CreateIndex
CREATE INDEX "solicitudes_compra_id_usuario_solicita_idx" ON "solicitudes_compra"("id_usuario_solicita");

-- CreateIndex
CREATE INDEX "solicitudes_compra_fecha_creacion_idx" ON "solicitudes_compra"("fecha_creacion");

-- CreateIndex
CREATE INDEX "solicitudes_compra_detalle_id_solicitud_compra_idx" ON "solicitudes_compra_detalle"("id_solicitud_compra");

-- CreateIndex
CREATE INDEX "solicitudes_compra_detalle_id_catalogo_idx" ON "solicitudes_compra_detalle"("id_catalogo");

-- CreateIndex
CREATE INDEX "cotizaciones_compra_id_solicitud_compra_idx" ON "cotizaciones_compra"("id_solicitud_compra");

-- CreateIndex
CREATE INDEX "cotizaciones_compra_id_proveedor_idx" ON "cotizaciones_compra"("id_proveedor");

-- CreateIndex
CREATE INDEX "cotizaciones_compra_estado_idx" ON "cotizaciones_compra"("estado");

-- CreateIndex
CREATE INDEX "cotizaciones_compra_detalle_id_cotizacion_compra_idx" ON "cotizaciones_compra_detalle"("id_cotizacion_compra");

-- CreateIndex
CREATE INDEX "cotizaciones_compra_detalle_id_solicitud_compra_detalle_idx" ON "cotizaciones_compra_detalle"("id_solicitud_compra_detalle");

-- CreateIndex
CREATE INDEX "ordenes_compra_id_solicitud_compra_idx" ON "ordenes_compra"("id_solicitud_compra");

-- CreateIndex
CREATE INDEX "ordenes_compra_id_cotizacion_compra_idx" ON "ordenes_compra"("id_cotizacion_compra");

-- AddForeignKey
ALTER TABLE "solicitudes_compra" ADD CONSTRAINT "fk_solicitud_compra_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitudes_compra" ADD CONSTRAINT "fk_solicitud_compra_bodega" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitudes_compra" ADD CONSTRAINT "solicitudes_compra_id_usuario_solicita_fkey" FOREIGN KEY ("id_usuario_solicita") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_compra" ADD CONSTRAINT "solicitudes_compra_id_usuario_revisa_fkey" FOREIGN KEY ("id_usuario_revisa") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_compra_detalle" ADD CONSTRAINT "solicitudes_compra_detalle_id_solicitud_compra_fkey" FOREIGN KEY ("id_solicitud_compra") REFERENCES "solicitudes_compra"("id_solicitud_compra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_compra_detalle" ADD CONSTRAINT "solicitudes_compra_detalle_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_compra" ADD CONSTRAINT "fk_cotizacion_compra_solicitud" FOREIGN KEY ("id_solicitud_compra") REFERENCES "solicitudes_compra"("id_solicitud_compra") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cotizaciones_compra" ADD CONSTRAINT "fk_cotizacion_compra_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cotizaciones_compra" ADD CONSTRAINT "cotizaciones_compra_id_usuario_registra_fkey" FOREIGN KEY ("id_usuario_registra") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_compra" ADD CONSTRAINT "cotizaciones_compra_id_usuario_selecciona_fkey" FOREIGN KEY ("id_usuario_selecciona") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_compra_detalle" ADD CONSTRAINT "cotizaciones_compra_detalle_id_cotizacion_compra_fkey" FOREIGN KEY ("id_cotizacion_compra") REFERENCES "cotizaciones_compra"("id_cotizacion_compra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones_compra_detalle" ADD CONSTRAINT "fk_cotizacion_detalle_solicitud_detalle" FOREIGN KEY ("id_solicitud_compra_detalle") REFERENCES "solicitudes_compra_detalle"("id_solicitud_compra_detalle") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "fk_orden_compra_solicitud" FOREIGN KEY ("id_solicitud_compra") REFERENCES "solicitudes_compra"("id_solicitud_compra") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "fk_orden_compra_cotizacion" FOREIGN KEY ("id_cotizacion_compra") REFERENCES "cotizaciones_compra"("id_cotizacion_compra") ON DELETE NO ACTION ON UPDATE NO ACTION;
