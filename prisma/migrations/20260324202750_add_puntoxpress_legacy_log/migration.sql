-- CreateTable
CREATE TABLE "puntoxpress_legacy_log" (
    "id" SERIAL NOT NULL,
    "metodo" TEXT,
    "request_body" JSONB NOT NULL,
    "response_body" JSONB,
    "codigo_respuesta" INTEGER,
    "ip" TEXT,
    "duracion_ms" INTEGER,
    "error" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puntoxpress_legacy_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "puntoxpress_legacy_log_fecha_creacion_idx" ON "puntoxpress_legacy_log"("fecha_creacion");

-- CreateIndex
CREATE INDEX "puntoxpress_legacy_log_metodo_idx" ON "puntoxpress_legacy_log"("metodo");
