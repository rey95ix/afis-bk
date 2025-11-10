/*
  Warnings:

  - You are about to drop the column `cantidad_maxima` on the `inventario` table. All the data in the column will be lost.
  - You are about to drop the column `cantidad_minima` on the `inventario` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "catalogo" ADD COLUMN     "cantidad_maxima" INTEGER DEFAULT 0,
ADD COLUMN     "cantidad_minima" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "inventario" DROP COLUMN "cantidad_maxima",
DROP COLUMN "cantidad_minima";
