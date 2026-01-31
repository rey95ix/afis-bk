/*
  Warnings:

  - A unique constraint covering the columns `[anulacion_codigo_generacion]` on the table `facturaDirecta` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "facturaDirecta" ADD COLUMN     "anulacion_codigo_generacion" CHAR(36),
ADD COLUMN     "anulacion_codigo_msg" VARCHAR(10),
ADD COLUMN     "anulacion_descripcion_msg" VARCHAR(500),
ADD COLUMN     "anulacion_firmada" TEXT,
ADD COLUMN     "anulacion_json" TEXT,
ADD COLUMN     "anulacion_motivo" VARCHAR(300),
ADD COLUMN     "anulacion_sello_recepcion" VARCHAR(50),
ADD COLUMN     "fecha_anulacion" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "facturaDirecta_anulacion_codigo_generacion_key" ON "facturaDirecta"("anulacion_codigo_generacion");
