-- AlterTable
ALTER TABLE "atcContrato" ADD COLUMN     "id_contrato_anterior" INTEGER;

-- AddForeignKey
ALTER TABLE "atcContrato" ADD CONSTRAINT "fk_contrato_anterior" FOREIGN KEY ("id_contrato_anterior") REFERENCES "atcContrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;
-- AlterTable
ALTER TABLE "cuenta_por_cobrar" ADD COLUMN     "mora_exonerada" BOOLEAN NOT NULL DEFAULT false;
