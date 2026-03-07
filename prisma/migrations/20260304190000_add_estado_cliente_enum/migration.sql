-- CreateEnum
CREATE TYPE "estado_cliente" AS ENUM ('SIN_INSTALAR', 'ACTIVO', 'SUSPENDIDO', 'BAJA_DEFINITIVA', 'EN_ESPERA', 'SIN_LIQUIDAR', 'INCONCLUSO', 'SIN_GESTION_CALIDAD', 'BAJA_CAMBIO_NOMBRE', 'VELOCIDAD_REDUCIDA', 'MOROSO_INCOBRABLE', 'SIN_COBERTURA', 'SUSPENDIDO_TEMPORAL', 'CONVENIO_ESPECIAL', 'BAJA_ADMINISTRATIVA');

-- AlterTable: Convert cliente.estado from estado enum to estado_cliente enum
-- First convert existing values, mapping old enum values to new ones
ALTER TABLE "cliente" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "cliente" ALTER COLUMN "estado" TYPE "estado_cliente" USING (
  CASE "estado"::text
    WHEN 'ACTIVO' THEN 'ACTIVO'::"estado_cliente"
    WHEN 'SUPENDIDO' THEN 'SUSPENDIDO'::"estado_cliente"
    WHEN 'INACTIVO' THEN 'BAJA_ADMINISTRATIVA'::"estado_cliente"
    ELSE 'SIN_INSTALAR'::"estado_cliente"
  END
);
ALTER TABLE "cliente" ALTER COLUMN "estado" SET DEFAULT 'ACTIVO'::"estado_cliente";
