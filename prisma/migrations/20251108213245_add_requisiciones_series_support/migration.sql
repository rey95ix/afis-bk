-- CreateTable
CREATE TABLE "requisiciones_detalle_series" (
    "id_requisicion_detalle_serie" SERIAL NOT NULL,
    "id_requisicion_detalle" INTEGER NOT NULL,
    "id_serie" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requisiciones_detalle_series_pkey" PRIMARY KEY ("id_requisicion_detalle_serie")
);

-- CreateIndex
CREATE INDEX "requisiciones_detalle_series_id_requisicion_detalle_idx" ON "requisiciones_detalle_series"("id_requisicion_detalle");

-- CreateIndex
CREATE INDEX "requisiciones_detalle_series_id_serie_idx" ON "requisiciones_detalle_series"("id_serie");

-- CreateIndex
CREATE UNIQUE INDEX "requisiciones_detalle_series_id_requisicion_detalle_id_seri_key" ON "requisiciones_detalle_series"("id_requisicion_detalle", "id_serie");

-- AddForeignKey
ALTER TABLE "requisiciones_detalle_series" ADD CONSTRAINT "requisiciones_detalle_series_id_requisicion_detalle_fkey" FOREIGN KEY ("id_requisicion_detalle") REFERENCES "requisiciones_detalle"("id_requisicion_detalle") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisiciones_detalle_series" ADD CONSTRAINT "requisiciones_detalle_series_id_serie_fkey" FOREIGN KEY ("id_serie") REFERENCES "inventario_series"("id_serie") ON DELETE RESTRICT ON UPDATE CASCADE;
