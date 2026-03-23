-- CreateTable
CREATE TABLE "atcContratoFirmaToken" (
    "id_token" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "id_contrato" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "ip_firmante" TEXT,
    "user_agent_firmante" TEXT,

    CONSTRAINT "atcContratoFirmaToken_pkey" PRIMARY KEY ("id_token")
);

-- CreateIndex
CREATE UNIQUE INDEX "atcContratoFirmaToken_token_key" ON "atcContratoFirmaToken"("token");

-- CreateIndex
CREATE INDEX "atcContratoFirmaToken_token_idx" ON "atcContratoFirmaToken"("token");

-- CreateIndex
CREATE INDEX "atcContratoFirmaToken_id_contrato_idx" ON "atcContratoFirmaToken"("id_contrato");

-- AddForeignKey
ALTER TABLE "atcContratoFirmaToken" ADD CONSTRAINT "fk_firma_token_contrato" FOREIGN KEY ("id_contrato") REFERENCES "atcContrato"("id_contrato") ON DELETE CASCADE ON UPDATE NO ACTION;
