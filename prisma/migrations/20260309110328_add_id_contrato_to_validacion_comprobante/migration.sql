-- AlterTable
ALTER TABLE "whatsapp_validacion_comprobante" ADD COLUMN     "id_contrato" INTEGER;

-- AddForeignKey
ALTER TABLE "whatsapp_validacion_comprobante" ADD CONSTRAINT "fk_validacion_comprobante_contrato" FOREIGN KEY ("id_contrato") REFERENCES "atcContrato"("id_contrato") ON DELETE SET NULL ON UPDATE NO ACTION;
