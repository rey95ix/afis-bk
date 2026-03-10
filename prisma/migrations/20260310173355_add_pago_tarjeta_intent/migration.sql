-- CreateTable
CREATE TABLE "pago_tarjeta_intent" (
    "id_intent" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "id_contrato" INTEGER NOT NULL,
    "facturas_seleccionadas" INTEGER[],
    "monto_esperado" DECIMAL(12,2) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_cliente" VARCHAR(45),

    CONSTRAINT "pago_tarjeta_intent_pkey" PRIMARY KEY ("id_intent")
);

-- CreateIndex
CREATE UNIQUE INDEX "pago_tarjeta_intent_token_key" ON "pago_tarjeta_intent"("token");

-- CreateIndex
CREATE INDEX "pago_tarjeta_intent_token_idx" ON "pago_tarjeta_intent"("token");

-- CreateIndex
CREATE INDEX "pago_tarjeta_intent_id_cliente_idx" ON "pago_tarjeta_intent"("id_cliente");

-- AddForeignKey
ALTER TABLE "pago_tarjeta_intent" ADD CONSTRAINT "fk_intent_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago_tarjeta_intent" ADD CONSTRAINT "fk_intent_contrato" FOREIGN KEY ("id_contrato") REFERENCES "atcContrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;
