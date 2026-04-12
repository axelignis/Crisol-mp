-- ============================================================
-- CRISOL — Migración 001: Extensiones y configuración base
-- Ejecutar primero. Habilita UUID y funciones criptográficas.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- para búsqueda sin tildes
