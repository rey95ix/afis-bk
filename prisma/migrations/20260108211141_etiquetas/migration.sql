-- CreateTable
CREATE TABLE "whatsapp_chat_etiqueta" (
    "id_etiqueta" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_creador" INTEGER,

    CONSTRAINT "whatsapp_chat_etiqueta_pkey" PRIMARY KEY ("id_etiqueta")
);

-- CreateTable
CREATE TABLE "whatsapp_chat_etiqueta_chat" (
    "id" SERIAL NOT NULL,
    "id_chat" INTEGER NOT NULL,
    "id_etiqueta" INTEGER NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_asigno" INTEGER,

    CONSTRAINT "whatsapp_chat_etiqueta_chat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_chat_etiqueta_nombre_key" ON "whatsapp_chat_etiqueta"("nombre");

-- CreateIndex
CREATE INDEX "whatsapp_chat_etiqueta_activo_idx" ON "whatsapp_chat_etiqueta"("activo");

-- CreateIndex
CREATE INDEX "whatsapp_chat_etiqueta_nombre_idx" ON "whatsapp_chat_etiqueta"("nombre");

-- CreateIndex
CREATE INDEX "whatsapp_chat_etiqueta_chat_id_chat_idx" ON "whatsapp_chat_etiqueta_chat"("id_chat");

-- CreateIndex
CREATE INDEX "whatsapp_chat_etiqueta_chat_id_etiqueta_idx" ON "whatsapp_chat_etiqueta_chat"("id_etiqueta");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_chat_etiqueta_chat_id_chat_id_etiqueta_key" ON "whatsapp_chat_etiqueta_chat"("id_chat", "id_etiqueta");

-- AddForeignKey
ALTER TABLE "whatsapp_chat_etiqueta" ADD CONSTRAINT "fk_whatsapp_etiqueta_usuario_creador" FOREIGN KEY ("id_usuario_creador") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_chat_etiqueta_chat" ADD CONSTRAINT "fk_whatsapp_etiqueta_chat_chat" FOREIGN KEY ("id_chat") REFERENCES "whatsapp_chat"("id_chat") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_chat_etiqueta_chat" ADD CONSTRAINT "fk_whatsapp_etiqueta_chat_etiqueta" FOREIGN KEY ("id_etiqueta") REFERENCES "whatsapp_chat_etiqueta"("id_etiqueta") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_chat_etiqueta_chat" ADD CONSTRAINT "fk_whatsapp_etiqueta_chat_usuario" FOREIGN KEY ("id_usuario_asigno") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;
