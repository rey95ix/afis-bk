-- AlterTable: make id_direccion_servicio optional on ticket_soporte
ALTER TABLE "ticket_soporte" ALTER COLUMN "id_direccion_servicio" DROP NOT NULL;

-- AlterTable: add id_chat to ticket_soporte
ALTER TABLE "ticket_soporte" ADD COLUMN "id_chat" INTEGER;

-- AddForeignKey
ALTER TABLE "ticket_soporte" ADD CONSTRAINT "ticket_soporte_id_chat_fkey" FOREIGN KEY ("id_chat") REFERENCES "whatsapp_chat"("id_chat") ON DELETE SET NULL ON UPDATE CASCADE;
