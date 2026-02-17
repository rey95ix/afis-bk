-- CreateEnum
CREATE TYPE "estado_cxc" AS ENUM ('PENDIENTE', 'PAGADA_PARCIAL', 'PAGADA_TOTAL', 'VENCIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "metodo_pago_abono" AS ENUM ('EFECTIVO', 'CHEQUE', 'TRANSFERENCIA', 'DEPOSITO', 'TARJETA', 'OTRO');

-- AlterEnum
ALTER TYPE "modulo_origen_movimiento" ADD VALUE 'CUENTAS_POR_COBRAR';

-- AlterTable
ALTER TABLE "facturaDirecta" ADD COLUMN     "dias_credito" INTEGER,
ADD COLUMN     "fecha_pago_estimada" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cuenta_por_cobrar" (
    "id_cxc" SERIAL NOT NULL,
    "id_factura_directa" INTEGER NOT NULL,
    "id_cliente_directo" INTEGER NOT NULL,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "saldo_pendiente" DECIMAL(12,2) NOT NULL,
    "total_abonado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "dias_credito" INTEGER NOT NULL DEFAULT 30,
    "estado" "estado_cxc" NOT NULL DEFAULT 'PENDIENTE',
    "monto_mora" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "id_mora_config" INTEGER,
    "id_sucursal" INTEGER NOT NULL,
    "id_usuario_crea" INTEGER NOT NULL,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuenta_por_cobrar_pkey" PRIMARY KEY ("id_cxc")
);

-- CreateTable
CREATE TABLE "abono_cxc" (
    "id_abono" SERIAL NOT NULL,
    "id_cxc" INTEGER NOT NULL,
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

    CONSTRAINT "abono_cxc_pkey" PRIMARY KEY ("id_abono")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_por_cobrar_id_factura_directa_key" ON "cuenta_por_cobrar"("id_factura_directa");

-- CreateIndex
CREATE INDEX "cuenta_por_cobrar_id_factura_directa_idx" ON "cuenta_por_cobrar"("id_factura_directa");

-- CreateIndex
CREATE INDEX "cuenta_por_cobrar_id_cliente_directo_idx" ON "cuenta_por_cobrar"("id_cliente_directo");

-- CreateIndex
CREATE INDEX "cuenta_por_cobrar_estado_idx" ON "cuenta_por_cobrar"("estado");

-- CreateIndex
CREATE INDEX "cuenta_por_cobrar_fecha_vencimiento_idx" ON "cuenta_por_cobrar"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "cuenta_por_cobrar_id_sucursal_idx" ON "cuenta_por_cobrar"("id_sucursal");

-- CreateIndex
CREATE INDEX "abono_cxc_id_cxc_idx" ON "abono_cxc"("id_cxc");

-- CreateIndex
CREATE INDEX "abono_cxc_fecha_pago_idx" ON "abono_cxc"("fecha_pago");

-- CreateIndex
CREATE INDEX "abono_cxc_activo_idx" ON "abono_cxc"("activo");

-- AddForeignKey
ALTER TABLE "cuenta_por_cobrar" ADD CONSTRAINT "fk_cxc_factura_directa" FOREIGN KEY ("id_factura_directa") REFERENCES "facturaDirecta"("id_factura_directa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_por_cobrar" ADD CONSTRAINT "fk_cxc_cliente_directo" FOREIGN KEY ("id_cliente_directo") REFERENCES "clienteDirecto"("id_cliente_directo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_por_cobrar" ADD CONSTRAINT "fk_cxc_mora_config" FOREIGN KEY ("id_mora_config") REFERENCES "mora_configuracion"("id_mora_config") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_por_cobrar" ADD CONSTRAINT "fk_cxc_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_por_cobrar" ADD CONSTRAINT "fk_cxc_usuario_crea" FOREIGN KEY ("id_usuario_crea") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "abono_cxc" ADD CONSTRAINT "fk_abono_cxc" FOREIGN KEY ("id_cxc") REFERENCES "cuenta_por_cobrar"("id_cxc") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "abono_cxc" ADD CONSTRAINT "fk_abono_cxc_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
