/*
  Warnings:

  - A unique constraint covering the columns `[codigo]` on the table `categorias` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `codigo` to the `categorias` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "codigo" CHAR(2) NOT NULL,
ADD COLUMN     "id_categoria_padre" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "categorias_codigo_key" ON "categorias"("codigo");

-- CreateIndex
CREATE INDEX "categorias_id_categoria_padre_idx" ON "categorias"("id_categoria_padre");

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_id_categoria_padre_fkey" FOREIGN KEY ("id_categoria_padre") REFERENCES "categorias"("id_categoria") ON DELETE NO ACTION ON UPDATE NO ACTION;
