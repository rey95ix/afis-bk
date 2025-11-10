/*
  Warnings:

  - You are about to drop the column `destinatario` on the `ordenes_salida` table. All the data in the column will be lost.
  - You are about to drop the column `direccion_destino` on the `ordenes_salida` table. All the data in the column will be lost.
  - You are about to drop the column `documento_destinatario` on the `ordenes_salida` table. All the data in the column will be lost.
  - You are about to drop the column `numero_documento` on the `ordenes_salida` table. All the data in the column will be lost.
  - You are about to drop the column `referencia_externa` on the `ordenes_salida` table. All the data in the column will be lost.
  - You are about to drop the column `telefono_destinatario` on the `ordenes_salida` table. All the data in the column will be lost.
  - Made the column `id_sucursal_origen` on table `ordenes_salida` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."ordenes_salida" DROP CONSTRAINT "ordenes_salida_id_sucursal_origen_fkey";

-- AlterTable
ALTER TABLE "ordenes_salida" DROP COLUMN "destinatario",
DROP COLUMN "direccion_destino",
DROP COLUMN "documento_destinatario",
DROP COLUMN "numero_documento",
DROP COLUMN "referencia_externa",
DROP COLUMN "telefono_destinatario",
ADD COLUMN     "id_estante" INTEGER,
ALTER COLUMN "id_sucursal_origen" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ordenes_salida" ADD CONSTRAINT "ordenes_salida_id_sucursal_origen_fkey" FOREIGN KEY ("id_sucursal_origen") REFERENCES "sucursales"("id_sucursal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_salida" ADD CONSTRAINT "ordenes_salida_id_estante_fkey" FOREIGN KEY ("id_estante") REFERENCES "estantes"("id_estante") ON DELETE SET NULL ON UPDATE CASCADE;
