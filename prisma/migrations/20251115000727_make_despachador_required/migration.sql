/*
  Warnings:

  - Made the column `id_despachador` on table `bodegas` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."bodegas" DROP CONSTRAINT "fk_bodega_despachador";

-- AlterTable
ALTER TABLE "bodegas" ALTER COLUMN "id_despachador" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "bodegas" ADD CONSTRAINT "fk_bodega_despachador" FOREIGN KEY ("id_despachador") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
