-- CreateEnum
CREATE TYPE "tipo_mensaje_sms" AS ENUM ('NOTIFICACION_FACTURA', 'TECNICO_EN_CAMINO', 'ORDEN_TRABAJO_ASIGNADA', 'ORDEN_TRABAJO_AGENDADA', 'ORDEN_TRABAJO_COMPLETADA', 'TICKET_CREADO', 'TICKET_ACTUALIZADO', 'CAMBIO_ESTADO_SERVICIO', 'RECORDATORIO_PAGO', 'PROMOCION', 'GENERAL');

-- CreateEnum
CREATE TYPE "estado_envio_sms" AS ENUM ('PENDIENTE', 'ENVIADO', 'ENTREGADO', 'FALLIDO', 'EN_COLA');

-- CreateTable
CREATE TABLE "sms_historial" (
    "id_sms" SERIAL NOT NULL,
    "telefono_destino" TEXT NOT NULL,
    "id_cliente" INTEGER,
    "tipo_mensaje" "tipo_mensaje_sms" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "id_orden_trabajo" INTEGER,
    "id_ticket" INTEGER,
    "referencia_adicional" TEXT,
    "estado" "estado_envio_sms" NOT NULL DEFAULT 'PENDIENTE',
    "twilio_sid" TEXT,
    "twilio_status" TEXT,
    "twilio_error_code" TEXT,
    "twilio_error_message" TEXT,
    "costo" DECIMAL(10,4),
    "moneda" TEXT DEFAULT 'USD',
    "enviado_por" INTEGER,
    "intentos_envio" INTEGER NOT NULL DEFAULT 1,
    "fecha_ultimo_intento" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_envio" TIMESTAMP(3),
    "fecha_entrega" TIMESTAMP(3),
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_historial_pkey" PRIMARY KEY ("id_sms")
);

-- CreateIndex
CREATE UNIQUE INDEX "sms_historial_twilio_sid_key" ON "sms_historial"("twilio_sid");

-- CreateIndex
CREATE INDEX "sms_historial_telefono_destino_idx" ON "sms_historial"("telefono_destino");

-- CreateIndex
CREATE INDEX "sms_historial_estado_idx" ON "sms_historial"("estado");

-- CreateIndex
CREATE INDEX "sms_historial_tipo_mensaje_idx" ON "sms_historial"("tipo_mensaje");

-- CreateIndex
CREATE INDEX "sms_historial_id_cliente_idx" ON "sms_historial"("id_cliente");

-- CreateIndex
CREATE INDEX "sms_historial_id_orden_trabajo_idx" ON "sms_historial"("id_orden_trabajo");

-- CreateIndex
CREATE INDEX "sms_historial_id_ticket_idx" ON "sms_historial"("id_ticket");

-- CreateIndex
CREATE INDEX "sms_historial_fecha_creacion_idx" ON "sms_historial"("fecha_creacion");

-- AddForeignKey
ALTER TABLE "sms_historial" ADD CONSTRAINT "sms_historial_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_historial" ADD CONSTRAINT "sms_historial_id_orden_trabajo_fkey" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_historial" ADD CONSTRAINT "sms_historial_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "ticket_soporte"("id_ticket") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_historial" ADD CONSTRAINT "sms_historial_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
