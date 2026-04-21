-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "precio_con_iva_incluido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tasa_iva" DOUBLE PRECISION NOT NULL DEFAULT 0.13;

-- AlterTable
ALTER TABLE "cotizaciones_compra" ADD COLUMN     "precio_con_iva_incluido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tasa_iva" DOUBLE PRECISION NOT NULL DEFAULT 0.13;

-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "precio_con_iva_incluido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tasa_iva" DOUBLE PRECISION NOT NULL DEFAULT 0.13;
