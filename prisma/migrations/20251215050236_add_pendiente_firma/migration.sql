-- AlterEnum
ALTER TYPE "estadoContrato" ADD VALUE 'PENDIENTE_FIRMA';

-- AlterTable
ALTER TABLE "atcContrato" ADD COLUMN     "url_contrato_firmado" TEXT;
