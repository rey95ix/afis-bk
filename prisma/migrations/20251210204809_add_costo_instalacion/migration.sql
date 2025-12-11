-- AlterTable
ALTER TABLE "atcContrato" ADD COLUMN     "costo_instalacion" DECIMAL(10,2);
-- AlterTable
ALTER TABLE "clienteDocumentos" ADD COLUMN     "dui_extraido_ia" TEXT,
ADD COLUMN     "validacion_ia" TEXT;
-- AlterTable
ALTER TABLE "clienteDocumentos" ADD COLUMN     "direccion_extraida" TEXT,
ADD COLUMN     "numero_contrato_extraido" TEXT,
ADD COLUMN     "tipo_servicio_recibo" TEXT;

-- CreateIndex
CREATE INDEX "clienteDocumentos_numero_contrato_extraido_idx" ON "clienteDocumentos"("numero_contrato_extraido");
