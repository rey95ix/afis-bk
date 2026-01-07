-- CreateEnum
CREATE TYPE "estado_empleado" AS ENUM ('SOLICITANTE', 'EN_PROCESO', 'CONTRATADO', 'RECHAZADO', 'INACTIVO');

-- AlterTable
ALTER TABLE "whatsapp_chat" ADD COLUMN     "archivado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fecha_archivado" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cat_sexo" (
    "id_sexo" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_sexo_pkey" PRIMARY KEY ("id_sexo")
);

-- CreateTable
CREATE TABLE "cat_tipo_sangre" (
    "id_tipo_sangre" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_tipo_sangre_pkey" PRIMARY KEY ("id_tipo_sangre")
);

-- CreateTable
CREATE TABLE "cat_nacionalidad" (
    "id_nacionalidad" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_nacionalidad_pkey" PRIMARY KEY ("id_nacionalidad")
);

-- CreateTable
CREATE TABLE "cat_afp" (
    "id_afp" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_afp_pkey" PRIMARY KEY ("id_afp")
);

-- CreateTable
CREATE TABLE "cat_banco" (
    "id_banco" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_banco_pkey" PRIMARY KEY ("id_banco")
);

-- CreateTable
CREATE TABLE "cat_tipo_cuenta_banco" (
    "id_tipo_cuenta" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_tipo_cuenta_banco_pkey" PRIMARY KEY ("id_tipo_cuenta")
);

-- CreateTable
CREATE TABLE "cat_parentesco" (
    "id_parentesco" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_parentesco_pkey" PRIMARY KEY ("id_parentesco")
);

-- CreateTable
CREATE TABLE "cat_grado_academico" (
    "id_grado_academico" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_grado_academico_pkey" PRIMARY KEY ("id_grado_academico")
);

-- CreateTable
CREATE TABLE "cat_situacion_academica" (
    "id_situacion_academica" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_situacion_academica_pkey" PRIMARY KEY ("id_situacion_academica")
);

-- CreateTable
CREATE TABLE "cat_tipo_postgrado" (
    "id_tipo_postgrado" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_tipo_postgrado_pkey" PRIMARY KEY ("id_tipo_postgrado")
);

-- CreateTable
CREATE TABLE "cat_nivel_conocimiento" (
    "id_nivel_conocimiento" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_nivel_conocimiento_pkey" PRIMARY KEY ("id_nivel_conocimiento")
);

-- CreateTable
CREATE TABLE "cat_tipo_conocimiento_informatica" (
    "id_tipo_conocimiento" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_tipo_conocimiento_informatica_pkey" PRIMARY KEY ("id_tipo_conocimiento")
);

-- CreateTable
CREATE TABLE "cat_idioma" (
    "id_idioma" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_idioma_pkey" PRIMARY KEY ("id_idioma")
);

-- CreateTable
CREATE TABLE "cat_sector_empresa" (
    "id_sector_empresa" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_sector_empresa_pkey" PRIMARY KEY ("id_sector_empresa")
);

-- CreateTable
CREATE TABLE "cat_motivo_retiro" (
    "id_motivo_retiro" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_motivo_retiro_pkey" PRIMARY KEY ("id_motivo_retiro")
);

-- CreateTable
CREATE TABLE "cat_cargo" (
    "id_cargo" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_cargo_pkey" PRIMARY KEY ("id_cargo")
);

-- CreateTable
CREATE TABLE "rh_empleado" (
    "id_empleado" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "cargo_postulado" TEXT,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "id_sexo" INTEGER,
    "fecha_nacimiento" TIMESTAMP(3) NOT NULL,
    "lugar_nacimiento" TEXT,
    "id_nacionalidad" INTEGER,
    "id_estado_civil" INTEGER,
    "id_tipo_sangre" INTEGER,
    "id_departamento" INTEGER,
    "id_municipio" INTEGER,
    "direccion" TEXT,
    "email" TEXT,
    "telefono_fijo" TEXT,
    "telefono_celular" TEXT,
    "pretension_salarial" DECIMAL(10,2),
    "foto" TEXT,
    "estado" "estado_empleado" NOT NULL DEFAULT 'SOLICITANTE',
    "id_usuario" INTEGER,
    "fecha_contratacion" TIMESTAMP(3),
    "salario_acordado" DECIMAL(10,2),
    "id_cargo" INTEGER,
    "observaciones_contrato" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_pkey" PRIMARY KEY ("id_empleado")
);

-- CreateTable
CREATE TABLE "rh_empleado_documento" (
    "id_documento" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "numero_dui" TEXT,
    "numero_nit" TEXT,
    "numero_isss" TEXT,
    "numero_nup" TEXT,
    "id_afp" INTEGER,
    "numero_cuenta_banco" TEXT,
    "id_banco" INTEGER,
    "id_tipo_cuenta" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_documento_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "rh_empleado_contacto_emergencia" (
    "id_contacto" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 1,
    "id_parentesco" INTEGER,
    "telefono_dia" TEXT NOT NULL,
    "telefono_noche" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_contacto_emergencia_pkey" PRIMARY KEY ("id_contacto")
);

-- CreateTable
CREATE TABLE "rh_empleado_dependiente" (
    "id_dependiente" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_parentesco" INTEGER,
    "fecha_nacimiento" TIMESTAMP(3),
    "direccion" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_dependiente_pkey" PRIMARY KEY ("id_dependiente")
);

-- CreateTable
CREATE TABLE "rh_empleado_formacion" (
    "id_formacion" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "id_grado_academico" INTEGER,
    "id_situacion_academica" INTEGER,
    "profesion" TEXT,
    "institucion" TEXT NOT NULL,
    "anio_culminacion" INTEGER,
    "es_postgrado" BOOLEAN NOT NULL DEFAULT false,
    "id_tipo_postgrado" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_formacion_pkey" PRIMARY KEY ("id_formacion")
);

-- CreateTable
CREATE TABLE "rh_empleado_capacitacion" (
    "id_capacitacion" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "evento" TEXT NOT NULL,
    "institucion" TEXT NOT NULL,
    "lugar" TEXT,
    "anio" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_capacitacion_pkey" PRIMARY KEY ("id_capacitacion")
);

-- CreateTable
CREATE TABLE "rh_empleado_idioma" (
    "id_empleado_idioma" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "id_idioma" INTEGER NOT NULL,
    "id_nivel_lectura" INTEGER,
    "id_nivel_redaccion" INTEGER,
    "id_nivel_conversacion" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_idioma_pkey" PRIMARY KEY ("id_empleado_idioma")
);

-- CreateTable
CREATE TABLE "rh_empleado_conocimiento_informatico" (
    "id_conocimiento" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "id_tipo_conocimiento" INTEGER NOT NULL,
    "nombre_programa" TEXT NOT NULL,
    "id_nivel" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_conocimiento_informatico_pkey" PRIMARY KEY ("id_conocimiento")
);

-- CreateTable
CREATE TABLE "rh_empleado_experiencia_laboral" (
    "id_experiencia" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "empresa" TEXT NOT NULL,
    "id_sector" INTEGER,
    "numero_trabajadores" INTEGER,
    "cargo" TEXT NOT NULL,
    "nombre_jefe" TEXT,
    "telefono_jefe" TEXT,
    "ingreso_mensual" DECIMAL(10,2),
    "id_motivo_retiro" INTEGER,
    "motivo_retiro_otro" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_retiro" TIMESTAMP(3),
    "principales_logros" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_experiencia_laboral_pkey" PRIMARY KEY ("id_experiencia")
);

-- CreateTable
CREATE TABLE "rh_empleado_referencia" (
    "id_referencia" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_referencia_pkey" PRIMARY KEY ("id_referencia")
);

-- CreateTable
CREATE TABLE "rh_empleado_archivo" (
    "id_archivo" SERIAL NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "tipo_archivo" TEXT NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "ruta_archivo" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "descripcion" TEXT,
    "estado" "estado" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_empleado_archivo_pkey" PRIMARY KEY ("id_archivo")
);

-- CreateIndex
CREATE UNIQUE INDEX "cat_sexo_codigo_key" ON "cat_sexo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_tipo_sangre_codigo_key" ON "cat_tipo_sangre"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_nacionalidad_codigo_key" ON "cat_nacionalidad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_afp_codigo_key" ON "cat_afp"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_banco_codigo_key" ON "cat_banco"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_tipo_cuenta_banco_codigo_key" ON "cat_tipo_cuenta_banco"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_parentesco_codigo_key" ON "cat_parentesco"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_grado_academico_codigo_key" ON "cat_grado_academico"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_situacion_academica_codigo_key" ON "cat_situacion_academica"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_tipo_postgrado_codigo_key" ON "cat_tipo_postgrado"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_nivel_conocimiento_codigo_key" ON "cat_nivel_conocimiento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_tipo_conocimiento_informatica_codigo_key" ON "cat_tipo_conocimiento_informatica"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_idioma_codigo_key" ON "cat_idioma"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_sector_empresa_codigo_key" ON "cat_sector_empresa"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_motivo_retiro_codigo_key" ON "cat_motivo_retiro"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "cat_cargo_codigo_key" ON "cat_cargo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "rh_empleado_codigo_key" ON "rh_empleado"("codigo");

-- CreateIndex
CREATE INDEX "rh_empleado_estado_idx" ON "rh_empleado"("estado");

-- CreateIndex
CREATE INDEX "rh_empleado_id_departamento_idx" ON "rh_empleado"("id_departamento");

-- CreateIndex
CREATE INDEX "rh_empleado_id_municipio_idx" ON "rh_empleado"("id_municipio");

-- CreateIndex
CREATE INDEX "rh_empleado_fecha_creacion_idx" ON "rh_empleado"("fecha_creacion");

-- CreateIndex
CREATE UNIQUE INDEX "rh_empleado_documento_id_empleado_key" ON "rh_empleado_documento"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_documento_numero_dui_idx" ON "rh_empleado_documento"("numero_dui");

-- CreateIndex
CREATE INDEX "rh_empleado_documento_numero_nit_idx" ON "rh_empleado_documento"("numero_nit");

-- CreateIndex
CREATE INDEX "rh_empleado_contacto_emergencia_id_empleado_idx" ON "rh_empleado_contacto_emergencia"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_dependiente_id_empleado_idx" ON "rh_empleado_dependiente"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_formacion_id_empleado_idx" ON "rh_empleado_formacion"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_capacitacion_id_empleado_idx" ON "rh_empleado_capacitacion"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_idioma_id_empleado_idx" ON "rh_empleado_idioma"("id_empleado");

-- CreateIndex
CREATE UNIQUE INDEX "rh_empleado_idioma_id_empleado_id_idioma_key" ON "rh_empleado_idioma"("id_empleado", "id_idioma");

-- CreateIndex
CREATE INDEX "rh_empleado_conocimiento_informatico_id_empleado_idx" ON "rh_empleado_conocimiento_informatico"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_experiencia_laboral_id_empleado_idx" ON "rh_empleado_experiencia_laboral"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_referencia_id_empleado_idx" ON "rh_empleado_referencia"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_archivo_id_empleado_idx" ON "rh_empleado_archivo"("id_empleado");

-- CreateIndex
CREATE INDEX "rh_empleado_archivo_tipo_archivo_idx" ON "rh_empleado_archivo"("tipo_archivo");

-- CreateIndex
CREATE INDEX "whatsapp_chat_archivado_idx" ON "whatsapp_chat"("archivado");

-- AddForeignKey
ALTER TABLE "rh_empleado" ADD CONSTRAINT "fk_empleado_sexo" FOREIGN KEY ("id_sexo") REFERENCES "cat_sexo"("id_sexo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado" ADD CONSTRAINT "fk_empleado_nacionalidad" FOREIGN KEY ("id_nacionalidad") REFERENCES "cat_nacionalidad"("id_nacionalidad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado" ADD CONSTRAINT "fk_empleado_estado_civil" FOREIGN KEY ("id_estado_civil") REFERENCES "cat_estado_civil"("id_estado_civil") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado" ADD CONSTRAINT "fk_empleado_tipo_sangre" FOREIGN KEY ("id_tipo_sangre") REFERENCES "cat_tipo_sangre"("id_tipo_sangre") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado" ADD CONSTRAINT "fk_empleado_departamento" FOREIGN KEY ("id_departamento") REFERENCES "departamentos"("id_departamento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado" ADD CONSTRAINT "fk_empleado_municipio" FOREIGN KEY ("id_municipio") REFERENCES "municipios"("id_municipio") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado" ADD CONSTRAINT "fk_empleado_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado" ADD CONSTRAINT "fk_empleado_cargo" FOREIGN KEY ("id_cargo") REFERENCES "cat_cargo"("id_cargo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_documento" ADD CONSTRAINT "fk_documento_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_documento" ADD CONSTRAINT "fk_documento_afp" FOREIGN KEY ("id_afp") REFERENCES "cat_afp"("id_afp") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_documento" ADD CONSTRAINT "fk_documento_banco" FOREIGN KEY ("id_banco") REFERENCES "cat_banco"("id_banco") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_documento" ADD CONSTRAINT "fk_documento_tipo_cuenta" FOREIGN KEY ("id_tipo_cuenta") REFERENCES "cat_tipo_cuenta_banco"("id_tipo_cuenta") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_contacto_emergencia" ADD CONSTRAINT "fk_contacto_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_contacto_emergencia" ADD CONSTRAINT "fk_contacto_parentesco" FOREIGN KEY ("id_parentesco") REFERENCES "cat_parentesco"("id_parentesco") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_dependiente" ADD CONSTRAINT "fk_dependiente_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_dependiente" ADD CONSTRAINT "fk_dependiente_parentesco" FOREIGN KEY ("id_parentesco") REFERENCES "cat_parentesco"("id_parentesco") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_formacion" ADD CONSTRAINT "fk_formacion_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_formacion" ADD CONSTRAINT "fk_formacion_grado" FOREIGN KEY ("id_grado_academico") REFERENCES "cat_grado_academico"("id_grado_academico") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_formacion" ADD CONSTRAINT "fk_formacion_situacion" FOREIGN KEY ("id_situacion_academica") REFERENCES "cat_situacion_academica"("id_situacion_academica") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_formacion" ADD CONSTRAINT "fk_formacion_tipo_postgrado" FOREIGN KEY ("id_tipo_postgrado") REFERENCES "cat_tipo_postgrado"("id_tipo_postgrado") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_capacitacion" ADD CONSTRAINT "fk_capacitacion_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_idioma" ADD CONSTRAINT "fk_idioma_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_idioma" ADD CONSTRAINT "fk_idioma_idioma" FOREIGN KEY ("id_idioma") REFERENCES "cat_idioma"("id_idioma") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_idioma" ADD CONSTRAINT "fk_idioma_nivel_lectura" FOREIGN KEY ("id_nivel_lectura") REFERENCES "cat_nivel_conocimiento"("id_nivel_conocimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_idioma" ADD CONSTRAINT "fk_idioma_nivel_redaccion" FOREIGN KEY ("id_nivel_redaccion") REFERENCES "cat_nivel_conocimiento"("id_nivel_conocimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_idioma" ADD CONSTRAINT "fk_idioma_nivel_conversacion" FOREIGN KEY ("id_nivel_conversacion") REFERENCES "cat_nivel_conocimiento"("id_nivel_conocimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_conocimiento_informatico" ADD CONSTRAINT "fk_conocimiento_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_conocimiento_informatico" ADD CONSTRAINT "fk_conocimiento_tipo" FOREIGN KEY ("id_tipo_conocimiento") REFERENCES "cat_tipo_conocimiento_informatica"("id_tipo_conocimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_conocimiento_informatico" ADD CONSTRAINT "fk_conocimiento_nivel" FOREIGN KEY ("id_nivel") REFERENCES "cat_nivel_conocimiento"("id_nivel_conocimiento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_experiencia_laboral" ADD CONSTRAINT "fk_experiencia_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_experiencia_laboral" ADD CONSTRAINT "fk_experiencia_sector" FOREIGN KEY ("id_sector") REFERENCES "cat_sector_empresa"("id_sector_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_experiencia_laboral" ADD CONSTRAINT "fk_experiencia_motivo_retiro" FOREIGN KEY ("id_motivo_retiro") REFERENCES "cat_motivo_retiro"("id_motivo_retiro") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_referencia" ADD CONSTRAINT "fk_referencia_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rh_empleado_archivo" ADD CONSTRAINT "fk_archivo_empleado" FOREIGN KEY ("id_empleado") REFERENCES "rh_empleado"("id_empleado") ON DELETE CASCADE ON UPDATE NO ACTION;
