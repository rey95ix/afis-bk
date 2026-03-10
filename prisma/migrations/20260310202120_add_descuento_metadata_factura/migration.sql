-- AlterTable
ALTER TABLE "facturaDirecta" ADD COLUMN     "descuento_fecha" TIMESTAMP(3),
ADD COLUMN     "descuento_motivo" TEXT,
ADD COLUMN     "descuento_porcentaje" DECIMAL(5,2),
ADD COLUMN     "descuento_usuario" INTEGER;
