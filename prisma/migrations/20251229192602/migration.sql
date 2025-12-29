/*
  Warnings:

  - A unique constraint covering the columns `[reset_password_token]` on the table `cliente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[activation_token]` on the table `cliente` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "activation_token" TEXT,
ADD COLUMN     "activation_token_expires" TIMESTAMP(3),
ADD COLUMN     "cuenta_activada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cuenta_bloqueada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fcm_token_cliente" TEXT,
ADD COLUMN     "fecha_activacion" TIMESTAMP(3),
ADD COLUMN     "fecha_bloqueo" TIMESTAMP(3),
ADD COLUMN     "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "reset_password_expires" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" TEXT,
ADD COLUMN     "ultimo_login" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cliente_sesiones" (
    "id_sesion" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "dispositivo" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "ultima_actividad" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocada" BOOLEAN NOT NULL DEFAULT false,
    "fecha_revocacion" TIMESTAMP(3),

    CONSTRAINT "cliente_sesiones_pkey" PRIMARY KEY ("id_sesion")
);

-- CreateTable
CREATE TABLE "cliente_log" (
    "id_log" SERIAL NOT NULL,
    "id_cliente" INTEGER,
    "accion" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "detalles" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_log_pkey" PRIMARY KEY ("id_log")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliente_sesiones_token_hash_key" ON "cliente_sesiones"("token_hash");

-- CreateIndex
CREATE INDEX "cliente_sesiones_id_cliente_idx" ON "cliente_sesiones"("id_cliente");

-- CreateIndex
CREATE INDEX "cliente_sesiones_token_hash_idx" ON "cliente_sesiones"("token_hash");

-- CreateIndex
CREATE INDEX "cliente_sesiones_fecha_expiracion_idx" ON "cliente_sesiones"("fecha_expiracion");

-- CreateIndex
CREATE INDEX "cliente_log_id_cliente_idx" ON "cliente_log"("id_cliente");

-- CreateIndex
CREATE INDEX "cliente_log_accion_idx" ON "cliente_log"("accion");

-- CreateIndex
CREATE INDEX "cliente_log_fecha_creacion_idx" ON "cliente_log"("fecha_creacion");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_reset_password_token_key" ON "cliente"("reset_password_token");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_activation_token_key" ON "cliente"("activation_token");

-- CreateIndex
CREATE INDEX "cliente_correo_electronico_idx" ON "cliente"("correo_electronico");

-- CreateIndex
CREATE INDEX "cliente_cuenta_activada_idx" ON "cliente"("cuenta_activada");

-- AddForeignKey
ALTER TABLE "cliente_sesiones" ADD CONSTRAINT "cliente_sesiones_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_log" ADD CONSTRAINT "cliente_log_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;
