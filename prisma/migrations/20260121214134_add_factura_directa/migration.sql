-- CreateEnum
CREATE TYPE "tipo_detalle_factura" AS ENUM ('GRAVADO', 'EXENTA', 'NOSUJETO', 'NOGRABADO');

-- CreateEnum
CREATE TYPE "estado_pago_factura" AS ENUM ('PAGADO', 'PENDIENTE', 'PARCIAL');

-- CreateEnum
CREATE TYPE "estado_factura_directa" AS ENUM ('ACTIVO', 'ANULADO');

-- CreateTable
CREATE TABLE "tipoClienteDirecto" (
    "id_tipo_cliente" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipoClienteDirecto_pkey" PRIMARY KEY ("id_tipo_cliente")
);

-- CreateTable
CREATE TABLE "metodosPago" (
    "id_metodo_pago" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metodosPago_pkey" PRIMARY KEY ("id_metodo_pago")
);

-- CreateTable
CREATE TABLE "descuentosDirectos" (
    "id_descuento" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'AMBOS',
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "descuentosDirectos_pkey" PRIMARY KEY ("id_descuento")
);

-- CreateTable
CREATE TABLE "clienteDirecto" (
    "id_cliente_directo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "giro" TEXT,
    "razon_social" TEXT,
    "registro_nrc" TEXT,
    "nit" TEXT,
    "dui" TEXT,
    "id_tipo_documento" INTEGER,
    "id_actividad_economica" INTEGER,
    "id_pais" INTEGER,
    "id_municipio" INTEGER,
    "direccion" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "retencion" BOOLEAN NOT NULL DEFAULT false,
    "id_tipo_cliente" INTEGER,
    "id_sucursal" INTEGER,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clienteDirecto_pkey" PRIMARY KEY ("id_cliente_directo")
);

-- CreateTable
CREATE TABLE "facturaDirecta" (
    "id_factura_directa" SERIAL NOT NULL,
    "numero_factura" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_de_pago" TIMESTAMP(3),
    "cliente_nombre" TEXT,
    "cliente_nrc" TEXT,
    "cliente_nit" TEXT,
    "cliente_direccion" TEXT,
    "cliente_giro" TEXT,
    "cliente_telefono" TEXT,
    "cliente_correo" TEXT,
    "id_cliente_directo" INTEGER,
    "id_tipo_factura" INTEGER NOT NULL,
    "id_bloque" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subTotalVentas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalNoSuj" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalExenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalGravada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalNoGravado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuNoSuj" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuExenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuGravada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva_retenido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva_percibido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "renta_retenido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_letras" VARCHAR(300),
    "efectivo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tarjeta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cheque" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transferencia" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "id_metodo_pago" INTEGER,
    "condicion_operacion" INTEGER NOT NULL DEFAULT 1,
    "flete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "seguro" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "recintoFiscal" VARCHAR(10),
    "regimen" VARCHAR(10),
    "codIncoterms" VARCHAR(10),
    "descIncoterms" VARCHAR(200),
    "tipoItemExpor" INTEGER,
    "id_factura_original" INTEGER,
    "codigo_generacion" CHAR(36),
    "numero_control" VARCHAR(31),
    "dte_json" TEXT,
    "dte_firmado" TEXT,
    "sello_recepcion" VARCHAR(50),
    "fecha_recepcion_mh" TIMESTAMP(3),
    "codigo_msg_mh" VARCHAR(10),
    "descripcion_msg_mh" VARCHAR(500),
    "observaciones_mh" TEXT,
    "estado_dte" "estado_dte" NOT NULL DEFAULT 'BORRADOR',
    "intentos_dte" INTEGER NOT NULL DEFAULT 0,
    "ultimo_error_dte" TEXT,
    "estado" "estado_factura_directa" NOT NULL DEFAULT 'ACTIVO',
    "estado_pago" "estado_pago_factura" NOT NULL DEFAULT 'PAGADO',
    "observaciones" TEXT,
    "id_sucursal" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturaDirecta_pkey" PRIMARY KEY ("id_factura_directa")
);

-- CreateTable
CREATE TABLE "facturaDirectaDetalle" (
    "id_detalle" SERIAL NOT NULL,
    "id_factura_directa" INTEGER NOT NULL,
    "num_item" INTEGER NOT NULL,
    "codigo" VARCHAR(50),
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "nota" TEXT,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "uni_medida" INTEGER NOT NULL DEFAULT 99,
    "precio_unitario" DECIMAL(12,4) NOT NULL,
    "precio_sin_iva" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "precio_con_iva" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tipo_detalle" "tipo_detalle_factura" NOT NULL DEFAULT 'GRAVADO',
    "venta_gravada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "venta_exenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "venta_nosujeto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "venta_nograbada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "id_catalogo" INTEGER,
    "id_descuento" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturaDirectaDetalle_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateIndex
CREATE UNIQUE INDEX "metodosPago_codigo_key" ON "metodosPago"("codigo");

-- CreateIndex
CREATE INDEX "clienteDirecto_nit_idx" ON "clienteDirecto"("nit");

-- CreateIndex
CREATE INDEX "clienteDirecto_dui_idx" ON "clienteDirecto"("dui");

-- CreateIndex
CREATE INDEX "clienteDirecto_registro_nrc_idx" ON "clienteDirecto"("registro_nrc");

-- CreateIndex
CREATE INDEX "clienteDirecto_id_sucursal_idx" ON "clienteDirecto"("id_sucursal");

-- CreateIndex
CREATE INDEX "clienteDirecto_nombre_idx" ON "clienteDirecto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "facturaDirecta_codigo_generacion_key" ON "facturaDirecta"("codigo_generacion");

-- CreateIndex
CREATE UNIQUE INDEX "facturaDirecta_numero_control_key" ON "facturaDirecta"("numero_control");

-- CreateIndex
CREATE INDEX "facturaDirecta_numero_factura_idx" ON "facturaDirecta"("numero_factura");

-- CreateIndex
CREATE INDEX "facturaDirecta_id_cliente_directo_idx" ON "facturaDirecta"("id_cliente_directo");

-- CreateIndex
CREATE INDEX "facturaDirecta_id_tipo_factura_idx" ON "facturaDirecta"("id_tipo_factura");

-- CreateIndex
CREATE INDEX "facturaDirecta_id_sucursal_idx" ON "facturaDirecta"("id_sucursal");

-- CreateIndex
CREATE INDEX "facturaDirecta_estado_dte_idx" ON "facturaDirecta"("estado_dte");

-- CreateIndex
CREATE INDEX "facturaDirecta_fecha_creacion_idx" ON "facturaDirecta"("fecha_creacion");

-- CreateIndex
CREATE INDEX "facturaDirecta_codigo_generacion_idx" ON "facturaDirecta"("codigo_generacion");

-- CreateIndex
CREATE INDEX "facturaDirecta_cliente_nit_idx" ON "facturaDirecta"("cliente_nit");

-- CreateIndex
CREATE INDEX "facturaDirectaDetalle_id_factura_directa_idx" ON "facturaDirectaDetalle"("id_factura_directa");

-- CreateIndex
CREATE INDEX "facturaDirectaDetalle_id_catalogo_idx" ON "facturaDirectaDetalle"("id_catalogo");

-- AddForeignKey
ALTER TABLE "clienteDirecto" ADD CONSTRAINT "fk_cliente_directo_tipo_documento" FOREIGN KEY ("id_tipo_documento") REFERENCES "dTETipoDocumentoIdentificacion"("id_tipo_documento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecto" ADD CONSTRAINT "fk_cliente_directo_actividad_economica" FOREIGN KEY ("id_actividad_economica") REFERENCES "dTEActividadEconomica"("id_actividad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecto" ADD CONSTRAINT "fk_cliente_directo_pais" FOREIGN KEY ("id_pais") REFERENCES "dTEPais"("id_pais") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecto" ADD CONSTRAINT "fk_cliente_directo_municipio" FOREIGN KEY ("id_municipio") REFERENCES "municipios"("id_municipio") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecto" ADD CONSTRAINT "fk_cliente_directo_tipo" FOREIGN KEY ("id_tipo_cliente") REFERENCES "tipoClienteDirecto"("id_tipo_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteDirecto" ADD CONSTRAINT "fk_cliente_directo_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_cliente" FOREIGN KEY ("id_cliente_directo") REFERENCES "clienteDirecto"("id_cliente_directo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_tipo" FOREIGN KEY ("id_tipo_factura") REFERENCES "facturasTipos"("id_tipo_factura") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_bloque" FOREIGN KEY ("id_bloque") REFERENCES "facturasBloques"("id_bloque") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_metodo_pago" FOREIGN KEY ("id_metodo_pago") REFERENCES "metodosPago"("id_metodo_pago") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_original" FOREIGN KEY ("id_factura_original") REFERENCES "facturaDirecta"("id_factura_directa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirecta" ADD CONSTRAINT "fk_factura_directa_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirectaDetalle" ADD CONSTRAINT "fk_factura_directa_detalle" FOREIGN KEY ("id_factura_directa") REFERENCES "facturaDirecta"("id_factura_directa") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facturaDirectaDetalle" ADD CONSTRAINT "fk_factura_directa_detalle_catalogo" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE NO ACTION ON UPDATE NO ACTION;
-- AlterTable
ALTER TABLE "catalogo" ADD COLUMN     "id_dte_tipo_item" INTEGER;

-- AddForeignKey
ALTER TABLE "catalogo" ADD CONSTRAINT "fk_catalogo_dte_tipo_item" FOREIGN KEY ("id_dte_tipo_item") REFERENCES "dTETipoItem"("id_dte_tipo_item") ON DELETE NO ACTION ON UPDATE NO ACTION;
