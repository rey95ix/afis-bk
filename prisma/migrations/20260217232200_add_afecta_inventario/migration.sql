-- AlterTable
ALTER TABLE "comprasDetalle" ADD COLUMN     "afecta_inventario" BOOLEAN NOT NULL DEFAULT true;
-- CreateTable
CREATE TABLE "whatsapp_numero_invalido" (
    "id_numero_invalido" SERIAL NOT NULL,
    "telefono" TEXT NOT NULL,
    "codigo_error" INTEGER NOT NULL,
    "mensaje_error" TEXT,
    "id_chat_origen" INTEGER,
    "fecha_deteccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "whatsapp_numero_invalido_pkey" PRIMARY KEY ("id_numero_invalido")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numero_invalido_telefono_key" ON "whatsapp_numero_invalido"("telefono");

-- CreateIndex
CREATE INDEX "whatsapp_numero_invalido_telefono_idx" ON "whatsapp_numero_invalido"("telefono");

-- CreateIndex
CREATE INDEX "whatsapp_numero_invalido_activo_idx" ON "whatsapp_numero_invalido"("activo");
-- AlterTable
ALTER TABLE "ordenes_compra_detalle" ADD COLUMN     "afecta_inventario" BOOLEAN NOT NULL DEFAULT true;
-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "fecha_pago" TIMESTAMP(3),
ADD COLUMN     "id_cuenta_bancaria_pago" INTEGER,
ADD COLUMN     "id_movimiento_bancario" INTEGER,
ADD COLUMN     "metodo_pago" TEXT,
ADD COLUMN     "monto_pagado" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "pago_registrado" BOOLEAN NOT NULL DEFAULT false;
-- CreateEnum
CREATE TYPE "estado_cxp" AS ENUM ('PENDIENTE', 'PAGADA_PARCIAL', 'PAGADA_TOTAL', 'VENCIDA', 'ANULADA');

-- AlterEnum
ALTER TYPE "modulo_origen_movimiento" ADD VALUE 'CUENTAS_POR_PAGAR';

-- CreateTable
CREATE TABLE "cuenta_por_pagar" (
    "id_cxp" SERIAL NOT NULL,
    "id_compras" INTEGER NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "saldo_pendiente" DECIMAL(12,2) NOT NULL,
    "total_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "dias_credito" INTEGER NOT NULL DEFAULT 30,
    "estado" "estado_cxp" NOT NULL DEFAULT 'PENDIENTE',
    "id_sucursal" INTEGER NOT NULL,
    "id_usuario_crea" INTEGER NOT NULL,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuenta_por_pagar_pkey" PRIMARY KEY ("id_cxp")
);

-- CreateTable
CREATE TABLE "pago_cxp" (
    "id_pago" SERIAL NOT NULL,
    "id_cxp" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "saldo_anterior" DECIMAL(12,2) NOT NULL,
    "saldo_posterior" DECIMAL(12,2) NOT NULL,
    "metodo_pago" "metodo_pago_abono" NOT NULL,
    "referencia" VARCHAR(200),
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_movimiento_bancario" INTEGER,
    "id_usuario" INTEGER NOT NULL,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_cxp_pkey" PRIMARY KEY ("id_pago")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_por_pagar_id_compras_key" ON "cuenta_por_pagar"("id_compras");

-- CreateIndex
CREATE INDEX "cuenta_por_pagar_id_compras_idx" ON "cuenta_por_pagar"("id_compras");

-- CreateIndex
CREATE INDEX "cuenta_por_pagar_id_proveedor_idx" ON "cuenta_por_pagar"("id_proveedor");

-- CreateIndex
CREATE INDEX "cuenta_por_pagar_estado_idx" ON "cuenta_por_pagar"("estado");

-- CreateIndex
CREATE INDEX "cuenta_por_pagar_fecha_vencimiento_idx" ON "cuenta_por_pagar"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "cuenta_por_pagar_id_sucursal_idx" ON "cuenta_por_pagar"("id_sucursal");

-- CreateIndex
CREATE INDEX "pago_cxp_id_cxp_idx" ON "pago_cxp"("id_cxp");

-- CreateIndex
CREATE INDEX "pago_cxp_fecha_pago_idx" ON "pago_cxp"("fecha_pago");

-- CreateIndex
CREATE INDEX "pago_cxp_activo_idx" ON "pago_cxp"("activo");

-- AddForeignKey
ALTER TABLE "cuenta_por_pagar" ADD CONSTRAINT "fk_cxp_compra" FOREIGN KEY ("id_compras") REFERENCES "compras"("id_compras") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_por_pagar" ADD CONSTRAINT "fk_cxp_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_por_pagar" ADD CONSTRAINT "fk_cxp_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_por_pagar" ADD CONSTRAINT "fk_cxp_usuario_crea" FOREIGN KEY ("id_usuario_crea") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago_cxp" ADD CONSTRAINT "fk_pago_cxp" FOREIGN KEY ("id_cxp") REFERENCES "cuenta_por_pagar"("id_cxp") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago_cxp" ADD CONSTRAINT "fk_pago_cxp_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
