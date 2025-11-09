-- DropForeignKey
ALTER TABLE "public"."inventario_series" DROP CONSTRAINT "inventario_series_id_inventario_fkey";

-- AlterTable
ALTER TABLE "inventario_series" ALTER COLUMN "id_inventario" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "inventario_series" ADD CONSTRAINT "inventario_series_id_inventario_fkey" FOREIGN KEY ("id_inventario") REFERENCES "inventario"("id_inventario") ON DELETE SET NULL ON UPDATE CASCADE;
