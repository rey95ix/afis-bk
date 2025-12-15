-- CreateEnum
CREATE TYPE "estado_chat" AS ENUM ('ABIERTO', 'PENDIENTE', 'CERRADO', 'IA_MANEJANDO');

-- CreateEnum
CREATE TYPE "direccion_mensaje" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "tipo_mensaje_whatsapp" AS ENUM ('TEXTO', 'IMAGEN', 'VIDEO', 'AUDIO', 'DOCUMENTO', 'UBICACION', 'CONTACTO', 'STICKER', 'PLANTILLA');

-- CreateEnum
CREATE TYPE "estado_mensaje_whatsapp" AS ENUM ('PENDIENTE', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "proveedor_ia" AS ENUM ('OPENAI', 'CLAUDE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "logica_condicion" AS ENUM ('AND', 'OR');

-- CreateTable
CREATE TABLE "whatsapp_chat" (
    "id_chat" SERIAL NOT NULL,
    "whatsapp_chat_id" TEXT NOT NULL,
    "id_cliente" INTEGER,
    "telefono_cliente" TEXT NOT NULL,
    "nombre_cliente" TEXT,
    "foto_perfil_cliente" TEXT,
    "estado" "estado_chat" NOT NULL DEFAULT 'PENDIENTE',
    "id_usuario_asignado" INTEGER,
    "ultimo_mensaje_at" TIMESTAMP(3),
    "preview_ultimo_mensaje" TEXT,
    "mensajes_no_leidos" INTEGER NOT NULL DEFAULT 0,
    "ia_habilitada" BOOLEAN NOT NULL DEFAULT true,
    "ia_mensajes_count" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "metadata" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),

    CONSTRAINT "whatsapp_chat_pkey" PRIMARY KEY ("id_chat")
);

-- CreateTable
CREATE TABLE "whatsapp_message" (
    "id_message" SERIAL NOT NULL,
    "id_chat" INTEGER NOT NULL,
    "whatsapp_message_id" TEXT NOT NULL,
    "direccion" "direccion_mensaje" NOT NULL,
    "tipo" "tipo_mensaje_whatsapp" NOT NULL DEFAULT 'TEXTO',
    "contenido" TEXT NOT NULL,
    "url_media" TEXT,
    "tipo_media" TEXT,
    "tamano_media" INTEGER,
    "estado" "estado_mensaje_whatsapp" NOT NULL DEFAULT 'ENVIADO',
    "id_usuario_envia" INTEGER,
    "es_de_ia" BOOLEAN NOT NULL DEFAULT false,
    "id_regla_ia" INTEGER,
    "confianza_ia" DOUBLE PRECISION,
    "metadata" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_entrega" TIMESTAMP(3),
    "fecha_lectura" TIMESTAMP(3),

    CONSTRAINT "whatsapp_message_pkey" PRIMARY KEY ("id_message")
);

-- CreateTable
CREATE TABLE "whatsapp_ia_config" (
    "id_config" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "proveedor" "proveedor_ia" NOT NULL DEFAULT 'OPENAI',
    "modelo" TEXT NOT NULL DEFAULT 'gpt-4',
    "api_key" TEXT,
    "temperatura" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 500,
    "system_prompt" TEXT NOT NULL,
    "ventana_contexto" INTEGER NOT NULL DEFAULT 10,
    "fallback_a_humano" BOOLEAN NOT NULL DEFAULT true,
    "condiciones_fallback" JSONB,
    "delay_respuesta_seg" INTEGER NOT NULL DEFAULT 2,
    "horario_atencion" JSONB,
    "metadata" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_ia_config_pkey" PRIMARY KEY ("id_config")
);

-- CreateTable
CREATE TABLE "whatsapp_ia_rule" (
    "id_regla" SERIAL NOT NULL,
    "id_config" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "condiciones" JSONB NOT NULL,
    "logica_condiciones" "logica_condicion" NOT NULL DEFAULT 'AND',
    "acciones" JSONB NOT NULL,
    "metadata" JSONB,
    "ejecuciones_count" INTEGER NOT NULL DEFAULT 0,
    "ultima_ejecucion_at" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_ia_rule_pkey" PRIMARY KEY ("id_regla")
);

-- CreateTable
CREATE TABLE "whatsapp_chat_assignment" (
    "id_asignacion" SERIAL NOT NULL,
    "id_chat" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_asignado_por" INTEGER,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_desasignacion" TIMESTAMP(3),
    "razon" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "whatsapp_chat_assignment_pkey" PRIMARY KEY ("id_asignacion")
);

-- CreateTable
CREATE TABLE "whatsapp_chat_metrics" (
    "id_metrica" SERIAL NOT NULL,
    "id_chat" INTEGER NOT NULL,
    "tiempo_primera_respuesta" INTEGER,
    "tiempo_respuesta_promedio" INTEGER,
    "total_mensajes" INTEGER NOT NULL DEFAULT 0,
    "mensajes_agente" INTEGER NOT NULL DEFAULT 0,
    "mensajes_ia" INTEGER NOT NULL DEFAULT 0,
    "mensajes_cliente" INTEGER NOT NULL DEFAULT 0,
    "duracion" INTEGER,
    "puntuacion_satisfaccion" INTEGER,
    "fue_escalado" BOOLEAN NOT NULL DEFAULT false,
    "razon_escalado" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_chat_metrics_pkey" PRIMARY KEY ("id_metrica")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_chat_whatsapp_chat_id_key" ON "whatsapp_chat"("whatsapp_chat_id");

-- CreateIndex
CREATE INDEX "whatsapp_chat_id_cliente_idx" ON "whatsapp_chat"("id_cliente");

-- CreateIndex
CREATE INDEX "whatsapp_chat_id_usuario_asignado_idx" ON "whatsapp_chat"("id_usuario_asignado");

-- CreateIndex
CREATE INDEX "whatsapp_chat_estado_idx" ON "whatsapp_chat"("estado");

-- CreateIndex
CREATE INDEX "whatsapp_chat_telefono_cliente_idx" ON "whatsapp_chat"("telefono_cliente");

-- CreateIndex
CREATE INDEX "whatsapp_chat_ultimo_mensaje_at_idx" ON "whatsapp_chat"("ultimo_mensaje_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_message_whatsapp_message_id_key" ON "whatsapp_message"("whatsapp_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_id_chat_idx" ON "whatsapp_message"("id_chat");

-- CreateIndex
CREATE INDEX "whatsapp_message_id_usuario_envia_idx" ON "whatsapp_message"("id_usuario_envia");

-- CreateIndex
CREATE INDEX "whatsapp_message_direccion_idx" ON "whatsapp_message"("direccion");

-- CreateIndex
CREATE INDEX "whatsapp_message_fecha_creacion_idx" ON "whatsapp_message"("fecha_creacion");

-- CreateIndex
CREATE INDEX "whatsapp_ia_config_activo_idx" ON "whatsapp_ia_config"("activo");

-- CreateIndex
CREATE INDEX "whatsapp_ia_rule_id_config_idx" ON "whatsapp_ia_rule"("id_config");

-- CreateIndex
CREATE INDEX "whatsapp_ia_rule_activo_idx" ON "whatsapp_ia_rule"("activo");

-- CreateIndex
CREATE INDEX "whatsapp_ia_rule_prioridad_idx" ON "whatsapp_ia_rule"("prioridad");

-- CreateIndex
CREATE INDEX "whatsapp_chat_assignment_id_chat_idx" ON "whatsapp_chat_assignment"("id_chat");

-- CreateIndex
CREATE INDEX "whatsapp_chat_assignment_id_usuario_idx" ON "whatsapp_chat_assignment"("id_usuario");

-- CreateIndex
CREATE INDEX "whatsapp_chat_assignment_activo_idx" ON "whatsapp_chat_assignment"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_chat_metrics_id_chat_key" ON "whatsapp_chat_metrics"("id_chat");

-- CreateIndex
CREATE INDEX "whatsapp_chat_metrics_id_chat_idx" ON "whatsapp_chat_metrics"("id_chat");

-- AddForeignKey
ALTER TABLE "whatsapp_chat" ADD CONSTRAINT "fk_whatsapp_chat_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_chat" ADD CONSTRAINT "fk_whatsapp_chat_usuario_asignado" FOREIGN KEY ("id_usuario_asignado") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "fk_whatsapp_message_chat" FOREIGN KEY ("id_chat") REFERENCES "whatsapp_chat"("id_chat") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "fk_whatsapp_message_usuario" FOREIGN KEY ("id_usuario_envia") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "fk_whatsapp_message_regla_ia" FOREIGN KEY ("id_regla_ia") REFERENCES "whatsapp_ia_rule"("id_regla") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_ia_rule" ADD CONSTRAINT "fk_whatsapp_ia_rule_config" FOREIGN KEY ("id_config") REFERENCES "whatsapp_ia_config"("id_config") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_chat_assignment" ADD CONSTRAINT "fk_whatsapp_assignment_chat" FOREIGN KEY ("id_chat") REFERENCES "whatsapp_chat"("id_chat") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_chat_assignment" ADD CONSTRAINT "fk_whatsapp_assignment_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_chat_assignment" ADD CONSTRAINT "fk_whatsapp_assignment_asignado_por" FOREIGN KEY ("id_asignado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_chat_metrics" ADD CONSTRAINT "fk_whatsapp_metrics_chat" FOREIGN KEY ("id_chat") REFERENCES "whatsapp_chat"("id_chat") ON DELETE CASCADE ON UPDATE NO ACTION;
