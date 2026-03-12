-- CreateTable
CREATE TABLE "punto_express_integrador" (
    "id_integrador" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "punto_express_integrador_pkey" PRIMARY KEY ("id_integrador")
);

-- CreateIndex
CREATE UNIQUE INDEX "punto_express_integrador_nombre_key" ON "punto_express_integrador"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "punto_express_integrador_usuario_key" ON "punto_express_integrador"("usuario");

-- CreateIndex
CREATE INDEX "punto_express_integrador_usuario_idx" ON "punto_express_integrador"("usuario");
-- AlterEnum
ALTER TYPE "metodo_pago_abono" ADD VALUE 'PUNTOXPRESS';
