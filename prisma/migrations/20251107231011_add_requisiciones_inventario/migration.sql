-- CreateEnum
CREATE TYPE "estado_requisicion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'PROCESADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "tipo_requisicion" AS ENUM ('TRANSFERENCIA_BODEGA', 'TRANSFERENCIA_SUCURSAL', 'CAMBIO_ESTANTE');

-- CreateTable
CREATE TABLE "requisiciones_inventario" (
    "id_requisicion" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "tipo_requisicion" NOT NULL,
    "estado" "estado_requisicion" NOT NULL DEFAULT 'PENDIENTE',
    "id_sucursal_origen" INTEGER,
    "id_bodega_origen" INTEGER,
    "id_estante_origen" INTEGER,
    "id_sucursal_destino" INTEGER,
    "id_bodega_destino" INTEGER,
    "id_estante_destino" INTEGER,
    "id_usuario_solicita" INTEGER NOT NULL,
    "id_usuario_autoriza" INTEGER,
    "id_usuario_procesa" INTEGER,
    "motivo" TEXT,
    "observaciones_autorizacion" TEXT,
    "observaciones_proceso" TEXT,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_autorizacion" TIMESTAMP(3),
    "fecha_proceso" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requisiciones_inventario_pkey" PRIMARY KEY ("id_requisicion")
);

-- CreateTable
CREATE TABLE "requisiciones_detalle" (
    "id_requisicion_detalle" SERIAL NOT NULL,
    "id_requisicion" INTEGER NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "cantidad_solicitada" INTEGER NOT NULL,
    "cantidad_autorizada" INTEGER,
    "cantidad_procesada" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requisiciones_detalle_pkey" PRIMARY KEY ("id_requisicion_detalle")
);

-- CreateIndex
CREATE UNIQUE INDEX "requisiciones_inventario_codigo_key" ON "requisiciones_inventario"("codigo");

-- CreateIndex
CREATE INDEX "requisiciones_inventario_estado_idx" ON "requisiciones_inventario"("estado");

-- CreateIndex
CREATE INDEX "requisiciones_inventario_tipo_idx" ON "requisiciones_inventario"("tipo");

-- CreateIndex
CREATE INDEX "requisiciones_inventario_id_usuario_solicita_idx" ON "requisiciones_inventario"("id_usuario_solicita");

-- CreateIndex
CREATE INDEX "requisiciones_inventario_fecha_solicitud_idx" ON "requisiciones_inventario"("fecha_solicitud");

-- CreateIndex
CREATE INDEX "requisiciones_detalle_id_requisicion_idx" ON "requisiciones_detalle"("id_requisicion");

-- CreateIndex
CREATE INDEX "requisiciones_detalle_id_catalogo_idx" ON "requisiciones_detalle"("id_catalogo");

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_sucursal_origen_fkey" FOREIGN KEY ("id_sucursal_origen") REFERENCES "sucursales"("id_sucursal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_bodega_origen_fkey" FOREIGN KEY ("id_bodega_origen") REFERENCES "bodegas"("id_bodega") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_estante_origen_fkey" FOREIGN KEY ("id_estante_origen") REFERENCES "estantes"("id_estante") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_sucursal_destino_fkey" FOREIGN KEY ("id_sucursal_destino") REFERENCES "sucursales"("id_sucursal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_bodega_destino_fkey" FOREIGN KEY ("id_bodega_destino") REFERENCES "bodegas"("id_bodega") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_estante_destino_fkey" FOREIGN KEY ("id_estante_destino") REFERENCES "estantes"("id_estante") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_usuario_solicita_fkey" FOREIGN KEY ("id_usuario_solicita") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_usuario_autoriza_fkey" FOREIGN KEY ("id_usuario_autoriza") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_inventario" ADD CONSTRAINT "requisiciones_inventario_id_usuario_procesa_fkey" FOREIGN KEY ("id_usuario_procesa") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_detalle" ADD CONSTRAINT "requisiciones_detalle_id_requisicion_fkey" FOREIGN KEY ("id_requisicion") REFERENCES "requisiciones_inventario"("id_requisicion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_detalle" ADD CONSTRAINT "requisiciones_detalle_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE RESTRICT ON UPDATE CASCADE;
