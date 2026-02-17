-- CreateEnum
CREATE TYPE "estado_orden_compra" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'EMITIDA', 'RECEPCION_PARCIAL', 'RECEPCION_TOTAL', 'CERRADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "id_orden_compra" INTEGER;

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id_orden_compra" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado_orden_compra" NOT NULL DEFAULT 'BORRADOR',
    "id_proveedor" INTEGER NOT NULL,
    "id_sucursal" INTEGER,
    "id_bodega" INTEGER,
    "id_forma_pago" INTEGER,
    "dias_credito" INTEGER DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "descuento" DOUBLE PRECISION DEFAULT 0,
    "iva" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "id_usuario_crea" INTEGER NOT NULL,
    "id_usuario_aprueba" INTEGER,
    "motivo" TEXT,
    "observaciones" TEXT,
    "observaciones_aprobacion" TEXT,
    "motivo_rechazo" TEXT,
    "fecha_emision" TIMESTAMP(3),
    "fecha_aprobacion" TIMESTAMP(3),
    "fecha_entrega_esperada" TIMESTAMP(3),
    "fecha_cierre" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id_orden_compra")
);

-- CreateTable
CREATE TABLE "ordenes_compra_detalle" (
    "id_orden_compra_detalle" SERIAL NOT NULL,
    "id_orden_compra" INTEGER NOT NULL,
    "id_catalogo" INTEGER,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tiene_serie" BOOLEAN NOT NULL DEFAULT false,
    "cantidad_ordenada" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidad_recibida" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costo_unitario" DOUBLE PRECISION DEFAULT 0,
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "descuento_porcentaje" DOUBLE PRECISION DEFAULT 0,
    "descuento_monto" DOUBLE PRECISION DEFAULT 0,
    "iva" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_compra_detalle_pkey" PRIMARY KEY ("id_orden_compra_detalle")
);

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_codigo_key" ON "ordenes_compra"("codigo");

-- CreateIndex
CREATE INDEX "ordenes_compra_estado_idx" ON "ordenes_compra"("estado");

-- CreateIndex
CREATE INDEX "ordenes_compra_id_proveedor_idx" ON "ordenes_compra"("id_proveedor");

-- CreateIndex
CREATE INDEX "ordenes_compra_id_usuario_crea_idx" ON "ordenes_compra"("id_usuario_crea");

-- CreateIndex
CREATE INDEX "ordenes_compra_fecha_creacion_idx" ON "ordenes_compra"("fecha_creacion");

-- CreateIndex
CREATE INDEX "ordenes_compra_detalle_id_orden_compra_idx" ON "ordenes_compra_detalle"("id_orden_compra");

-- CreateIndex
CREATE INDEX "ordenes_compra_detalle_id_catalogo_idx" ON "ordenes_compra_detalle"("id_catalogo");

-- CreateIndex
CREATE INDEX "fk_compra_orden_compra_id" ON "compras"("id_orden_compra");

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compra_orden_compra" FOREIGN KEY ("id_orden_compra") REFERENCES "ordenes_compra"("id_orden_compra") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "fk_orden_compra_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "fk_orden_compra_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "fk_orden_compra_bodega" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "fk_orden_compra_forma_pago" FOREIGN KEY ("id_forma_pago") REFERENCES "dTEFormaPago"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_id_usuario_crea_fkey" FOREIGN KEY ("id_usuario_crea") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_id_usuario_aprueba_fkey" FOREIGN KEY ("id_usuario_aprueba") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "ordenes_compra_detalle_id_orden_compra_fkey" FOREIGN KEY ("id_orden_compra") REFERENCES "ordenes_compra"("id_orden_compra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_detalle" ADD CONSTRAINT "ordenes_compra_detalle_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE SET NULL ON UPDATE CASCADE;
