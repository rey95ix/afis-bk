-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "fecha_recepcion" TIMESTAMP(3),
ADD COLUMN     "recepcionada" BOOLEAN NOT NULL DEFAULT false;
