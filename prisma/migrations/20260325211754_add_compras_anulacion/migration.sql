-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "anulada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fecha_anulacion" TIMESTAMP(3),
ADD COLUMN     "id_usuario_anula" INTEGER,
ADD COLUMN     "motivo_anulacion" TEXT;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "fk_compra_usuario_anula" FOREIGN KEY ("id_usuario_anula") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
