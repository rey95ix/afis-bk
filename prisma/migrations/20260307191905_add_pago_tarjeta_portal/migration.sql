-- CreateTable
CREATE TABLE "pago_tarjeta_portal" (
    "id_pago_tarjeta" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "id_contrato" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "codigo_retorno" VARCHAR(5) NOT NULL,
    "numero_autorizacion" VARCHAR(50),
    "numero_referencia" VARCHAR(50),
    "terminacion_tarjeta" VARCHAR(10),
    "fecha_transaccion_gw" VARCHAR(30),
    "concepto_pago" VARCHAR(200),
    "exitoso" BOOLEAN NOT NULL DEFAULT false,
    "mensaje_error" VARCHAR(500),
    "facturas_seleccionadas" INTEGER[],
    "ip_cliente" VARCHAR(45),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_tarjeta_portal_pkey" PRIMARY KEY ("id_pago_tarjeta")
);

-- CreateIndex
CREATE INDEX "pago_tarjeta_portal_id_cliente_idx" ON "pago_tarjeta_portal"("id_cliente");

-- CreateIndex
CREATE INDEX "pago_tarjeta_portal_id_contrato_idx" ON "pago_tarjeta_portal"("id_contrato");

-- CreateIndex
CREATE INDEX "pago_tarjeta_portal_numero_autorizacion_idx" ON "pago_tarjeta_portal"("numero_autorizacion");

-- AddForeignKey
ALTER TABLE "pago_tarjeta_portal" ADD CONSTRAINT "fk_pago_tarjeta_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago_tarjeta_portal" ADD CONSTRAINT "fk_pago_tarjeta_contrato" FOREIGN KEY ("id_contrato") REFERENCES "atcContrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;
