-- AlterTable
ALTER TABLE "clienteDirecciones" ADD COLUMN     "usar_para_facturacion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usar_para_instalacion" BOOLEAN NOT NULL DEFAULT false;
-- Seed de colonias extraídas del sistema viejo
-- Total: 129 colonias

INSERT INTO "colonias" (id_colonia, nombre, codigo, id_municipio, estado) VALUES
  (3, 'Vista Bella 1', NULL, 23, 'ACTIVO'::"estado"),
  (4, 'Vista Bella 2', NULL, 23, 'ACTIVO'::"estado"),
  (10, 'Col. Cuscatlán', NULL, 23, 'ACTIVO'::"estado"),
  (11, 'Col. Ana Lili', NULL, 23, 'ACTIVO'::"estado"),
  (12, 'Col. El Carmen, AP', NULL, 23, 'ACTIVO'::"estado"),
  (13, 'Col. Santa Fe', NULL, 23, 'ACTIVO'::"estado"),
  (14, 'Reparto Apopa', NULL, 23, 'ACTIVO'::"estado"),
  (15, 'Urb. Lourdes', NULL, 23, 'ACTIVO'::"estado"),
  (16, 'San Sebastian 2', NULL, 23, 'ACTIVO'::"estado"),
  (17, 'Las Margaritas', NULL, 23, 'ACTIVO'::"estado"),
  (18, 'Jardines de San Sebastian', NULL, 23, 'ACTIVO'::"estado"),
  (19, 'Centro de Apopa', NULL, 23, 'ACTIVO'::"estado"),
  (20, 'Col. El Cocal', NULL, 23, 'ACTIVO'::"estado"),
  (21, 'Madre Tierra 1', NULL, 23, 'ACTIVO'::"estado"),
  (22, 'Col. Ermita 1', NULL, 23, 'ACTIVO'::"estado"),
  (23, 'Res. Santa Catarina', NULL, 23, 'ACTIVO'::"estado"),
  (24, 'Col.Guadalupe', NULL, 23, 'ACTIVO'::"estado"),
  (25, 'Com. El Plan', NULL, 23, 'ACTIVO'::"estado"),
  (26, 'Condominios El Rosal', NULL, 23, 'ACTIVO'::"estado"),
  (27, 'Lotificacion Insinca', NULL, 23, 'ACTIVO'::"estado"),
  (28, 'Col. Santa Maria', NULL, 23, 'ACTIVO'::"estado"),
  (30, 'Colonia San Jose', NULL, 23, 'ACTIVO'::"estado"),
  (31, 'Colonia Sarita', NULL, 23, 'ACTIVO'::"estado"),
  (32, 'Cond. San Marino', NULL, 23, 'ACTIVO'::"estado"),
  (33, 'Barrio El Transito', NULL, 23, 'ACTIVO'::"estado"),
  (34, 'Cruz Roja', NULL, 23, 'ACTIVO'::"estado"),
  (36, 'Canton Calle Real', NULL, 25, 'ACTIVO'::"estado"),
  (37, 'Quinta 11 de Febrero', NULL, 23, 'ACTIVO'::"estado"),
  (38, 'Colinas del Norte 1', NULL, 25, 'ACTIVO'::"estado"),
  (39, 'Colinas del Norte 2', NULL, 25, 'ACTIVO'::"estado"),
  (40, 'Barrio San Miguelito', NULL, 25, 'ACTIVO'::"estado"),
  (41, 'Col El Salvador', NULL, 23, 'ACTIVO'::"estado"),
  (42, 'Colinas del Norte 3', NULL, 25, 'ACTIVO'::"estado"),
  (43, 'Maria Elena', NULL, 23, 'ACTIVO'::"estado"),
  (44, 'Colonia Layco', NULL, 25, 'ACTIVO'::"estado"),
  (45, 'Col San Luis', NULL, 25, 'ACTIVO'::"estado"),
  (47, 'Lot. San Nicolas', NULL, 23, 'ACTIVO'::"estado"),
  (49, 'Santa Teresa de las Flores', NULL, 23, 'ACTIVO'::"estado"),
  (51, 'Lotificacion San Jose', NULL, 25, 'ACTIVO'::"estado"),
  (53, 'Lotificacion Los Conacastes', NULL, 25, 'ACTIVO'::"estado"),
  (55, 'Residencial Cumbres de la Campina', NULL, 25, 'ACTIVO'::"estado"),
  (57, 'Jardines de San Sebastian', NULL, 25, 'ACTIVO'::"estado"),
  (58, 'Col. Ermita 2', NULL, 23, 'ACTIVO'::"estado"),
  (60, 'Villa Delgado', NULL, 25, 'ACTIVO'::"estado"),
  (62, 'Col. Canjura', NULL, 23, 'ACTIVO'::"estado"),
  (64, 'Residencial Las Palmeras', NULL, 23, 'ACTIVO'::"estado"),
  (66, 'Col. Jardines de Fatima', NULL, 25, 'ACTIVO'::"estado"),
  (68, 'Col. Atlacat', NULL, 25, 'ACTIVO'::"estado"),
  (70, 'Col. San Emigdio', NULL, 23, 'ACTIVO'::"estado"),
  (71, 'Res. Continental', NULL, 23, 'ACTIVO'::"estado"),
  (73, 'Col. Santa Marta', NULL, 23, 'ACTIVO'::"estado"),
  (74, 'Col. Flor Amarilla', NULL, 26, 'ACTIVO'::"estado"),
  (76, 'Col. Escalon', NULL, 25, 'ACTIVO'::"estado"),
  (78, 'Canton Milingo', NULL, 25, 'ACTIVO'::"estado"),
  (80, 'Lot. San Jose ST', NULL, 26, 'ACTIVO'::"estado"),
  (82, 'Col. San Jose ST', NULL, 26, 'ACTIVO'::"estado"),
  (84, 'Ciudad Obrera', NULL, 23, 'ACTIVO'::"estado"),
  (86, 'Canton Joya Galana', NULL, 23, 'ACTIVO'::"estado"),
  (88, 'Ciudad Delgado', NULL, 25, 'ACTIVO'::"estado"),
  (90, 'La Ponderosa', NULL, 23, 'ACTIVO'::"estado"),
  (92, 'Montefrio ST', NULL, 26, 'ACTIVO'::"estado"),
  (94, 'Lot. Maria Teresa ST', NULL, 26, 'ACTIVO'::"estado"),
  (96, 'Com. El progreso', NULL, 26, 'ACTIVO'::"estado"),
  (97, 'Lot. Paraiso Pasion', NULL, 26, 'ACTIVO'::"estado"),
  (99, 'Anexo de San Jose', NULL, 26, 'ACTIVO'::"estado"),
  (101, 'Colonia San Benito', NULL, 25, 'ACTIVO'::"estado"),
  (103, 'Centro de Santo Tomas', NULL, 26, 'ACTIVO'::"estado"),
  (105, 'Col El Oasis', NULL, 26, 'ACTIVO'::"estado"),
  (107, 'Col. Rosa Maria', NULL, 26, 'ACTIVO'::"estado"),
  (109, 'Col. Las Mercedes ST', NULL, 26, 'ACTIVO'::"estado"),
  (111, 'Col. Mercedes 1', NULL, 23, 'ACTIVO'::"estado"),
  (113, 'Col.  Las Virginias ST', NULL, 26, 'ACTIVO'::"estado"),
  (114, 'Lot. Las Nubes', NULL, 26, 'ACTIVO'::"estado"),
  (115, 'Col San Jose 2 ST', NULL, 26, 'ACTIVO'::"estado"),
  (116, 'Col. Guadalupe ST', NULL, 26, 'ACTIVO'::"estado"),
  (117, 'Col. San Jose 2 (El Charco) ST', NULL, 26, 'ACTIVO'::"estado"),
  (118, 'Col. San Jose 2 (El Chaco) ST', NULL, 26, 'ACTIVO'::"estado"),
  (119, 'Lot. Nueva Jerusalen ST', NULL, 26, 'ACTIVO'::"estado"),
  (121, 'Aguilares', NULL, 22, 'ACTIVO'::"estado"),
  (123, 'Col. La Rabida', NULL, 25, 'ACTIVO'::"estado"),
  (125, 'Col. Jiltepec', NULL, 26, 'ACTIVO'::"estado"),
  (127, 'Col. El carmen ST', NULL, 26, 'ACTIVO'::"estado"),
  (129, 'Col. San Jose de las flores', NULL, 23, 'ACTIVO'::"estado"),
  (131, 'Col. Retana', NULL, 26, 'ACTIVO'::"estado"),
  (133, 'Lot. Chaltepe', NULL, 26, 'ACTIVO'::"estado"),
  (135, 'Col. Caña Brava', NULL, 26, 'ACTIVO'::"estado"),
  (137, 'Reparto Bolivar', NULL, 26, 'ACTIVO'::"estado"),
  (139, 'Col. Pensilvania', NULL, 26, 'ACTIVO'::"estado"),
  (141, 'Colonia 3 de mayo', NULL, 26, 'ACTIVO'::"estado"),
  (143, 'Comunidad el MAIS', NULL, 24, 'ACTIVO'::"estado"),
  (145, 'Res. Altos de Belen', NULL, 23, 'ACTIVO'::"estado"),
  (147, 'Cantón Santa Bárbara GZ', NULL, 22, 'ACTIVO'::"estado"),
  (149, 'Colonia Alcaine', NULL, 26, 'ACTIVO'::"estado"),
  (151, 'Col. Las Campanitas', NULL, 26, 'ACTIVO'::"estado"),
  (153, 'El Chaco', NULL, 26, 'ACTIVO'::"estado"),
  (155, 'Col. El Carmen GZ', NULL, 22, 'ACTIVO'::"estado"),
  (157, 'Colonia Santa Leonor', NULL, 26, 'ACTIVO'::"estado"),
  (159, 'Cantón El Carmen GZ', NULL, 22, 'ACTIVO'::"estado"),
  (161, 'Colonia Marabu', NULL, 26, 'ACTIVO'::"estado"),
  (163, 'EL CARMEN SM', NULL, 26, 'ACTIVO'::"estado"),
  (165, 'SANTA MARIA SM', NULL, 26, 'ACTIVO'::"estado"),
  (167, 'Col. Abrego SM', NULL, 26, 'ACTIVO'::"estado"),
  (169, 'Las Hadas', NULL, 26, 'ACTIVO'::"estado"),
  (171, 'Colonia Santa Barbarita 2 GZ', NULL, 22, 'ACTIVO'::"estado"),
  (173, 'Ofibodegas Apopa', NULL, 23, 'ACTIVO'::"estado"),
  (175, 'Las Marias ST', NULL, 26, 'ACTIVO'::"estado"),
  (177, 'Colonia Las Lomas GZ', NULL, 22, 'ACTIVO'::"estado"),
  (179, 'Colonia El Rodeo GZ', NULL, 22, 'ACTIVO'::"estado"),
  (181, 'Colonia Los Delfines GZ', NULL, 22, 'ACTIVO'::"estado"),
  (183, 'La Presa STX', NULL, 26, 'ACTIVO'::"estado"),
  (185, 'Caserío Sitio de Jesus GZ', NULL, 22, 'ACTIVO'::"estado"),
  (187, 'San Jerónimo GZ', NULL, 22, 'ACTIVO'::"estado"),
  (189, 'Colonia Dolores ST', NULL, 26, 'ACTIVO'::"estado"),
  (191, 'La Bolsa GZ', NULL, 22, 'ACTIVO'::"estado"),
  (193, 'Santo Domingo GZ', NULL, 22, 'ACTIVO'::"estado"),
  (195, 'Col. Cipres 2 ST', NULL, 26, 'ACTIVO'::"estado"),
  (197, 'Col. Lomas del Edén ST', NULL, 26, 'ACTIVO'::"estado"),
  (199, 'Col. Quintas de Santa Elena', NULL, 22, 'ACTIVO'::"estado"),
  (201, 'Caserio Palmira', NULL, 22, 'ACTIVO'::"estado"),
  (203, 'Col. Quinta Guadalupe', NULL, 26, 'ACTIVO'::"estado"),
  (205, 'San Luis', NULL, 26, 'ACTIVO'::"estado"),
  (206, 'el transito', NULL, 25, 'ACTIVO'::"estado"),
  (207, 'Col. San Francisco ST', NULL, 26, 'ACTIVO'::"estado"),
  (208, 'Comunidad San Carlos', NULL, 25, 'ACTIVO'::"estado"),
  (209, 'Com. Bendicion de Dios (Cusca)', NULL, 25, 'ACTIVO'::"estado"),
  (210, 'Col. San Juan (cusca)', NULL, 25, 'ACTIVO'::"estado"),
  (211, 'las colinas  ST', NULL, 26, 'ACTIVO'::"estado"),
  (212, 'Col. colinas', NULL, 26, 'ACTIVO'::"estado"),
  (213, 'Caserio el Tule (Cusca)', NULL, 25, 'ACTIVO'::"estado");

-- Actualizar secuencia de id_colonia
SELECT setval('colonias_id_colonia_seq', (SELECT MAX(id_colonia) FROM colonias));

-- CreateEnum
CREATE TYPE "estadoContrato" AS ENUM ('PENDIENTE_INSTALACION', 'INSTALADO_ACTIVO', 'SUSPENDIDO', 'SUSPENDIDO_TEMPORAL', 'VELOCIDAD_REDUCIDA', 'EN_MORA', 'BAJA_DEFINITIVA', 'BAJA_CAMBIO_TITULAR', 'CANCELADO');

-- CreateTable
CREATE TABLE "atcTipoServicio" (
    "id_tipo_servicio" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atcTipoServicio_pkey" PRIMARY KEY ("id_tipo_servicio")
);

-- CreateTable
CREATE TABLE "atcTipoPlan" (
    "id_tipo_plan" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "id_tipo_servicio" INTEGER NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atcTipoPlan_pkey" PRIMARY KEY ("id_tipo_plan")
);

-- CreateTable
CREATE TABLE "atcPlan" (
    "id_plan" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "id_tipo_plan" INTEGER NOT NULL,
    "meses_contrato" INTEGER NOT NULL DEFAULT 12,
    "velocidad_bajada" INTEGER,
    "velocidad_subida" INTEGER,
    "aplica_iva" BOOLEAN NOT NULL DEFAULT true,
    "aplica_cesc" BOOLEAN NOT NULL DEFAULT false,
    "porcentaje_iva" DECIMAL(5,2) NOT NULL DEFAULT 13.00,
    "fecha_inicio_vigencia" TIMESTAMP(3),
    "fecha_fin_vigencia" TIMESTAMP(3),
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atcPlan_pkey" PRIMARY KEY ("id_plan")
);

-- CreateTable
CREATE TABLE "atcCicloFacturacion" (
    "id_ciclo" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "dia_corte" INTEGER NOT NULL,
    "dia_vencimiento" INTEGER NOT NULL,
    "periodo_inicio" INTEGER NOT NULL,
    "periodo_fin" INTEGER NOT NULL,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atcCicloFacturacion_pkey" PRIMARY KEY ("id_ciclo")
);

-- CreateTable
CREATE TABLE "atcContrato" (
    "id_contrato" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "id_plan" INTEGER NOT NULL,
    "id_ciclo" INTEGER NOT NULL,
    "id_direccion_servicio" INTEGER NOT NULL,
    "id_orden_trabajo" INTEGER,
    "fecha_venta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_instalacion" TIMESTAMP(3),
    "fecha_inicio_contrato" TIMESTAMP(3),
    "fecha_fin_contrato" TIMESTAMP(3),
    "meses_contrato" INTEGER NOT NULL DEFAULT 12,
    "estado" "estadoContrato" NOT NULL DEFAULT 'PENDIENTE_INSTALACION',
    "id_usuario_creador" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atcContrato_pkey" PRIMARY KEY ("id_contrato")
);

-- CreateTable
CREATE TABLE "atcContratoInstalacion" (
    "id_instalacion" SERIAL NOT NULL,
    "id_contrato" INTEGER NOT NULL,
    "wifi_nombre" TEXT,
    "wifi_password" TEXT,
    "potencia_onu" TEXT,
    "mac_onu" TEXT,
    "numero_serie_onu" TEXT,
    "fecha_instalacion" TIMESTAMP(3),
    "instalado" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "tecnicos_instalacion" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atcContratoInstalacion_pkey" PRIMARY KEY ("id_instalacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "atcTipoServicio_codigo_key" ON "atcTipoServicio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "atcTipoPlan_codigo_key" ON "atcTipoPlan"("codigo");

-- CreateIndex
CREATE INDEX "atcTipoPlan_id_tipo_servicio_idx" ON "atcTipoPlan"("id_tipo_servicio");

-- CreateIndex
CREATE INDEX "atcPlan_id_tipo_plan_idx" ON "atcPlan"("id_tipo_plan");

-- CreateIndex
CREATE INDEX "atcPlan_estado_idx" ON "atcPlan"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "atcContrato_codigo_key" ON "atcContrato"("codigo");

-- CreateIndex
CREATE INDEX "atcContrato_id_cliente_idx" ON "atcContrato"("id_cliente");

-- CreateIndex
CREATE INDEX "atcContrato_id_plan_idx" ON "atcContrato"("id_plan");

-- CreateIndex
CREATE INDEX "atcContrato_id_ciclo_idx" ON "atcContrato"("id_ciclo");

-- CreateIndex
CREATE INDEX "atcContrato_estado_idx" ON "atcContrato"("estado");

-- CreateIndex
CREATE INDEX "atcContrato_fecha_venta_idx" ON "atcContrato"("fecha_venta");

-- CreateIndex
CREATE INDEX "atcContrato_id_orden_trabajo_idx" ON "atcContrato"("id_orden_trabajo");

-- CreateIndex
CREATE UNIQUE INDEX "atcContratoInstalacion_id_contrato_key" ON "atcContratoInstalacion"("id_contrato");

-- CreateIndex
CREATE INDEX "atcContratoInstalacion_id_contrato_idx" ON "atcContratoInstalacion"("id_contrato");

-- AddForeignKey
ALTER TABLE "atcTipoPlan" ADD CONSTRAINT "fk_tipo_plan_tipo_servicio" FOREIGN KEY ("id_tipo_servicio") REFERENCES "atcTipoServicio"("id_tipo_servicio") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcPlan" ADD CONSTRAINT "fk_plan_tipo_plan" FOREIGN KEY ("id_tipo_plan") REFERENCES "atcTipoPlan"("id_tipo_plan") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcContrato" ADD CONSTRAINT "fk_contrato_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcContrato" ADD CONSTRAINT "fk_contrato_plan" FOREIGN KEY ("id_plan") REFERENCES "atcPlan"("id_plan") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcContrato" ADD CONSTRAINT "fk_contrato_ciclo" FOREIGN KEY ("id_ciclo") REFERENCES "atcCicloFacturacion"("id_ciclo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcContrato" ADD CONSTRAINT "fk_contrato_direccion" FOREIGN KEY ("id_direccion_servicio") REFERENCES "clienteDirecciones"("id_cliente_direccion") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcContrato" ADD CONSTRAINT "fk_contrato_orden_trabajo" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcContrato" ADD CONSTRAINT "fk_contrato_usuario_creador" FOREIGN KEY ("id_usuario_creador") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcContratoInstalacion" ADD CONSTRAINT "fk_instalacion_contrato" FOREIGN KEY ("id_contrato") REFERENCES "atcContrato"("id_contrato") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ============================================================================
-- SEED DE CATÁLOGOS DE CONTRATOS
-- Migrados del sistema anterior (tbl_customers_plan_service_types,
-- tbl_customers_plan_types, tbl_customers_cycle)
-- ============================================================================

-- Tipos de Servicio (3 registros)
INSERT INTO "atcTipoServicio" (codigo, nombre, estado, fecha_creacion) VALUES
  ('RES', 'Residencial', 'ACTIVO'::"estado", NOW()),
  ('CORP', 'Corporativo', 'ACTIVO'::"estado", NOW()),
  ('OTRO', 'Otro', 'ACTIVO'::"estado", NOW())
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Tipos de Plan (21 registros)
-- Residenciales (id_tipo_servicio = 1)
INSERT INTO "atcTipoPlan" (codigo, nombre, id_tipo_servicio, estado, fecha_creacion) VALUES
  ('IR', 'Internet Residencial', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'RES'), 'ACTIVO'::"estado", NOW()),
  ('CR', 'CATV Residencial', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'RES'), 'ACTIVO'::"estado", NOW()),
  ('ICR', 'Internet + CATV Residencial', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'RES'), 'ACTIVO'::"estado", NOW()),
  ('TICR', 'Telefonía + Internet + CATV Residencial', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'RES'), 'ACTIVO'::"estado", NOW()),
  ('TIR', 'Internet + Telefonía Residencial', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'RES'), 'ACTIVO'::"estado", NOW()),
  ('CSR', 'Convenio de servicio', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'RES'), 'ACTIVO'::"estado", NOW())
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, id_tipo_servicio = EXCLUDED.id_tipo_servicio;

-- Corporativos (id_tipo_servicio = 2)
INSERT INTO "atcTipoPlan" (codigo, nombre, id_tipo_servicio, estado, fecha_creacion) VALUES
  ('IC', 'Internet Corporativo', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW()),
  ('CC', 'CATV Corporativo', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW()),
  ('ICC', 'Internet + CATV Corporativo', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW()),
  ('TIC', 'Telefonía + Internet Corporativo', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW()),
  ('TC', 'Telefonía Corporativo', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW()),
  ('TCC', 'Telefonía + CATV Corporativo', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW()),
  ('TICC', 'Telefonía + Internet + CATV Corporativo', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW()),
  ('C', 'Colocación', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW()),
  ('F', 'Fibra Oscura', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'CORP'), 'ACTIVO'::"estado", NOW())
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, id_tipo_servicio = EXCLUDED.id_tipo_servicio;

-- Otros (id_tipo_servicio = 3)
INSERT INTO "atcTipoPlan" (codigo, nombre, id_tipo_servicio, estado, fecha_creacion) VALUES
  ('M', 'Membresía', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'OTRO'), 'ACTIVO'::"estado", NOW()),
  ('SC', 'Servicios Complementarios', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'OTRO'), 'ACTIVO'::"estado", NOW()),
  ('VP', 'Venta de productos', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'OTRO'), 'ACTIVO'::"estado", NOW()),
  ('FP', 'Financiamiento de Producto', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'OTRO'), 'ACTIVO'::"estado", NOW()),
  ('APS', 'Acuerdo Pago de Servicio', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'OTRO'), 'ACTIVO'::"estado", NOW()),
  ('A', 'Abonos', (SELECT id_tipo_servicio FROM "atcTipoServicio" WHERE codigo = 'OTRO'), 'ACTIVO'::"estado", NOW())
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, id_tipo_servicio = EXCLUDED.id_tipo_servicio;

-- Ciclos de Facturación (10 registros)
-- Migrados de tbl_customers_cycle del sistema anterior
INSERT INTO "atcCicloFacturacion" (nombre, dia_corte, dia_vencimiento, periodo_inicio, periodo_fin, estado, fecha_creacion) VALUES
  ('Ciclo 1 - día 3 de cada mes', 3, 3, 1, 31, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 2 - día 12 de cada mes', 12, 12, 10, 9, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 3 - día 10 de cada mes', 10, 10, 6, 5, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 4 - día 16 de cada mes', 16, 16, 1, 31, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 5 - día 24 de cada mes', 24, 24, 21, 20, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 6 - día 7 de cada mes', 7, 7, 4, 3, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 7 - día 16 de cada mes', 16, 16, 13, 12, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 8 - día 19 de cada mes', 19, 19, 18, 17, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 9 - día 27 de cada mes', 27, 27, 26, 25, 'ACTIVO'::"estado", NOW()),
  ('Ciclo 10 - día 5 de cada mes', 5, 5, 28, 27, 'ACTIVO'::"estado", NOW());

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "fcm_token" TEXT;

-- CreateEnum
CREATE TYPE "estado_dte" AS ENUM ('BORRADOR', 'FIRMADO', 'TRANSMITIDO', 'PROCESADO', 'RECHAZADO', 'CONTINGENCIA', 'INVALIDADO');

-- CreateEnum
CREATE TYPE "estado_anulacion" AS ENUM ('PENDIENTE', 'FIRMADA', 'TRANSMITIDA', 'PROCESADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "tipo_invalidacion" AS ENUM ('ERROR_INFORMACION', 'RESCINDIR_OPERACION', 'OTRO');

-- CreateEnum
CREATE TYPE "tipo_calculo_mora" AS ENUM ('MONTO_FIJO', 'PORCENTAJE_SALDO', 'PORCENTAJE_MONTO_ORIGINAL');

-- CreateEnum
CREATE TYPE "frecuencia_mora" AS ENUM ('UNICA', 'DIARIA', 'SEMANAL', 'MENSUAL');

-- AlterTable
ALTER TABLE "GeneralData" ADD COLUMN     "api_key" TEXT DEFAULT '',
ADD COLUMN     "id_mora_config_default" INTEGER;

-- AlterTable
ALTER TABLE "atcContrato" ADD COLUMN     "id_mora_config" INTEGER;

-- CreateTable
CREATE TABLE "dte_emitidos" (
    "id_dte" SERIAL NOT NULL,
    "codigo_generacion" CHAR(36) NOT NULL,
    "numero_control" TEXT NOT NULL,
    "tipo_dte" CHAR(2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ambiente" CHAR(2) NOT NULL,
    "tipo_modelo" INTEGER NOT NULL DEFAULT 1,
    "tipo_operacion" INTEGER NOT NULL DEFAULT 1,
    "tipo_contingencia" INTEGER,
    "motivo_contin" TEXT,
    "fecha_emision" DATE NOT NULL,
    "hora_emision" VARCHAR(8) NOT NULL,
    "tipo_moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "receptor_tipo_documento" VARCHAR(2),
    "receptor_num_documento" VARCHAR(20),
    "receptor_nrc" VARCHAR(10),
    "receptor_nombre" VARCHAR(250),
    "receptor_nombre_comerc" VARCHAR(250),
    "receptor_cod_actividad" VARCHAR(10),
    "receptor_desc_actividad" VARCHAR(250),
    "receptor_telefono" VARCHAR(30),
    "receptor_correo" VARCHAR(100),
    "receptor_departamento" VARCHAR(2),
    "receptor_municipio" VARCHAR(2),
    "receptor_complemento" VARCHAR(200),
    "id_cliente" INTEGER,
    "id_cliente_facturacion" INTEGER,
    "id_contrato" INTEGER,
    "id_sucursal" INTEGER,
    "total_no_sujetas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_exentas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_gravadas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal_ventas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento_no_sujetas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento_exentas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento_gravadas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "porcentaje_descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total_descuentos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva_perci1" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva_rete1" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rete_renta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_total_operacion" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_no_gravado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_pagar" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_letras" VARCHAR(300) NOT NULL,
    "saldo_favor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "condicion_operacion" INTEGER NOT NULL DEFAULT 1,
    "pagos_json" TEXT,
    "num_pago_electronico" VARCHAR(100),
    "documentos_relacionados_json" TEXT,
    "otros_documentos_json" TEXT,
    "venta_tercero_json" TEXT,
    "extension_json" TEXT,
    "apendice_json" TEXT,
    "tributos_json" TEXT,
    "dte_json" TEXT NOT NULL,
    "dte_firmado" TEXT,
    "sello_recepcion" VARCHAR(50),
    "fecha_recepcion" TIMESTAMP(3),
    "codigo_msg" VARCHAR(10),
    "descripcion_msg" VARCHAR(500),
    "observaciones_mh" TEXT,
    "estado" "estado_dte" NOT NULL DEFAULT 'BORRADOR',
    "intentos_transmision" INTEGER NOT NULL DEFAULT 0,
    "ultimo_error" TEXT,
    "id_usuario_crea" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dte_emitidos_pkey" PRIMARY KEY ("id_dte")
);

-- CreateTable
CREATE TABLE "dte_emitidos_detalle" (
    "id_detalle" SERIAL NOT NULL,
    "id_dte" INTEGER NOT NULL,
    "num_item" INTEGER NOT NULL,
    "tipo_item" INTEGER NOT NULL,
    "numero_documento" VARCHAR(50),
    "codigo" VARCHAR(50),
    "cod_tributo" VARCHAR(10),
    "descripcion" VARCHAR(1000) NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "uni_medida" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,4) NOT NULL,
    "monto_descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "venta_no_sujeta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "venta_exenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "venta_gravada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tributos_json" TEXT,
    "iva_item" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "psv" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "no_gravado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "id_catalogo" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dte_emitidos_detalle_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "dte_anulaciones" (
    "id_anulacion" SERIAL NOT NULL,
    "id_dte" INTEGER NOT NULL,
    "codigo_generacion" CHAR(36) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 2,
    "ambiente" CHAR(2) NOT NULL,
    "tipo_invalidacion" "tipo_invalidacion" NOT NULL,
    "motivo_invalidacion" VARCHAR(250),
    "nombre_responsable" VARCHAR(200) NOT NULL,
    "tipo_doc_responsable" VARCHAR(2) NOT NULL,
    "num_doc_responsable" VARCHAR(25) NOT NULL,
    "nombre_solicita" VARCHAR(200) NOT NULL,
    "tipo_doc_solicita" VARCHAR(2) NOT NULL,
    "num_doc_solicita" VARCHAR(25) NOT NULL,
    "tipo_documento_original" VARCHAR(2) NOT NULL,
    "numero_documento_original" VARCHAR(36) NOT NULL,
    "fecha_emision_original" DATE NOT NULL,
    "monto_iva_original" DECIMAL(12,2) NOT NULL,
    "codigo_generacion_reemplazo" CHAR(36),
    "anulacion_json" TEXT NOT NULL,
    "anulacion_firmada" TEXT,
    "sello_recepcion" VARCHAR(50),
    "fecha_recepcion" TIMESTAMP(3),
    "codigo_msg" VARCHAR(10),
    "descripcion_msg" VARCHAR(500),
    "estado" "estado_anulacion" NOT NULL DEFAULT 'PENDIENTE',
    "intentos_transmision" INTEGER NOT NULL DEFAULT 0,
    "ultimo_error" TEXT,
    "id_usuario_crea" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dte_anulaciones_pkey" PRIMARY KEY ("id_anulacion")
);

-- CreateTable
CREATE TABLE "mora_configuracion" (
    "id_mora_config" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo_calculo" "tipo_calculo_mora" NOT NULL DEFAULT 'MONTO_FIJO',
    "valor" DECIMAL(10,4) NOT NULL,
    "dias_gracia" INTEGER NOT NULL DEFAULT 0,
    "mora_maxima" DECIMAL(10,2),
    "porcentaje_maximo" DECIMAL(5,2),
    "frecuencia" "frecuencia_mora" NOT NULL DEFAULT 'UNICA',
    "es_acumulativa" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mora_configuracion_pkey" PRIMARY KEY ("id_mora_config")
);

-- CreateIndex
CREATE UNIQUE INDEX "dte_emitidos_codigo_generacion_key" ON "dte_emitidos"("codigo_generacion");

-- CreateIndex
CREATE UNIQUE INDEX "dte_emitidos_numero_control_key" ON "dte_emitidos"("numero_control");

-- CreateIndex
CREATE INDEX "dte_emitidos_tipo_dte_idx" ON "dte_emitidos"("tipo_dte");

-- CreateIndex
CREATE INDEX "dte_emitidos_estado_idx" ON "dte_emitidos"("estado");

-- CreateIndex
CREATE INDEX "dte_emitidos_fecha_emision_idx" ON "dte_emitidos"("fecha_emision");

-- CreateIndex
CREATE INDEX "dte_emitidos_id_cliente_idx" ON "dte_emitidos"("id_cliente");

-- CreateIndex
CREATE INDEX "dte_emitidos_id_contrato_idx" ON "dte_emitidos"("id_contrato");

-- CreateIndex
CREATE INDEX "dte_emitidos_id_sucursal_idx" ON "dte_emitidos"("id_sucursal");

-- CreateIndex
CREATE INDEX "dte_emitidos_receptor_num_documento_idx" ON "dte_emitidos"("receptor_num_documento");

-- CreateIndex
CREATE INDEX "dte_emitidos_sello_recepcion_idx" ON "dte_emitidos"("sello_recepcion");

-- CreateIndex
CREATE INDEX "dte_emitidos_detalle_id_dte_idx" ON "dte_emitidos_detalle"("id_dte");

-- CreateIndex
CREATE INDEX "dte_emitidos_detalle_id_catalogo_idx" ON "dte_emitidos_detalle"("id_catalogo");

-- CreateIndex
CREATE UNIQUE INDEX "dte_anulaciones_codigo_generacion_key" ON "dte_anulaciones"("codigo_generacion");

-- CreateIndex
CREATE INDEX "dte_anulaciones_id_dte_idx" ON "dte_anulaciones"("id_dte");

-- CreateIndex
CREATE INDEX "dte_anulaciones_estado_idx" ON "dte_anulaciones"("estado");

-- CreateIndex
CREATE INDEX "dte_anulaciones_fecha_creacion_idx" ON "dte_anulaciones"("fecha_creacion");

-- CreateIndex
CREATE UNIQUE INDEX "mora_configuracion_codigo_key" ON "mora_configuracion"("codigo");

-- CreateIndex
CREATE INDEX "mora_configuracion_codigo_idx" ON "mora_configuracion"("codigo");

-- CreateIndex
CREATE INDEX "mora_configuracion_activo_idx" ON "mora_configuracion"("activo");

-- CreateIndex
CREATE INDEX "atcContrato_id_mora_config_idx" ON "atcContrato"("id_mora_config");

-- AddForeignKey
ALTER TABLE "GeneralData" ADD CONSTRAINT "fk_general_data_mora_default" FOREIGN KEY ("id_mora_config_default") REFERENCES "mora_configuracion"("id_mora_config") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atcContrato" ADD CONSTRAINT "fk_contrato_mora_config" FOREIGN KEY ("id_mora_config") REFERENCES "mora_configuracion"("id_mora_config") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_emitidos" ADD CONSTRAINT "fk_dte_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_emitidos" ADD CONSTRAINT "fk_dte_cliente_facturacion" FOREIGN KEY ("id_cliente_facturacion") REFERENCES "clienteDatosFacturacion"("id_cliente_datos_facturacion") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_emitidos" ADD CONSTRAINT "fk_dte_contrato" FOREIGN KEY ("id_contrato") REFERENCES "atcContrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_emitidos" ADD CONSTRAINT "fk_dte_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_emitidos" ADD CONSTRAINT "fk_dte_usuario_crea" FOREIGN KEY ("id_usuario_crea") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_emitidos_detalle" ADD CONSTRAINT "fk_dte_detalle_dte" FOREIGN KEY ("id_dte") REFERENCES "dte_emitidos"("id_dte") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_emitidos_detalle" ADD CONSTRAINT "fk_dte_detalle_catalogo" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_anulaciones" ADD CONSTRAINT "fk_anulacion_dte" FOREIGN KEY ("id_dte") REFERENCES "dte_emitidos"("id_dte") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dte_anulaciones" ADD CONSTRAINT "fk_anulacion_usuario_crea" FOREIGN KEY ("id_usuario_crea") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
