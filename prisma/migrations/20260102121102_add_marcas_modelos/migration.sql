-- AlterTable
ALTER TABLE "catalogo" ADD COLUMN     "id_marca" INTEGER,
ADD COLUMN     "id_modelo" INTEGER;

-- CreateTable
CREATE TABLE "marcas" (
    "id_marca" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "logo" TEXT,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marcas_pkey" PRIMARY KEY ("id_marca")
);

-- CreateTable
CREATE TABLE "modelos" (
    "id_modelo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "id_marca" INTEGER NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_pkey" PRIMARY KEY ("id_modelo")
);

-- CreateIndex
CREATE INDEX "modelos_id_marca_idx" ON "modelos"("id_marca");

-- AddForeignKey
ALTER TABLE "modelos" ADD CONSTRAINT "fk_modelo_marca" FOREIGN KEY ("id_marca") REFERENCES "marcas"("id_marca") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "catalogo" ADD CONSTRAINT "fk_catalogo_marca" FOREIGN KEY ("id_marca") REFERENCES "marcas"("id_marca") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "catalogo" ADD CONSTRAINT "fk_catalogo_modelo" FOREIGN KEY ("id_modelo") REFERENCES "modelos"("id_modelo") ON DELETE NO ACTION ON UPDATE NO ACTION;
-- AlterEnum
ALTER TYPE "tipo_movimiento" ADD VALUE 'ENTRADA_CARGA_EXCEL';
