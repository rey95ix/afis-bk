-- CreateTable
CREATE TABLE "estantes" (
    "id_estante" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "id_bodega" INTEGER NOT NULL,

    CONSTRAINT "estantes_pkey" PRIMARY KEY ("id_estante")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id_proveedor" SERIAL NOT NULL,
    "nombre_razon_social" TEXT DEFAULT '',
    "nombre_comercial" TEXT DEFAULT '',
    "registro_nrc" TEXT DEFAULT '',
    "numero_documento" TEXT DEFAULT '',
    "id_tipo_documento" INTEGER,
    "id_municipio" INTEGER DEFAULT 0,
    "direccion" TEXT DEFAULT '',
    "telefono" TEXT DEFAULT '',
    "correo" TEXT DEFAULT '',
    "dias_credito" TEXT DEFAULT '0',
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nombre_contac_1" TEXT DEFAULT '',
    "telefono_contac_1" TEXT DEFAULT '',
    "correo_contac_1" TEXT DEFAULT '',
    "nombre_contac_2" TEXT DEFAULT '',
    "telefono_contac_2" TEXT DEFAULT '',
    "correo_contac_2" TEXT DEFAULT '',
    "id_actividad_economica" INTEGER,
    "id_usuario" INTEGER NOT NULL,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "Compras" (
    "id_compras" SERIAL NOT NULL,
    "numero_factura" TEXT NOT NULL DEFAULT '0',
    "numero_quedan" TEXT DEFAULT '0',
    "detalle" TEXT,
    "nombre_proveedor" TEXT DEFAULT '',
    "dui_proveedor" TEXT DEFAULT '',
    "no_cheque" TEXT DEFAULT '',
    "id_proveedor" INTEGER,
    "id_forma_pago" INTEGER,
    "id_usuario" INTEGER NOT NULL,
    "dias_credito" INTEGER DEFAULT 0,
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "descuento" DOUBLE PRECISION DEFAULT 0,
    "cesc" DOUBLE PRECISION DEFAULT 0,
    "fovial" DOUBLE PRECISION DEFAULT 0,
    "cotrans" DOUBLE PRECISION DEFAULT 0,
    "iva" DOUBLE PRECISION DEFAULT 0,
    "iva_retenido" DOUBLE PRECISION DEFAULT 0,
    "iva_percivido" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "id_sucursal" INTEGER,
    "id_bodega" INTEGER,
    "id_tipo_factura" INTEGER DEFAULT 2,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_factura" TIMESTAMP(3),
    "fecha_de_pago" TIMESTAMP(3),
    "is_dte" BOOLEAN NOT NULL DEFAULT false,
    "json_dte" TEXT,
    "numeroControl" TEXT DEFAULT '',
    "codigoGeneracion" TEXT DEFAULT '',

    CONSTRAINT "Compras_pkey" PRIMARY KEY ("id_compras")
);

-- CreateTable
CREATE TABLE "comprasDetalle" (
    "id_compras_detalle" SERIAL NOT NULL,
    "id_compras" INTEGER NOT NULL,
    "id_catalogo" INTEGER,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "costo_unitario" DOUBLE PRECISION DEFAULT 0,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidad_inventario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "descuento_porcentaje" DOUBLE PRECISION DEFAULT 0,
    "descuento_monto" DOUBLE PRECISION DEFAULT 0,
    "iva" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprasDetalle_pkey" PRIMARY KEY ("id_compras_detalle")
);

-- CreateTable
CREATE TABLE "inventario" (
    "id_inventario" SERIAL NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "id_compras_detalle" INTEGER,
    "id_bodega" INTEGER,
    "id_estante" INTEGER,
    "costo_unitario" DOUBLE PRECISION DEFAULT 0,
    "existencia" INTEGER DEFAULT 0,
    "costo_total" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id_inventario")
);

-- CreateTable
CREATE TABLE "kardex" (
    "id_kardex" SERIAL NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "id_compras_detalle" INTEGER,
    "tipo_movimiento" INTEGER NOT NULL DEFAULT 1,
    "id_factura" INTEGER,
    "descripcion" TEXT,
    "costo" DOUBLE PRECISION DEFAULT 0,
    "cantidad" DOUBLE PRECISION DEFAULT 0,
    "subtotal" DOUBLE PRECISION DEFAULT 0,
    "costo_promedio" DOUBLE PRECISION DEFAULT 0,
    "inventario" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION DEFAULT 0,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kardex_pkey" PRIMARY KEY ("id_kardex")
);

-- CreateIndex
CREATE INDEX "fk_compras_tipo_factura_id" ON "Compras"("id_tipo_factura");

-- CreateIndex
CREATE INDEX "fk_compras_sucursal_id" ON "Compras"("id_sucursal");

-- CreateIndex
CREATE INDEX "fk_compras_bodega_id" ON "Compras"("id_bodega");

-- CreateIndex
CREATE INDEX "fk_compra_usuario_id" ON "Compras"("id_usuario");

-- CreateIndex
CREATE INDEX "fk_compras_proveedor_id" ON "Compras"("id_proveedor");

-- CreateIndex
CREATE INDEX "fk_compra_detalle_id" ON "comprasDetalle"("id_compras");

-- CreateIndex
CREATE INDEX "fk_compras_detalle_catalogo_id" ON "comprasDetalle"("id_catalogo");

-- CreateIndex
CREATE INDEX "fk_inventario_bodega_id" ON "inventario"("id_bodega");

-- CreateIndex
CREATE INDEX "fk_inventario_catalogo_id" ON "inventario"("id_catalogo");

-- CreateIndex
CREATE INDEX "fk_inventario_detalle_id" ON "inventario"("id_compras_detalle");

-- CreateIndex
CREATE INDEX "fk_kardex_catalogo_id" ON "kardex"("id_catalogo");

-- CreateIndex
CREATE INDEX "fk_kardex_detalle_id" ON "kardex"("id_compras_detalle");

-- AddForeignKey
ALTER TABLE "estantes" ADD CONSTRAINT "estantes_id_bodega_fkey" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "fk_proveedor_tipo_documento" FOREIGN KEY ("id_tipo_documento") REFERENCES "dTETipoDocumentoIdentificacion"("id_tipo_documento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "fk_proveedor_municipio" FOREIGN KEY ("id_municipio") REFERENCES "municipios"("id_municipio") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "fk_proveedor_actividad_economica" FOREIGN KEY ("id_actividad_economica") REFERENCES "dTEActividadEconomica"("id_actividad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "fk_proveedor_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Compras" ADD CONSTRAINT "fk_compras_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Compras" ADD CONSTRAINT "fk_compras_metodo_pago" FOREIGN KEY ("id_forma_pago") REFERENCES "dTEFormaPago"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Compras" ADD CONSTRAINT "fk_compra_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Compras" ADD CONSTRAINT "fk_compras_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Compras" ADD CONSTRAINT "fk_compras_bodega" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Compras" ADD CONSTRAINT "fk_compras_tipo_factura" FOREIGN KEY ("id_tipo_factura") REFERENCES "facturasTipos"("id_tipo_factura") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprasDetalle" ADD CONSTRAINT "fk_compra_detalle" FOREIGN KEY ("id_compras") REFERENCES "Compras"("id_compras") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprasDetalle" ADD CONSTRAINT "fk_compras_detalle_catalogo" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "fk_inventario_catalogo" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "fk_inventario_detalle" FOREIGN KEY ("id_compras_detalle") REFERENCES "comprasDetalle"("id_compras_detalle") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "fk_inventario_bodega" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "fk_inventario_estante" FOREIGN KEY ("id_estante") REFERENCES "estantes"("id_estante") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kardex" ADD CONSTRAINT "fk_kardex_catalogo" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kardex" ADD CONSTRAINT "fk_kardex_detalle" FOREIGN KEY ("id_compras_detalle") REFERENCES "comprasDetalle"("id_compras_detalle") ON DELETE NO ACTION ON UPDATE NO ACTION;
