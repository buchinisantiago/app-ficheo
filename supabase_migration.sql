-- ============================================
-- APP FICHEO - Supabase Migration Script
-- Ejecutar en: Supabase > SQL Editor > New Query
-- ============================================

-- 1. Tabla de empleados
CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '1234',
    rol TEXT NOT NULL DEFAULT 'empleado',
    hora_entrada_esperada TEXT DEFAULT '09:00',
    hora_salida_esperada TEXT DEFAULT '18:00'
);

-- 2. Tabla de fichajes (incluye tracking y fotos en base64)
CREATE TABLE IF NOT EXISTS fichajes (
    id SERIAL PRIMARY KEY,
    empleado_id INTEGER NOT NULL REFERENCES empleados(id),
    tipo TEXT NOT NULL, -- 'entrada', 'salida', 'tracking', 'tracking_error'
    fecha_hora TIMESTAMPTZ DEFAULT NOW(),
    foto_path TEXT, -- base64 de la foto o mensaje de error para tracking
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION
);

-- 3. Tabla de alertas
CREATE TABLE IF NOT EXISTS registro_alertas (
    id SERIAL PRIMARY KEY,
    empleado_id INTEGER NOT NULL REFERENCES empleados(id),
    fecha DATE NOT NULL,
    tipo_alerta TEXT NOT NULL, -- 'falta_entrada' o 'falta_salida'
    cantidad_enviada INTEGER DEFAULT 0,
    UNIQUE(empleado_id, fecha, tipo_alerta)
);

-- 3b. Tabla de solicitudes de tracking
CREATE TABLE IF NOT EXISTS solicitudes_tracking (
    id SERIAL PRIMARY KEY,
    empleado_id INTEGER NOT NULL REFERENCES empleados(id),
    fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
    completada BOOLEAN DEFAULT FALSE
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_fichajes_empleado ON fichajes(empleado_id);
CREATE INDEX IF NOT EXISTS idx_fichajes_fecha ON fichajes(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_alertas_fecha ON registro_alertas(fecha);

-- 5. Seed: Admin + 10 Técnicos
INSERT INTO empleados (nombre, pin, rol) VALUES ('Administrador', '0000', 'admin');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 1', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 2', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 3', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 4', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 5', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 6', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 7', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 8', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 9', '1234', 'empleado');
INSERT INTO empleados (nombre, pin, rol) VALUES ('Tecnico 10', '1234', 'empleado');
