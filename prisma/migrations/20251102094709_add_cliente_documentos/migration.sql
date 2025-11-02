-- CreateTable
CREATE TABLE "clienteDocumentos" (
    "id_cliente_documento" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "ruta_archivo" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clienteDocumentos_pkey" PRIMARY KEY ("id_cliente_documento")
);

-- CreateIndex
CREATE INDEX "clienteDocumentos_id_cliente_idx" ON "clienteDocumentos"("id_cliente");

-- AddForeignKey
ALTER TABLE "clienteDocumentos" ADD CONSTRAINT "fk_cliente_documentos_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE CASCADE ON UPDATE NO ACTION;
