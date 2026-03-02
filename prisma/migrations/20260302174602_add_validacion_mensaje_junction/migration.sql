-- CreateTable
CREATE TABLE "whatsapp_validacion_mensaje" (
    "id_validacion_mensaje" SERIAL NOT NULL,
    "id_validacion" INTEGER NOT NULL,
    "id_message" INTEGER NOT NULL,
    "tipo" "tipo_mensaje_whatsapp" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_validacion_mensaje_pkey" PRIMARY KEY ("id_validacion_mensaje")
);

-- CreateIndex
CREATE INDEX "whatsapp_validacion_mensaje_id_validacion_idx" ON "whatsapp_validacion_mensaje"("id_validacion");

-- CreateIndex
CREATE INDEX "whatsapp_validacion_mensaje_id_message_idx" ON "whatsapp_validacion_mensaje"("id_message");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_validacion_mensaje_id_validacion_id_message_key" ON "whatsapp_validacion_mensaje"("id_validacion", "id_message");

-- AddForeignKey
ALTER TABLE "whatsapp_validacion_mensaje" ADD CONSTRAINT "fk_validacion_mensaje_validacion" FOREIGN KEY ("id_validacion") REFERENCES "whatsapp_validacion_comprobante"("id_validacion") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_validacion_mensaje" ADD CONSTRAINT "fk_validacion_mensaje_message" FOREIGN KEY ("id_message") REFERENCES "whatsapp_message"("id_message") ON DELETE CASCADE ON UPDATE NO ACTION;
