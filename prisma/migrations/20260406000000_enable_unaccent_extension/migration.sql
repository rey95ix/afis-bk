-- Habilita la extensión unaccent de PostgreSQL para búsquedas que ignoran tildes/acentos
-- Usada en orden_trabajo.findAll para buscar por código de OT o nombre del cliente
-- sin requerir que el usuario escriba los acentos correctamente.
CREATE EXTENSION IF NOT EXISTS unaccent;
