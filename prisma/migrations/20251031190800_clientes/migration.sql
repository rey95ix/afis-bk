-- CreateTable
CREATE TABLE "cliente" (
    "id_cliente" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "titular" TEXT NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3) NOT NULL,
    "dui" TEXT NOT NULL,
    "nit" TEXT,
    "empresa_trabajo" TEXT NOT NULL,
    "correo_electronico" TEXT NOT NULL,
    "telefono1" TEXT NOT NULL,
    "telefono2" TEXT,
    "referencia1" TEXT NOT NULL,
    "referencia1_telefono" TEXT NOT NULL,
    "referencia2" TEXT NOT NULL,
    "referencia2_telefono" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "clienteDatosFacturacion" (
    "id_cliente_datos_facturacion" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PERSONA',
    "id_tipo_documento" INTEGER,
    "id_actividad" INTEGER,
    "nombre_empresa" TEXT NOT NULL,
    "nit" TEXT,
    "nrc" TEXT,
    "telefono" TEXT,
    "correo_electronico" TEXT,
    "direccion_facturacion" TEXT,
    "id_municipio" INTEGER,
    "id_departamento" INTEGER,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clienteDatosFacturacion_pkey" PRIMARY KEY ("id_cliente_datos_facturacion")
);

-- CreateTable
CREATE TABLE "clienteDirecciones" (
    "id_cliente_direccion" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "direccion" TEXT NOT NULL,
    "id_colonia" INTEGER,
    "id_municipio" INTEGER NOT NULL,
    "id_departamento" INTEGER NOT NULL,
    "codigo_postal" TEXT,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clienteDirecciones_pkey" PRIMARY KEY ("id_cliente_direccion")
);

-- CreateTable
CREATE TABLE "colonias" (
    "id_colonia" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "id_municipio" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colonias_pkey" PRIMARY KEY ("id_colonia")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliente_dui_key" ON "cliente"("dui");

-- CreateIndex
CREATE INDEX "fk_colonia_municipio_id" ON "colonias"("id_municipio");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "fk_cliente_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDatosFacturacion" ADD CONSTRAINT "fk_cliente_datos_facturacion_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDatosFacturacion" ADD CONSTRAINT "fk_cliente_datos_facturacion_tipo_documento" FOREIGN KEY ("id_tipo_documento") REFERENCES "dTETipoDocumentoIdentificacion"("id_tipo_documento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDatosFacturacion" ADD CONSTRAINT "fk_cliente_datos_facturacion_actividad_economica" FOREIGN KEY ("id_actividad") REFERENCES "dTEActividadEconomica"("id_actividad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDatosFacturacion" ADD CONSTRAINT "fk_cliente_datos_facturacion_municipio" FOREIGN KEY ("id_municipio") REFERENCES "municipios"("id_municipio") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDatosFacturacion" ADD CONSTRAINT "fk_cliente_datos_facturacion_departamento" FOREIGN KEY ("id_departamento") REFERENCES "departamentos"("id_departamento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecciones" ADD CONSTRAINT "fk_cliente_direccion_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecciones" ADD CONSTRAINT "fk_cliente_direccion_colonia" FOREIGN KEY ("id_colonia") REFERENCES "colonias"("id_colonia") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecciones" ADD CONSTRAINT "fk_cliente_direccion_municipio" FOREIGN KEY ("id_municipio") REFERENCES "municipios"("id_municipio") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecciones" ADD CONSTRAINT "fk_cliente_direccion_departamento" FOREIGN KEY ("id_departamento") REFERENCES "departamentos"("id_departamento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "colonias" ADD CONSTRAINT "fk_colonia_municipio" FOREIGN KEY ("id_municipio") REFERENCES "municipios"("id_municipio") ON DELETE NO ACTION ON UPDATE NO ACTION;
