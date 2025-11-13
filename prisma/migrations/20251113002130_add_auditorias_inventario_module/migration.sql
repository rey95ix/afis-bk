-- CreateEnum
CREATE TYPE "tipo_auditoria" AS ENUM ('COMPLETA', 'SORPRESA');

-- CreateEnum
CREATE TYPE "estado_auditoria" AS ENUM ('PLANIFICADA', 'EN_PROGRESO', 'PENDIENTE_REVISION', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "tipo_discrepancia" AS ENUM ('FALTANTE', 'SOBRANTE', 'CONFORME');

-- CreateEnum
CREATE TYPE "causa_discrepancia" AS ENUM ('ROBO', 'MERMA', 'ERROR_REGISTRO', 'ERROR_CONTEO', 'DANO', 'OTRO', 'PENDIENTE_INVESTIGACION');

-- CreateEnum
CREATE TYPE "estado_ajuste" AS ENUM ('PENDIENTE_AUTORIZACION', 'AUTORIZADO', 'RECHAZADO', 'APLICADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "tipo_snapshot" AS ENUM ('AUDITORIA', 'MENSUAL', 'TRIMESTRAL', 'ANUAL', 'MANUAL');

-- CreateTable
CREATE TABLE "auditorias_inventario" (
    "id_auditoria" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "tipo_auditoria" NOT NULL,
    "estado" "estado_auditoria" NOT NULL DEFAULT 'PLANIFICADA',
    "id_bodega" INTEGER NOT NULL,
    "id_estante" INTEGER,
    "incluir_todas_categorias" BOOLEAN NOT NULL DEFAULT true,
    "categorias_a_auditar" TEXT,
    "id_usuario_planifica" INTEGER NOT NULL,
    "id_usuario_ejecuta" INTEGER,
    "fecha_planificada" TIMESTAMP(3),
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "total_items_auditados" INTEGER NOT NULL DEFAULT 0,
    "total_items_conformes" INTEGER NOT NULL DEFAULT 0,
    "total_items_con_discrepancia" INTEGER NOT NULL DEFAULT 0,
    "valor_total_discrepancias" DECIMAL(12,2),
    "porcentaje_accuracy" DECIMAL(5,2),
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_inventario_pkey" PRIMARY KEY ("id_auditoria")
);

-- CreateTable
CREATE TABLE "auditorias_detalle" (
    "id_auditoria_detalle" SERIAL NOT NULL,
    "id_auditoria" INTEGER NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "cantidad_sistema" INTEGER NOT NULL,
    "cantidad_reservada_sistema" INTEGER NOT NULL DEFAULT 0,
    "costo_promedio_sistema" DECIMAL(10,2) NOT NULL,
    "cantidad_fisica" INTEGER,
    "fue_contado" BOOLEAN NOT NULL DEFAULT false,
    "discrepancia" INTEGER,
    "discrepancia_valor" DECIMAL(12,2),
    "porcentaje_discrepancia" DECIMAL(5,2),
    "tipo_discrepancia" "tipo_discrepancia",
    "causa_probable" "causa_discrepancia" DEFAULT 'PENDIENTE_INVESTIGACION',
    "requiere_investigacion" BOOLEAN NOT NULL DEFAULT false,
    "observaciones_conteo" TEXT,
    "id_usuario_conteo" INTEGER,
    "fecha_conteo" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_detalle_pkey" PRIMARY KEY ("id_auditoria_detalle")
);

-- CreateTable
CREATE TABLE "auditorias_series" (
    "id_auditoria_serie" SERIAL NOT NULL,
    "id_auditoria_detalle" INTEGER NOT NULL,
    "numero_serie" TEXT NOT NULL,
    "encontrado_fisicamente" BOOLEAN NOT NULL DEFAULT true,
    "existe_en_sistema" BOOLEAN NOT NULL DEFAULT false,
    "estado_en_sistema" "estado_inventario",
    "ubicacion_esperada_bodega" INTEGER,
    "ubicacion_real_bodega" INTEGER,
    "observaciones" TEXT,
    "fecha_escaneo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_series_pkey" PRIMARY KEY ("id_auditoria_serie")
);

-- CreateTable
CREATE TABLE "auditorias_evidencias" (
    "id_evidencia" SERIAL NOT NULL,
    "id_auditoria" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT,
    "descripcion" TEXT,
    "nombre_archivo" TEXT NOT NULL,
    "ruta_archivo" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "id_catalogo" INTEGER,
    "id_usuario_subida" INTEGER NOT NULL,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_evidencias_pkey" PRIMARY KEY ("id_evidencia")
);

-- CreateTable
CREATE TABLE "ajustes_inventario" (
    "id_ajuste" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "id_auditoria" INTEGER,
    "id_auditoria_detalle" INTEGER,
    "id_catalogo" INTEGER NOT NULL,
    "id_bodega" INTEGER NOT NULL,
    "id_estante" INTEGER,
    "cantidad_anterior" INTEGER NOT NULL,
    "cantidad_ajuste" INTEGER NOT NULL,
    "cantidad_nueva" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(10,2),
    "motivo" "tipo_movimiento" NOT NULL DEFAULT 'AJUSTE_INVENTARIO',
    "motivo_detallado" TEXT NOT NULL,
    "tipo_discrepancia" "tipo_discrepancia",
    "causa_discrepancia" "causa_discrepancia",
    "estado" "estado_ajuste" NOT NULL DEFAULT 'PENDIENTE_AUTORIZACION',
    "id_usuario_solicita" INTEGER NOT NULL,
    "id_usuario_autoriza" INTEGER,
    "observaciones_autorizacion" TEXT,
    "motivo_rechazo" TEXT,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_autorizacion" TIMESTAMP(3),
    "fecha_aplicacion" TIMESTAMP(3),
    "id_movimiento_generado" INTEGER,
    "documentos_soporte" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_inventario_pkey" PRIMARY KEY ("id_ajuste")
);

-- CreateTable
CREATE TABLE "snapshots_inventario" (
    "id_snapshot" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "tipo_snapshot" NOT NULL,
    "periodo" TEXT,
    "descripcion" TEXT,
    "id_auditoria" INTEGER,
    "id_bodega" INTEGER,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "total_cantidad" INTEGER NOT NULL DEFAULT 0,
    "valor_total_inventario" DECIMAL(14,2),
    "fecha_snapshot" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_inventario_pkey" PRIMARY KEY ("id_snapshot")
);

-- CreateTable
CREATE TABLE "snapshots_detalle" (
    "id_snapshot_detalle" SERIAL NOT NULL,
    "id_snapshot" INTEGER NOT NULL,
    "id_catalogo" INTEGER NOT NULL,
    "id_bodega" INTEGER NOT NULL,
    "id_estante" INTEGER,
    "cantidad_disponible" INTEGER NOT NULL,
    "cantidad_reservada" INTEGER NOT NULL,
    "cantidad_total" INTEGER NOT NULL,
    "costo_promedio" DECIMAL(10,2) NOT NULL,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_detalle_pkey" PRIMARY KEY ("id_snapshot_detalle")
);

-- CreateTable
CREATE TABLE "metricas_inventario" (
    "id_metrica" SERIAL NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipo_periodo" TEXT NOT NULL DEFAULT 'MENSUAL',
    "id_bodega" INTEGER,
    "id_categoria" INTEGER,
    "total_auditorias_realizadas" INTEGER NOT NULL DEFAULT 0,
    "total_items_auditados" INTEGER NOT NULL DEFAULT 0,
    "total_items_conformes" INTEGER NOT NULL DEFAULT 0,
    "total_items_con_discrepancia" INTEGER NOT NULL DEFAULT 0,
    "accuracy_porcentaje" DECIMAL(5,2),
    "valor_total_inventario" DECIMAL(14,2),
    "valor_discrepancias_positivas" DECIMAL(12,2),
    "valor_discrepancias_negativas" DECIMAL(12,2),
    "valor_neto_discrepancias" DECIMAL(12,2),
    "total_movimientos" INTEGER NOT NULL DEFAULT 0,
    "total_ajustes" INTEGER NOT NULL DEFAULT 0,
    "total_ajustes_autorizados" INTEGER NOT NULL DEFAULT 0,
    "fecha_calculo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculado_por" INTEGER,

    CONSTRAINT "metricas_inventario_pkey" PRIMARY KEY ("id_metrica")
);

-- CreateIndex
CREATE UNIQUE INDEX "auditorias_inventario_codigo_key" ON "auditorias_inventario"("codigo");

-- CreateIndex
CREATE INDEX "auditorias_inventario_estado_idx" ON "auditorias_inventario"("estado");

-- CreateIndex
CREATE INDEX "auditorias_inventario_tipo_idx" ON "auditorias_inventario"("tipo");

-- CreateIndex
CREATE INDEX "auditorias_inventario_id_bodega_idx" ON "auditorias_inventario"("id_bodega");

-- CreateIndex
CREATE INDEX "auditorias_inventario_fecha_planificada_idx" ON "auditorias_inventario"("fecha_planificada");

-- CreateIndex
CREATE INDEX "auditorias_inventario_fecha_creacion_idx" ON "auditorias_inventario"("fecha_creacion");

-- CreateIndex
CREATE INDEX "auditorias_detalle_id_auditoria_idx" ON "auditorias_detalle"("id_auditoria");

-- CreateIndex
CREATE INDEX "auditorias_detalle_id_catalogo_idx" ON "auditorias_detalle"("id_catalogo");

-- CreateIndex
CREATE INDEX "auditorias_detalle_tipo_discrepancia_idx" ON "auditorias_detalle"("tipo_discrepancia");

-- CreateIndex
CREATE UNIQUE INDEX "auditorias_detalle_id_auditoria_id_catalogo_key" ON "auditorias_detalle"("id_auditoria", "id_catalogo");

-- CreateIndex
CREATE INDEX "auditorias_series_id_auditoria_detalle_idx" ON "auditorias_series"("id_auditoria_detalle");

-- CreateIndex
CREATE INDEX "auditorias_series_numero_serie_idx" ON "auditorias_series"("numero_serie");

-- CreateIndex
CREATE INDEX "auditorias_evidencias_id_auditoria_idx" ON "auditorias_evidencias"("id_auditoria");

-- CreateIndex
CREATE INDEX "auditorias_evidencias_id_catalogo_idx" ON "auditorias_evidencias"("id_catalogo");

-- CreateIndex
CREATE UNIQUE INDEX "ajustes_inventario_codigo_key" ON "ajustes_inventario"("codigo");

-- CreateIndex
CREATE INDEX "ajustes_inventario_estado_idx" ON "ajustes_inventario"("estado");

-- CreateIndex
CREATE INDEX "ajustes_inventario_id_auditoria_idx" ON "ajustes_inventario"("id_auditoria");

-- CreateIndex
CREATE INDEX "ajustes_inventario_id_catalogo_idx" ON "ajustes_inventario"("id_catalogo");

-- CreateIndex
CREATE INDEX "ajustes_inventario_id_bodega_idx" ON "ajustes_inventario"("id_bodega");

-- CreateIndex
CREATE INDEX "ajustes_inventario_fecha_solicitud_idx" ON "ajustes_inventario"("fecha_solicitud");

-- CreateIndex
CREATE UNIQUE INDEX "snapshots_inventario_codigo_key" ON "snapshots_inventario"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "snapshots_inventario_id_auditoria_key" ON "snapshots_inventario"("id_auditoria");

-- CreateIndex
CREATE INDEX "snapshots_inventario_tipo_idx" ON "snapshots_inventario"("tipo");

-- CreateIndex
CREATE INDEX "snapshots_inventario_periodo_idx" ON "snapshots_inventario"("periodo");

-- CreateIndex
CREATE INDEX "snapshots_inventario_id_bodega_idx" ON "snapshots_inventario"("id_bodega");

-- CreateIndex
CREATE INDEX "snapshots_inventario_fecha_snapshot_idx" ON "snapshots_inventario"("fecha_snapshot");

-- CreateIndex
CREATE INDEX "snapshots_detalle_id_snapshot_idx" ON "snapshots_detalle"("id_snapshot");

-- CreateIndex
CREATE INDEX "snapshots_detalle_id_catalogo_idx" ON "snapshots_detalle"("id_catalogo");

-- CreateIndex
CREATE INDEX "snapshots_detalle_id_bodega_idx" ON "snapshots_detalle"("id_bodega");

-- CreateIndex
CREATE INDEX "metricas_inventario_periodo_idx" ON "metricas_inventario"("periodo");

-- CreateIndex
CREATE INDEX "metricas_inventario_id_bodega_idx" ON "metricas_inventario"("id_bodega");

-- CreateIndex
CREATE INDEX "metricas_inventario_id_categoria_idx" ON "metricas_inventario"("id_categoria");

-- CreateIndex
CREATE UNIQUE INDEX "metricas_inventario_periodo_id_bodega_id_categoria_key" ON "metricas_inventario"("periodo", "id_bodega", "id_categoria");

-- AddForeignKey
ALTER TABLE "auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_id_bodega_fkey" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_id_estante_fkey" FOREIGN KEY ("id_estante") REFERENCES "estantes"("id_estante") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_id_usuario_planifica_fkey" FOREIGN KEY ("id_usuario_planifica") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_inventario" ADD CONSTRAINT "auditorias_inventario_id_usuario_ejecuta_fkey" FOREIGN KEY ("id_usuario_ejecuta") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_detalle" ADD CONSTRAINT "auditorias_detalle_id_auditoria_fkey" FOREIGN KEY ("id_auditoria") REFERENCES "auditorias_inventario"("id_auditoria") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_detalle" ADD CONSTRAINT "auditorias_detalle_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_detalle" ADD CONSTRAINT "auditorias_detalle_id_usuario_conteo_fkey" FOREIGN KEY ("id_usuario_conteo") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_series" ADD CONSTRAINT "auditorias_series_id_auditoria_detalle_fkey" FOREIGN KEY ("id_auditoria_detalle") REFERENCES "auditorias_detalle"("id_auditoria_detalle") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_evidencias" ADD CONSTRAINT "auditorias_evidencias_id_auditoria_fkey" FOREIGN KEY ("id_auditoria") REFERENCES "auditorias_inventario"("id_auditoria") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_evidencias" ADD CONSTRAINT "auditorias_evidencias_id_usuario_subida_fkey" FOREIGN KEY ("id_usuario_subida") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_id_auditoria_fkey" FOREIGN KEY ("id_auditoria") REFERENCES "auditorias_inventario"("id_auditoria") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_id_catalogo_fkey" FOREIGN KEY ("id_catalogo") REFERENCES "catalogo"("id_catalogo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_id_bodega_fkey" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_id_estante_fkey" FOREIGN KEY ("id_estante") REFERENCES "estantes"("id_estante") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_id_usuario_solicita_fkey" FOREIGN KEY ("id_usuario_solicita") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_id_usuario_autoriza_fkey" FOREIGN KEY ("id_usuario_autoriza") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots_inventario" ADD CONSTRAINT "snapshots_inventario_id_auditoria_fkey" FOREIGN KEY ("id_auditoria") REFERENCES "auditorias_inventario"("id_auditoria") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots_inventario" ADD CONSTRAINT "snapshots_inventario_id_bodega_fkey" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots_inventario" ADD CONSTRAINT "snapshots_inventario_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots_detalle" ADD CONSTRAINT "snapshots_detalle_id_snapshot_fkey" FOREIGN KEY ("id_snapshot") REFERENCES "snapshots_inventario"("id_snapshot") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metricas_inventario" ADD CONSTRAINT "metricas_inventario_id_bodega_fkey" FOREIGN KEY ("id_bodega") REFERENCES "bodegas"("id_bodega") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metricas_inventario" ADD CONSTRAINT "metricas_inventario_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id_categoria") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metricas_inventario" ADD CONSTRAINT "metricas_inventario_calculado_por_fkey" FOREIGN KEY ("calculado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
