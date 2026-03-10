-- AlterTable
ALTER TABLE "whatsapp_validacion_comprobante" ADD COLUMN     "imagenes_directas" TEXT,
ALTER COLUMN "id_message" DROP NOT NULL,
ALTER COLUMN "id_chat" DROP NOT NULL;
