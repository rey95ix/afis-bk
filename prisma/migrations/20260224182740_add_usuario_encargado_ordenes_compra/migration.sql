-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "id_usuario_encargado" INTEGER;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_id_usuario_encargado_fkey" FOREIGN KEY ("id_usuario_encargado") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
