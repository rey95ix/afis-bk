-- AlterTable
ALTER TABLE "whatsapp_chat" ADD COLUMN     "ultima_interaccion_cliente" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "whatsapp_template" (
    "id_template" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "categoria" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'APPROVED',
    "componentes" JSONB NOT NULL,
    "variables" JSONB,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_template_pkey" PRIMARY KEY ("id_template")
);

-- CreateTable
CREATE TABLE "configuracion_whatsapp" (
    "id_config" SERIAL NOT NULL,
    "auto_asignacion" BOOLEAN NOT NULL DEFAULT true,
    "max_chats_por_agente" INTEGER NOT NULL DEFAULT 10,
    "notificaciones_push" BOOLEAN NOT NULL DEFAULT true,
    "sonido_notificacion" BOOLEAN NOT NULL DEFAULT true,
    "tiempo_alerta_sin_respuesta" INTEGER NOT NULL DEFAULT 5,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_whatsapp_pkey" PRIMARY KEY ("id_config")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_template_nombre_key" ON "whatsapp_template"("nombre");

-- CreateIndex
CREATE INDEX "whatsapp_template_nombre_idx" ON "whatsapp_template"("nombre");

-- CreateIndex
CREATE INDEX "whatsapp_template_categoria_idx" ON "whatsapp_template"("categoria");

-- CreateIndex
CREATE INDEX "whatsapp_template_estado_idx" ON "whatsapp_template"("estado");

-- CreateIndex
CREATE INDEX "whatsapp_template_activo_idx" ON "whatsapp_template"("activo");

-- CreateIndex
CREATE INDEX "whatsapp_chat_ultima_interaccion_cliente_idx" ON "whatsapp_chat"("ultima_interaccion_cliente");
/*
  Warnings:

  - A unique constraint covering the columns `[meta_template_id]` on the table `whatsapp_template` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "whatsapp_template" ADD COLUMN     "meta_template_id" TEXT,
ADD COLUMN     "reject_reason" TEXT,
ADD COLUMN     "sincronizado_con_meta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultima_sincronizacion" TIMESTAMP(3),
ALTER COLUMN "estado" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_template_meta_template_id_key" ON "whatsapp_template"("meta_template_id");

-- CreateIndex
CREATE INDEX "whatsapp_template_meta_template_id_idx" ON "whatsapp_template"("meta_template_id");
