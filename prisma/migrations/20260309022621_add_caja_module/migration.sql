-- CreateEnum
CREATE TYPE "estado_cierre" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateTable
CREATE TABLE "caja_movimiento" (
    "id_movimiento_caja" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo_pago" "metodo_pago_abono" NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_abono_cxc" INTEGER NOT NULL,
    "id_cierre_usuario" INTEGER,
    "id_cierre_diario" INTEGER,

    CONSTRAINT "caja_movimiento_pkey" PRIMARY KEY ("id_movimiento_caja")
);

-- CreateTable
CREATE TABLE "cierre_usuario" (
    "id_cierre_usuario" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_efectivo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_cheque" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_transferencia" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deposito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_tarjeta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_otro" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_general" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "estado_cierre" NOT NULL DEFAULT 'CERRADO',

    CONSTRAINT "cierre_usuario_pkey" PRIMARY KEY ("id_cierre_usuario")
);

-- CreateTable
CREATE TABLE "cierre_diario" (
    "id_cierre_diario" SERIAL NOT NULL,
    "id_creado_por" INTEGER NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_efectivo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_cheque" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_transferencia" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deposito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_tarjeta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_otro" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_general" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "estado_cierre" NOT NULL DEFAULT 'CERRADO',

    CONSTRAINT "cierre_diario_pkey" PRIMARY KEY ("id_cierre_diario")
);

-- CreateIndex
CREATE UNIQUE INDEX "caja_movimiento_id_abono_cxc_key" ON "caja_movimiento"("id_abono_cxc");

-- CreateIndex
CREATE INDEX "caja_movimiento_id_usuario_idx" ON "caja_movimiento"("id_usuario");

-- CreateIndex
CREATE INDEX "caja_movimiento_id_cliente_idx" ON "caja_movimiento"("id_cliente");

-- CreateIndex
CREATE INDEX "caja_movimiento_id_cierre_usuario_idx" ON "caja_movimiento"("id_cierre_usuario");

-- CreateIndex
CREATE INDEX "caja_movimiento_id_cierre_diario_idx" ON "caja_movimiento"("id_cierre_diario");

-- CreateIndex
CREATE INDEX "caja_movimiento_fecha_hora_idx" ON "caja_movimiento"("fecha_hora");

-- CreateIndex
CREATE INDEX "cierre_usuario_id_usuario_idx" ON "cierre_usuario"("id_usuario");

-- CreateIndex
CREATE INDEX "cierre_usuario_fecha_hora_idx" ON "cierre_usuario"("fecha_hora");

-- CreateIndex
CREATE INDEX "cierre_diario_id_creado_por_idx" ON "cierre_diario"("id_creado_por");

-- CreateIndex
CREATE INDEX "cierre_diario_fecha_hora_idx" ON "cierre_diario"("fecha_hora");

-- AddForeignKey
ALTER TABLE "caja_movimiento" ADD CONSTRAINT "fk_caja_movimiento_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "caja_movimiento" ADD CONSTRAINT "fk_caja_movimiento_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "caja_movimiento" ADD CONSTRAINT "fk_caja_movimiento_abono" FOREIGN KEY ("id_abono_cxc") REFERENCES "abono_cxc"("id_abono") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "caja_movimiento" ADD CONSTRAINT "fk_caja_movimiento_cierre_usuario" FOREIGN KEY ("id_cierre_usuario") REFERENCES "cierre_usuario"("id_cierre_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "caja_movimiento" ADD CONSTRAINT "fk_caja_movimiento_cierre_diario" FOREIGN KEY ("id_cierre_diario") REFERENCES "cierre_diario"("id_cierre_diario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cierre_usuario" ADD CONSTRAINT "fk_cierre_usuario_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cierre_diario" ADD CONSTRAINT "fk_cierre_diario_creado_por" FOREIGN KEY ("id_creado_por") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
