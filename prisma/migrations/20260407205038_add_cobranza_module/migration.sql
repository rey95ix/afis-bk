-- CreateEnum
CREATE TYPE "estado_asignacion_cobranza" AS ENUM ('ACTIVA', 'REASIGNADA', 'CERRADA_PAGADA', 'CERRADA_INCOBRABLE');

-- CreateEnum
CREATE TYPE "bucket_mora" AS ENUM ('DIAS_1_30', 'DIAS_31_60', 'DIAS_61_90', 'DIAS_91_MAS');

-- CreateEnum
CREATE TYPE "tipo_nota_cobranza" AS ENUM ('CONTACTO_WHATSAPP', 'LLAMADA_REALIZADA', 'VISITA_TECNICA', 'PROMESA_PAGO', 'OTRO');

-- CreateTable
CREATE TABLE "cobranza_asignacion" (
    "id_asignacion" SERIAL NOT NULL,
    "id_factura_directa" INTEGER NOT NULL,
    "id_ciclo" INTEGER NOT NULL,
    "id_gestor" INTEGER NOT NULL,
    "id_usuario_asignador" INTEGER NOT NULL,
    "estado" "estado_asignacion_cobranza" NOT NULL DEFAULT 'ACTIVA',
    "bucket_inicial" "bucket_mora" NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),
    "motivo_cierre" TEXT,

    CONSTRAINT "cobranza_asignacion_pkey" PRIMARY KEY ("id_asignacion")
);

-- CreateTable
CREATE TABLE "cobranza_nota" (
    "id_nota" SERIAL NOT NULL,
    "id_asignacion" INTEGER NOT NULL,
    "tipo" "tipo_nota_cobranza" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_promesa" TIMESTAMP(3),
    "monto_promesa" DECIMAL(12,2),
    "id_usuario" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobranza_nota_pkey" PRIMARY KEY ("id_nota")
);

-- CreateIndex
CREATE INDEX "cobranza_asignacion_id_factura_directa_idx" ON "cobranza_asignacion"("id_factura_directa");

-- CreateIndex
CREATE INDEX "cobranza_asignacion_id_gestor_estado_idx" ON "cobranza_asignacion"("id_gestor", "estado");

-- CreateIndex
CREATE INDEX "cobranza_asignacion_id_ciclo_idx" ON "cobranza_asignacion"("id_ciclo");

-- CreateIndex
CREATE INDEX "cobranza_asignacion_estado_idx" ON "cobranza_asignacion"("estado");

-- CreateIndex
CREATE INDEX "cobranza_nota_id_asignacion_idx" ON "cobranza_nota"("id_asignacion");

-- CreateIndex
CREATE INDEX "cobranza_nota_fecha_creacion_idx" ON "cobranza_nota"("fecha_creacion");

-- AddForeignKey
ALTER TABLE "cobranza_asignacion" ADD CONSTRAINT "fk_cobranza_asig_factura" FOREIGN KEY ("id_factura_directa") REFERENCES "facturaDirecta"("id_factura_directa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cobranza_asignacion" ADD CONSTRAINT "fk_cobranza_asig_ciclo" FOREIGN KEY ("id_ciclo") REFERENCES "atcCicloFacturacion"("id_ciclo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cobranza_asignacion" ADD CONSTRAINT "fk_cobranza_asig_gestor" FOREIGN KEY ("id_gestor") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cobranza_asignacion" ADD CONSTRAINT "fk_cobranza_asig_asignador" FOREIGN KEY ("id_usuario_asignador") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cobranza_nota" ADD CONSTRAINT "fk_cobranza_nota_asig" FOREIGN KEY ("id_asignacion") REFERENCES "cobranza_asignacion"("id_asignacion") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cobranza_nota" ADD CONSTRAINT "fk_cobranza_nota_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
