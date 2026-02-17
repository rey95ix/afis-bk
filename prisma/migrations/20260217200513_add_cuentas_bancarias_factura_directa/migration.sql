-- AlterTable
ALTER TABLE "facturaDirecta" ADD COLUMN     "id_cuenta_cheque" INTEGER,
ADD COLUMN     "id_cuenta_tarjeta" INTEGER,
ADD COLUMN     "id_cuenta_transferencia" INTEGER;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_cuenta_tarjeta" FOREIGN KEY ("id_cuenta_tarjeta") REFERENCES "cuenta_bancaria"("id_cuenta_bancaria") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_cuenta_cheque" FOREIGN KEY ("id_cuenta_cheque") REFERENCES "cuenta_bancaria"("id_cuenta_bancaria") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_cuenta_transferencia" FOREIGN KEY ("id_cuenta_transferencia") REFERENCES "cuenta_bancaria"("id_cuenta_bancaria") ON DELETE NO ACTION ON UPDATE NO ACTION;
