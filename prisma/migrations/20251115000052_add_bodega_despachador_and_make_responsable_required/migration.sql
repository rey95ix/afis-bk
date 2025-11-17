/*
  Warnings:

  - Made the column `id_responsable` on table `bodegas` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."bodegas" DROP CONSTRAINT "fk_bodega_responsable";

-- AlterTable
ALTER TABLE "bodegas" ADD COLUMN     "id_despachador" INTEGER,
ALTER COLUMN "id_responsable" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "bodegas" ADD CONSTRAINT "fk_bodega_responsable" FOREIGN KEY ("id_responsable") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodegas" ADD CONSTRAINT "fk_bodega_despachador" FOREIGN KEY ("id_despachador") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
