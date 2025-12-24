-- Agregar nuevos estados al enum estado_inventario para workflow de inspeccion y reparacion post-devolucion
ALTER TYPE "estado_inventario" ADD VALUE 'EN_INSPECCION';
ALTER TYPE "estado_inventario" ADD VALUE 'EN_REPARACION';
-- Agregar campos para calculo de Punto de Reorden (ROP) y Stock de Seguridad al catalogo
-- ROP = (Demanda Promedio Diaria * Lead Time) + Stock Seguridad

ALTER TABLE "catalogo" ADD COLUMN "lead_time_dias" INTEGER;
ALTER TABLE "catalogo" ADD COLUMN "demanda_promedio_diaria" DECIMAL(10,2);
ALTER TABLE "catalogo" ADD COLUMN "stock_seguridad" INTEGER;
ALTER TABLE "catalogo" ADD COLUMN "punto_reorden" INTEGER;
-- Agregar campo vida_util_meses para control de obsolescencia de productos
ALTER TABLE "catalogo" ADD COLUMN "vida_util_meses" INTEGER;
