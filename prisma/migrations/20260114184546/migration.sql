-- CreateEnum
CREATE TYPE "estado_validacion_comprobante" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "whatsapp_validacion_comprobante" (
    "id_validacion" SERIAL NOT NULL,
    "id_message" INTEGER NOT NULL,
    "id_chat" INTEGER NOT NULL,
    "monto" DECIMAL(12,2),
    "fecha_transaccion" DATE,
    "numero_referencia" VARCHAR(100),
    "banco" VARCHAR(100),
    "cuenta_origen" VARCHAR(50),
    "cuenta_destino" VARCHAR(50),
    "nombre_titular" VARCHAR(200),
    "confianza" VARCHAR(10),
    "estado" "estado_validacion_comprobante" NOT NULL DEFAULT 'PENDIENTE',
    "comentario_rechazo" TEXT,
    "id_usuario_envia" INTEGER NOT NULL,
    "id_usuario_valida" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_validacion" TIMESTAMP(3),

    CONSTRAINT "whatsapp_validacion_comprobante_pkey" PRIMARY KEY ("id_validacion")
);

-- CreateIndex
CREATE INDEX "whatsapp_validacion_comprobante_estado_idx" ON "whatsapp_validacion_comprobante"("estado");

-- CreateIndex
CREATE INDEX "whatsapp_validacion_comprobante_fecha_creacion_idx" ON "whatsapp_validacion_comprobante"("fecha_creacion");

-- CreateIndex
CREATE INDEX "whatsapp_validacion_comprobante_id_chat_idx" ON "whatsapp_validacion_comprobante"("id_chat");

-- CreateIndex
CREATE INDEX "whatsapp_validacion_comprobante_id_message_idx" ON "whatsapp_validacion_comprobante"("id_message");

-- AddForeignKey
ALTER TABLE "whatsapp_validacion_comprobante" ADD CONSTRAINT "fk_validacion_comprobante_message" FOREIGN KEY ("id_message") REFERENCES "whatsapp_message"("id_message") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_validacion_comprobante" ADD CONSTRAINT "fk_validacion_comprobante_chat" FOREIGN KEY ("id_chat") REFERENCES "whatsapp_chat"("id_chat") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_validacion_comprobante" ADD CONSTRAINT "fk_validacion_comprobante_usuario_envia" FOREIGN KEY ("id_usuario_envia") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_validacion_comprobante" ADD CONSTRAINT "fk_validacion_comprobante_usuario_valida" FOREIGN KEY ("id_usuario_valida") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;
-- AlterEnum
ALTER TYPE "estado_validacion_comprobante" ADD VALUE 'APLICADO';
-- AlterTable
ALTER TABLE "whatsapp_validacion_comprobante" ADD COLUMN     "fecha_aplicacion" TIMESTAMP(3),
ADD COLUMN     "id_usuario_aplica" INTEGER;

-- AddForeignKey
ALTER TABLE "whatsapp_validacion_comprobante" ADD CONSTRAINT "fk_validacion_comprobante_usuario_aplica" FOREIGN KEY ("id_usuario_aplica") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;
