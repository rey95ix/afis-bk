-- CreateEnum
CREATE TYPE "estado_orden_salida" AS ENUM ('BORRADOR', 'PENDIENTE_AUTORIZACION', 'AUTORIZADA', 'RECHAZADA', 'PROCESADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "tipo_orden_salida" AS ENUM ('VENTA', 'DONACION', 'BAJA_INVENTARIO', 'DEVOLUCION_PROVEEDOR', 'TRASLADO_EXTERNO', 'CONSUMO_INTERNO', 'MERMA', 'OTRO');

-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "id_orden_salida" INTEGER;

-- CreateTable
CREATE TABLE "ordenes_salida" (
    "id_orden_salida" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "tipo_orden_salida" NOT NULL,
    "estado" "estado_orden_salida" NOT NULL DEFAULT 'BORRADOR',
    "id_sucursal_origen" INTEGER,
    "id_bodega_origen" INTEGER NOT NULL,
    "destinatario" TEXT,
    "documento_destinatario" TEXT,
    "direccion_destino" TEXT,
    "telefono_destinatario" TEXT,
    "numero_documento" TEXT,
    "referencia_externa" TEXT,
    "id_usuario_solicita" INTEGER NOT NULL,
    "id_usuario_autoriza" INTEGER,
    "id_usuario_procesa" INTEGER,
    "motivo" TEXT,
    "observaciones_autorizacion" TEXT,
    "observaciones_proceso" TEXT,
    "motivo_rechazo" TEXT,
    "subtotal" DECIMAL(12,2) DEFAULT 0,
    "total" DECIMAL(12,2) DEFAULT 0,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_autorizacion" TIMESTAMP(3),
    "fecha_proceso" TIMESTAMP(3),
    "fecha_salida_efectiva" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_salida_pkey" PRIMARY KEY ("id_orden_salida")
);

-- CreateTable
CREATE TABLE "ordenes_salida_detalle" (
    "id_orden_salida_detalle" SERIAL NOT NULL,
    "id_orden_salida" INTEGER NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "cantidad_solicitada" INTEGER NOT NULL,
    "cantidad_autorizada" INTEGER,
    "cantidad_procesada" INTEGER NOT NULL DEFAULT 0,
    "costo_unitario" DECIMAL(10,2),
    "subtotal" DECIMAL(12,2),
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_salida_detalle_pkey" PRIMARY KEY ("id_orden_salida_detalle")
);

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_salida_codigo_key" ON "ordenes_salida"("codigo");

-- CreateIndex
CREATE INDEX "ordenes_salida_estado_idx" ON "ordenes_salida"("estado");

-- CreateIndex
CREATE INDEX "ordenes_salida_tipo_idx" ON "ordenes_salida"("tipo");

-- CreateIndex
CREATE INDEX "ordenes_salida_id_bodega_origen_idx" ON "ordenes_salida"("id_bodega_origen");

-- CreateIndex
CREATE INDEX "ordenes_salida_id_usuario_solicita_idx" ON "ordenes_salida"("id_usuario_solicita");

-- CreateIndex
CREATE INDEX "ordenes_salida_fecha_solicitud_idx" ON "ordenes_salida"("fecha_solicitud");

-- CreateIndex
CREATE INDEX "ordenes_salida_detalle_id_orden_salida_idx" ON "ordenes_salida_detalle"("id_orden_salida");

-- CreateIndex
CREATE INDEX "ordenes_salida_detalle_id_catalogo_idx" ON "ordenes_salida_detalle"("id_catalogo");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_id_orden_salida_fkey" FOREIGN KEY ("id_orden_salida") REFERENCES "ordenes_salida"("id_orden_salida") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_salida" ADD CONSTRAINT "ordenes_salida_id_sucursal_origen_fkey" FOREIGN KEY ("id_sucursal_origen") REFERENCES "sucursales"("id_sucursal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_salida" ADD CONSTRAINT "ordenes_salida_id_bodega_origen_fkey" FOREIGN KEY ("id_bodega_origen") REFERENCES "bodegas"("id_bodega") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_salida" ADD CONSTRAINT "ordenes_salida_id_usuario_solicita_fkey" FOREIGN KEY ("id_usuario_solicita") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_salida" ADD CONSTRAINT "ordenes_salida_id_usuario_autoriza_fkey" FOREIGN KEY ("id_usuario_autoriza") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_salida" ADD CONSTRAINT "ordenes_salida_id_usuario_procesa_fkey" FOREIGN KEY ("id_usuario_procesa") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_salida_detalle" ADD CONSTRAINT "ordenes_salida_detalle_id_orden_salida_fkey" FOREIGN KEY ("id_orden_salida") REFERENCES "ordenes_salida"("id_orden_salida") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_salida_detalle" ADD CONSTRAINT "ordenes_salida_detalle_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE RESTRICT ON UPDATE CASCADE;
