-- Script para insertar catálogos de cliente (Estado Civil y Estado Vivienda)
-- Ejecutar este script si las tablas están vacías

-- CATÁLOGO ESTADO CIVIL
INSERT INTO cat_estado_civil (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'SOLTERO', 'Soltero(a)', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_civil WHERE codigo = 'SOLTERO');

INSERT INTO cat_estado_civil (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'CASADO', 'Casado(a)', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_civil WHERE codigo = 'CASADO');

INSERT INTO cat_estado_civil (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'DIVORCIADO', 'Divorciado(a)', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_civil WHERE codigo = 'DIVORCIADO');

INSERT INTO cat_estado_civil (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'VIUDO', 'Viudo(a)', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_civil WHERE codigo = 'VIUDO');

INSERT INTO cat_estado_civil (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'UNION_LIBRE', 'Unión Libre', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_civil WHERE codigo = 'UNION_LIBRE');

-- CATÁLOGO ESTADO DE VIVIENDA
INSERT INTO cat_estado_vivienda (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'PROPIA', 'Propia', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_vivienda WHERE codigo = 'PROPIA');

INSERT INTO cat_estado_vivienda (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'ALQUILADA', 'Alquilada', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_vivienda WHERE codigo = 'ALQUILADA');

INSERT INTO cat_estado_vivienda (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'FINANCIADA', 'Financiada', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_vivienda WHERE codigo = 'FINANCIADA');

INSERT INTO cat_estado_vivienda (codigo, nombre, activo, fecha_creacion, fecha_ultima_actualizacion)
SELECT 'FAMILIAR', 'Familiar', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM cat_estado_vivienda WHERE codigo = 'FAMILIAR');

-- Verificar datos insertados
SELECT 'Estados Civiles:' as tabla;
SELECT * FROM cat_estado_civil;

SELECT 'Estados de Vivienda:' as tabla;
SELECT * FROM cat_estado_vivienda;
