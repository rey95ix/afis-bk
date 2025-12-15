-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "id_estado_civil" INTEGER,
ADD COLUMN     "id_estado_vivienda" INTEGER,
ADD COLUMN     "nombre_conyuge" TEXT,
ADD COLUMN     "telefono_conyuge" TEXT,
ADD COLUMN     "telefono_oficina_conyuge" TEXT;

-- CreateTable
CREATE TABLE "cat_estado_civil" (
    "id_estado_civil" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_estado_civil_pkey" PRIMARY KEY ("id_estado_civil")
);

-- CreateTable
CREATE TABLE "cat_estado_vivienda" (
    "id_estado_vivienda" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_estado_vivienda_pkey" PRIMARY KEY ("id_estado_vivienda")
);

-- CreateIndex
CREATE UNIQUE INDEX "cat_estado_civil_codigo_key" ON "cat_estado_civil"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_estado_vivienda_codigo_key" ON "cat_estado_vivienda"("codigo");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "fk_cliente_estado_civil" FOREIGN KEY ("id_estado_civil") REFERENCES "cat_estado_civil"("id_estado_civil") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "fk_cliente_estado_vivienda" FOREIGN KEY ("id_estado_vivienda") REFERENCES "cat_estado_vivienda"("id_estado_vivienda") ON DELETE NO ACTION ON UPDATE NO ACTION;
