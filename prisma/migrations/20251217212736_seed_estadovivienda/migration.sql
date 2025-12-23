-- This is an empty migration.
-- CATÁLOGO ESTADO CIVIL
INSERT INTO cat_estado_civil (codigo, nombre) VALUES
('SOLTERO', 'Soltero(a)'),
('CASADO', 'Casado(a)'),
('DIVORCIADO', 'Divorciado(a)'),
('VIUDO', 'Viudo(a)'),
('UNION_LIBRE', 'Unión Libre');

-- CATÁLOGO ESTADO VIVIENDA
INSERT INTO cat_estado_vivienda (codigo, nombre) VALUES
('PROPIA', 'Propia'),
('ALQUILADA', 'Alquilada'),
('FINANCIADA', 'Financiada'),
('FAMILIAR', 'Familiar');