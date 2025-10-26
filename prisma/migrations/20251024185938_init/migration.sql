-- CreateEnum
CREATE TYPE "estado" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateTable
CREATE TABLE "GeneralData" (
    "id_general" SERIAL NOT NULL,
    "nombre_sistema" TEXT NOT NULL,
    "direccion" TEXT,
    "razon" TEXT,
    "nit" TEXT,
    "nrc" TEXT,
    "cod_actividad" TEXT,
    "desc_actividad" TEXT,
    "nombre_comercial" TEXT,
    "contactos" TEXT,
    "correo" TEXT,
    "cod_estable_MH" TEXT,
    "cod_estable" TEXT,
    "cod_punto_venta_MH" TEXT,
    "cod_punto_venta" TEXT,
    "ambiente" TEXT DEFAULT '00',
    "tipo_facturacion" TEXT DEFAULT '01',
    "api_facturacion_dev" TEXT DEFAULT 'https://apitest.dtes.mh.gob.sv/',
    "api_facturacion_prod" TEXT DEFAULT 'https://api.dtes.mh.gob.sv/',
    "public_key" TEXT DEFAULT '',
    "private_key" TEXT DEFAULT '',
    "token_api_fac" TEXT DEFAULT '',
    "version_email" TEXT DEFAULT '1',
    "token_email" TEXT DEFAULT '',
    "sender_email" TEXT DEFAULT '',
    "text_email" TEXT DEFAULT 'Gracias por su preferencia!',
    "domain_email" TEXT DEFAULT '',
    "impuesto" DOUBLE PRECISION DEFAULT 0.13,
    "icono_sistema" TEXT DEFAULT '',
    "icono_factura" TEXT DEFAULT '',
    "url_facebook" TEXT DEFAULT '',
    "perfil_facebook" TEXT DEFAULT '',
    "url_instagram" TEXT DEFAULT '',
    "perfil_instagram" TEXT DEFAULT '',
    "url_pagina_web" TEXT DEFAULT '',
    "url_correo_atencio" TEXT DEFAULT '',
    "url_maps" TEXT DEFAULT '',
    "whatsapp" TEXT DEFAULT '',
    "color_icono" TEXT DEFAULT '',

    CONSTRAINT "GeneralData_pkey" PRIMARY KEY ("id_general")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" SERIAL NOT NULL,
    "usuario" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "id_sucursal" INTEGER,
    "dui" TEXT,
    "foto" TEXT,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_rol" INTEGER NOT NULL,
    "id_tipo_documento" INTEGER,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "departamentos" (
    "id_departamento" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "codigo_iso" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id_departamento")
);

-- CreateTable
CREATE TABLE "municipios" (
    "id_municipio" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "id_departamento" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "municipios_pkey" PRIMARY KEY ("id_municipio")
);

-- CreateTable
CREATE TABLE "sucursales" (
    "id_sucursal" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "complemento" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "cod_estable_MH" TEXT DEFAULT 'M001',
    "cod_estable" TEXT DEFAULT 'M001',
    "cod_punto_venta_MH" TEXT DEFAULT 'P001',
    "cod_punto_venta" TEXT DEFAULT 'P001',
    "id_municipio" INTEGER,
    "id_tipo_establecimiento" INTEGER,
    "icono_factura" TEXT DEFAULT '',
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id_sucursal")
);

-- CreateTable
CREATE TABLE "log" (
    "id" SERIAL NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario" INTEGER,

    CONSTRAINT "log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id_rol" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "facturasBloques" (
    "id_bloque" SERIAL NOT NULL,
    "tira" TEXT NOT NULL,
    "autorizacion" TEXT NOT NULL DEFAULT '',
    "resolucion" TEXT DEFAULT '',
    "desde" INTEGER NOT NULL,
    "hasta" INTEGER NOT NULL,
    "actual" INTEGER NOT NULL,
    "serie" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_tipo_factura" INTEGER NOT NULL DEFAULT 0,
    "id_sucursal" INTEGER,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "facturasBloques_pkey" PRIMARY KEY ("id_bloque")
);

-- CreateTable
CREATE TABLE "facturasTipos" (
    "id_tipo_factura" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "version" INTEGER,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "activo" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "facturasTipos_pkey" PRIMARY KEY ("id_tipo_factura")
);

-- CreateTable
CREATE TABLE "dTEActividadEconomica" (
    "id_actividad" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "dTEActividadEconomica_pkey" PRIMARY KEY ("id_actividad")
);

-- CreateTable
CREATE TABLE "dTETipoEstablecimiento" (
    "id_tipo_establecimiento" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "dTETipoEstablecimiento_pkey" PRIMARY KEY ("id_tipo_establecimiento")
);

-- CreateTable
CREATE TABLE "dTETipoInvalidacion" (
    "id_tipo_invalidacion" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "dTETipoInvalidacion_pkey" PRIMARY KEY ("id_tipo_invalidacion")
);

-- CreateTable
CREATE TABLE "dTETipoContingencia" (
    "id_tipo_contingencia" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "dTETipoContingencia_pkey" PRIMARY KEY ("id_tipo_contingencia")
);

-- CreateTable
CREATE TABLE "dTETipoDocumentoIdentificacion" (
    "id_tipo_documento" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "dTETipoDocumentoIdentificacion_pkey" PRIMARY KEY ("id_tipo_documento")
);

-- CreateTable
CREATE TABLE "dTERetencionIvaMh" (
    "id_dte_retencion_iva_mh" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTERetencionIvaMh_pkey" PRIMARY KEY ("id_dte_retencion_iva_mh")
);

-- CreateTable
CREATE TABLE "dTETipoGeneracionDocumento" (
    "id_dte_tipo_generacion_documento" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETipoGeneracionDocumento_pkey" PRIMARY KEY ("id_dte_tipo_generacion_documento")
);

-- CreateTable
CREATE TABLE "dTETipoServicioMedico" (
    "id_dte_tipo_servicio_medico" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETipoServicioMedico_pkey" PRIMARY KEY ("id_dte_tipo_servicio_medico")
);

-- CreateTable
CREATE TABLE "dTETipoItem" (
    "id_dte_tipo_item" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETipoItem_pkey" PRIMARY KEY ("id_dte_tipo_item")
);

-- CreateTable
CREATE TABLE "dTEUnidadDeMedida" (
    "id_unidad_de_medida" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTEUnidadDeMedida_pkey" PRIMARY KEY ("id_unidad_de_medida")
);

-- CreateTable
CREATE TABLE "dTETributosAplicadosPorItem" (
    "id_tributos_aplicados_por_item" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETributosAplicadosPorItem_pkey" PRIMARY KEY ("id_tributos_aplicados_por_item")
);

-- CreateTable
CREATE TABLE "dTETributosAplicadosPorItemCuerpo" (
    "id_tributos_aplicados_por_item_cuerpo" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETributosAplicadosPorItemCuerpo_pkey" PRIMARY KEY ("id_tributos_aplicados_por_item_cuerpo")
);

-- CreateTable
CREATE TABLE "dTEImpuestosAdValoremAplicadosPorItem" (
    "id_impuestos_ad_valorem_aplicados_por_item" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTEImpuestosAdValoremAplicadosPorItem_pkey" PRIMARY KEY ("id_impuestos_ad_valorem_aplicados_por_item")
);

-- CreateTable
CREATE TABLE "dTECondicionDeLaOperacion" (
    "id_condicion_de_la_operacion" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTECondicionDeLaOperacion_pkey" PRIMARY KEY ("id_condicion_de_la_operacion")
);

-- CreateTable
CREATE TABLE "dTEPlazo" (
    "id_plazo" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTEPlazo_pkey" PRIMARY KEY ("id_plazo")
);

-- CreateTable
CREATE TABLE "dTEFormaPago" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTEFormaPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dTEPais" (
    "id_pais" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTEPais_pkey" PRIMARY KEY ("id_pais")
);

-- CreateTable
CREATE TABLE "dTEOtrosDocumentosAsociados" (
    "id_otros_documentos_asociados" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTEOtrosDocumentosAsociados_pkey" PRIMARY KEY ("id_otros_documentos_asociados")
);

-- CreateTable
CREATE TABLE "dTETiposDeDocumentosEnContingencia" (
    "id_tipos_de_documentos_en_contingencia" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETiposDeDocumentosEnContingencia_pkey" PRIMARY KEY ("id_tipos_de_documentos_en_contingencia")
);

-- CreateTable
CREATE TABLE "dTETituloAQueSeRemiteLosBienes" (
    "id_titulo_a_que_se_remite_los_bienes" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETituloAQueSeRemiteLosBienes_pkey" PRIMARY KEY ("id_titulo_a_que_se_remite_los_bienes")
);

-- CreateTable
CREATE TABLE "dTECategoriaDeBienYServicio" (
    "id_categoria" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTECategoriaDeBienYServicio_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "dTERecintoFiscal" (
    "id_recinto_fiscal" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTERecintoFiscal_pkey" PRIMARY KEY ("id_recinto_fiscal")
);

-- CreateTable
CREATE TABLE "dTERegimen" (
    "id_regimen" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTERegimen_pkey" PRIMARY KEY ("id_regimen")
);

-- CreateTable
CREATE TABLE "dTETipoDePersona" (
    "id_tipoDePersona" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETipoDePersona_pkey" PRIMARY KEY ("id_tipoDePersona")
);

-- CreateTable
CREATE TABLE "dTETransporte" (
    "id_transporte" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTETransporte_pkey" PRIMARY KEY ("id_transporte")
);

-- CreateTable
CREATE TABLE "dTEIncoterms" (
    "id_incoterms" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTEIncoterms_pkey" PRIMARY KEY ("id_incoterms")
);

-- CreateTable
CREATE TABLE "dTEDomicilioFiscal" (
    "id_domicilioFiscal" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "dTEDomicilioFiscal_pkey" PRIMARY KEY ("id_domicilioFiscal")
);

-- CreateIndex
CREATE INDEX "fk_municipio_departamento_id" ON "municipios"("id_departamento");

-- CreateIndex
CREATE INDEX "fk_fatura_bloque_sucursal_id" ON "facturasBloques"("id_sucursal");

-- CreateIndex
CREATE INDEX "fk_fatura_bloque_tipo_id" ON "facturasBloques"("id_tipo_factura");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "fk_usuario_rol" FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "fk_usuario_tipo_documento" FOREIGN KEY ("id_tipo_documento") REFERENCES "dTETipoDocumentoIdentificacion"("id_tipo_documento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "municipios" ADD CONSTRAINT "fk_municipio_departamento" FOREIGN KEY ("id_departamento") REFERENCES "departamentos"("id_departamento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "fk_sucursal_municipio" FOREIGN KEY ("id_municipio") REFERENCES "municipios"("id_municipio") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "fk_sucursal_tipo_establecimiento" FOREIGN KEY ("id_tipo_establecimiento") REFERENCES "dTETipoEstablecimiento"("id_tipo_establecimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "log" ADD CONSTRAINT "log_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturasBloques" ADD CONSTRAINT "fk_fatura_bloque_tipo" FOREIGN KEY ("id_tipo_factura") REFERENCES "facturasTipos"("id_tipo_factura") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturasBloques" ADD CONSTRAINT "fk_fatura_bloque_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;
