-- CreateEnum
CREATE TYPE "tipo_movimiento_bancario" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "metodo_movimiento_bancario" AS ENUM ('CHEQUE', 'TRANSFERENCIA', 'DEPOSITO', 'AJUSTE_MANUAL', 'NOTA_DEBITO', 'NOTA_CREDITO', 'COMISION_BANCARIA', 'INTERES');

-- CreateEnum
CREATE TYPE "modulo_origen_movimiento" AS ENUM ('VENTAS', 'COMPRAS', 'NOMINA', 'GASTOS', 'MANUAL');

-- CreateEnum
CREATE TYPE "estado_movimiento_bancario" AS ENUM ('ACTIVO', 'ANULADO');

-- CreateEnum
CREATE TYPE "estado_cheque" AS ENUM ('EMITIDO', 'COBRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "tipo_deposito_bancario" AS ENUM ('EFECTIVO', 'CHEQUE_TERCEROS');

-- CreateTable
CREATE TABLE "cuenta_bancaria" (
    "id_cuenta_bancaria" SERIAL NOT NULL,
    "id_banco" INTEGER NOT NULL,
    "id_tipo_cuenta" INTEGER NOT NULL,
    "id_sucursal" INTEGER,
    "id_usuario_crea" INTEGER NOT NULL,
    "numero_cuenta" TEXT NOT NULL,
    "alias" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "saldo_actual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "permite_saldo_negativo" BOOLEAN NOT NULL DEFAULT false,
    "fecha_apertura" TIMESTAMP(3),
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "version" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuenta_bancaria_pkey" PRIMARY KEY ("id_cuenta_bancaria")
);

-- CreateTable
CREATE TABLE "movimiento_bancario" (
    "id_movimiento" SERIAL NOT NULL,
    "id_cuenta_bancaria" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_movimiento" "tipo_movimiento_bancario" NOT NULL,
    "metodo" "metodo_movimiento_bancario" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "saldo_resultante" DECIMAL(12,2) NOT NULL,
    "referencia_bancaria" TEXT,
    "documento_origen_id" INTEGER,
    "modulo_origen" "modulo_origen_movimiento",
    "descripcion" TEXT,
    "estado_movimiento" "estado_movimiento_bancario" NOT NULL DEFAULT 'ACTIVO',
    "id_usuario_anula" INTEGER,
    "motivo_anulacion" TEXT,
    "fecha_anulacion" TIMESTAMP(3),
    "metadata" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_bancario_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "cheque" (
    "id_cheque" SERIAL NOT NULL,
    "id_movimiento" INTEGER NOT NULL,
    "numero_cheque" TEXT NOT NULL,
    "beneficiario" TEXT NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "fecha_cobro" TIMESTAMP(3),
    "estado_cheque" "estado_cheque" NOT NULL DEFAULT 'EMITIDO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cheque_pkey" PRIMARY KEY ("id_cheque")
);

-- CreateTable
CREATE TABLE "transferencia_bancaria" (
    "id_transferencia" SERIAL NOT NULL,
    "id_movimiento" INTEGER NOT NULL,
    "banco_contraparte" TEXT,
    "cuenta_contraparte" TEXT,
    "codigo_autorizacion" TEXT,
    "fecha_transferencia" TIMESTAMP(3) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencia_bancaria_pkey" PRIMARY KEY ("id_transferencia")
);

-- CreateTable
CREATE TABLE "deposito_bancario" (
    "id_deposito" SERIAL NOT NULL,
    "id_movimiento" INTEGER NOT NULL,
    "tipo_deposito" "tipo_deposito_bancario" NOT NULL,
    "numero_boleta" TEXT,
    "fecha_deposito" TIMESTAMP(3) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposito_bancario_pkey" PRIMARY KEY ("id_deposito")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_bancaria_numero_cuenta_key" ON "cuenta_bancaria"("numero_cuenta");

-- CreateIndex
CREATE INDEX "cuenta_bancaria_id_banco_idx" ON "cuenta_bancaria"("id_banco");

-- CreateIndex
CREATE INDEX "cuenta_bancaria_estado_idx" ON "cuenta_bancaria"("estado");

-- CreateIndex
CREATE INDEX "movimiento_bancario_id_cuenta_bancaria_idx" ON "movimiento_bancario"("id_cuenta_bancaria");

-- CreateIndex
CREATE INDEX "movimiento_bancario_fecha_movimiento_idx" ON "movimiento_bancario"("fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimiento_bancario_tipo_movimiento_idx" ON "movimiento_bancario"("tipo_movimiento");

-- CreateIndex
CREATE INDEX "movimiento_bancario_estado_movimiento_idx" ON "movimiento_bancario"("estado_movimiento");

-- CreateIndex
CREATE INDEX "movimiento_bancario_modulo_origen_idx" ON "movimiento_bancario"("modulo_origen");

-- CreateIndex
CREATE UNIQUE INDEX "cheque_id_movimiento_key" ON "cheque"("id_movimiento");

-- CreateIndex
CREATE UNIQUE INDEX "transferencia_bancaria_id_movimiento_key" ON "transferencia_bancaria"("id_movimiento");

-- CreateIndex
CREATE UNIQUE INDEX "deposito_bancario_id_movimiento_key" ON "deposito_bancario"("id_movimiento");

-- AddForeignKey
ALTER TABLE "cuenta_bancaria" ADD CONSTRAINT "fk_cuenta_bancaria_banco" FOREIGN KEY ("id_banco") REFERENCES "cat_banco"("id_banco") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_bancaria" ADD CONSTRAINT "fk_cuenta_bancaria_tipo_cuenta" FOREIGN KEY ("id_tipo_cuenta") REFERENCES "cat_tipo_cuenta_banco"("id_tipo_cuenta") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_bancaria" ADD CONSTRAINT "fk_cuenta_bancaria_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cuenta_bancaria" ADD CONSTRAINT "fk_cuenta_bancaria_usuario_crea" FOREIGN KEY ("id_usuario_crea") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_bancario" ADD CONSTRAINT "fk_movimiento_bancario_cuenta" FOREIGN KEY ("id_cuenta_bancaria") REFERENCES "cuenta_bancaria"("id_cuenta_bancaria") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_bancario" ADD CONSTRAINT "fk_movimiento_bancario_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_bancario" ADD CONSTRAINT "fk_movimiento_bancario_usuario_anula" FOREIGN KEY ("id_usuario_anula") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cheque" ADD CONSTRAINT "fk_cheque_movimiento" FOREIGN KEY ("id_movimiento") REFERENCES "movimiento_bancario"("id_movimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transferencia_bancaria" ADD CONSTRAINT "fk_transferencia_movimiento" FOREIGN KEY ("id_movimiento") REFERENCES "movimiento_bancario"("id_movimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "deposito_bancario" ADD CONSTRAINT "fk_deposito_movimiento" FOREIGN KEY ("id_movimiento") REFERENCES "movimiento_bancario"("id_movimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- InsertData
INSERT INTO public.cat_banco (codigo,nombre,activo,fecha_creacion,fecha_ultima_actualizacion) VALUES
	('0001','Agrícola, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0002','Cuscatlán de El Salvador, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0003','Davivienda Salvadoreño, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0004','América Central, S.A. (BAC)',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0005','Promerica, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0006','Azul de El Salvador, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0007','Atlántida El Salvador, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0008','ABANK, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0009','Industrial El Salvador, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0010','ProCredit, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0011','Azteca El Salvador, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073'),
    ('0012','G&T Continental El Salvador, S.A.',true,'2026-02-16 15:06:32.073','2026-02-16 15:06:32.073');


INSERT INTO public.cat_tipo_cuenta_banco (codigo,nombre,activo,fecha_creacion,fecha_ultima_actualizacion) VALUES
	 ('0001','Ahorro',true,'2026-02-16 15:07:23.881','2026-02-16 15:07:23.881'),
	 ('0002','Corriente',true,'2026-02-16 15:07:23.888','2026-02-16 15:07:23.888');

