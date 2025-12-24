-- AlterEnum
ALTER TYPE "tipo_auditoria" ADD VALUE 'PARCIAL';

-- AlterEnum
ALTER TYPE "tipo_orden_salida" ADD VALUE 'DESTRUCCION_CERTIFICADA';

-- AlterTable
ALTER TABLE "ordenes_salida" ADD COLUMN     "empresa_destructora" TEXT,
ADD COLUMN     "fecha_destruccion" TIMESTAMP(3),
ADD COLUMN     "numero_certificado" TEXT,
ADD COLUMN     "url_certificado" TEXT;
