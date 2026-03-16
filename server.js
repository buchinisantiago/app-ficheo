// server.js - APP Ficheo Backend (Node.js/Express + PostgreSQL/Supabase)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 10mb para fotos base64

// PostgreSQL connection pool (Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname), {
    extensions: ['html']
}));

// Auto-crear tabla de tracking si no existe en producción
pool.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_tracking (
        id SERIAL PRIMARY KEY,
        empleado_id INTEGER NOT NULL REFERENCES empleados(id),
        fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
        completada BOOLEAN DEFAULT FALSE
    )
`).catch(err => console.error("Error creating solicitudes tabl:", err));

// ============================================
// API ENDPOINTS
// ============================================

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    const { id, pin } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, nombre, rol FROM empleados WHERE id = $1 AND pin = $2',
            [id, pin]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// --- GET EMPLOYEES (para login dropdown) ---
app.get('/api/get_employees', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre FROM empleados ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        res.json({ error: err.message });
    }
});

// --- GET FICHAJES (historial) ---
app.get('/api/get_fichajes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT f.*, e.nombre 
            FROM fichajes f 
            JOIN empleados e ON f.empleado_id = e.id 
            ORDER BY f.fecha_hora DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.json({ error: err.message });
    }
});

// --- SAVE FICHAJE (entrada/salida con foto base64) ---
app.post('/api/save_fichaje', async (req, res) => {
    const { empleado_id, tipo, foto, lat, lng } = req.body;

    if (!empleado_id || !tipo || !foto) {
        return res.json({ success: false, error: 'Missing data' });
    }

    try {
        // Guardar foto directamente como base64 en la DB
        await pool.query(
            'INSERT INTO fichajes (empleado_id, tipo, foto_path, latitud, longitud) VALUES ($1, $2, $3, $4, $5)',
            [empleado_id, tipo, foto, lat, lng]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// --- SAVE TRACKING (ubicación periódica en background) ---
app.post('/api/save_tracking', async (req, res) => {
    const { empleado_id, status, lat, lng, error: errorMsg } = req.body;

    if (!empleado_id || !status) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const tipo = (status === 'error') ? 'tracking_error' : 'tracking';
    const fotoPath = (status === 'error') ? `Error: ${errorMsg}` : null;

    try {
        const result = await pool.query(
            'INSERT INTO fichajes (empleado_id, tipo, foto_path, latitud, longitud) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [empleado_id, tipo, fotoPath, lat || null, lng || null]
        );
        res.json({ success: true, id: result.rows[0].id, message: 'Tracking registrado' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Database error', details: err.message });
    }
});

// --- SAVE PIN (cambiar contraseña del empleado) ---
app.post('/api/save_pin', async (req, res) => {
    const { id, new_pin } = req.body;

    if (!id || !new_pin) {
        return res.status(400).json({ success: false, error: 'Missing ID or PIN' });
    }

    if (!/^\d{4}$/.test(new_pin)) {
        return res.status(400).json({ success: false, error: 'Invalid PIN format' });
    }

    try {
        await pool.query('UPDATE empleados SET pin = $1 WHERE id = $2', [new_pin, id]);
        res.json({ success: true, message: 'PIN actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error de base de datos' });
    }
});

// --- GET ACTIVE EMPLOYEES (quiénes están trabajando ahora) ---
app.get('/api/get_active_employees', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT ON (f.empleado_id) f.empleado_id, e.nombre, f.fecha_hora as last_action, f.tipo
            FROM fichajes f
            JOIN empleados e ON f.empleado_id = e.id
            WHERE DATE(f.fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE
            AND f.tipo IN ('entrada', 'salida')
            ORDER BY f.empleado_id, f.fecha_hora DESC
        `);

        let activos = 0;
        const lista = [];

        result.rows.forEach(row => {
            if (row.tipo === 'entrada') {
                activos++;
                lista.push({ id: row.empleado_id, nombre: row.nombre });
            }
        });

        res.json({ success: true, activos, lista });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error de base de datos', activos: 0 });
    }
});

// --- ADMIN REQUEST TRACKING ---
app.post('/api/admin_request_tracking', async (req, res) => {
    const { empleado_id } = req.body;
    if (!empleado_id) return res.json({ success: false, error: 'Missing employee ID' });
    
    try {
        await pool.query('INSERT INTO solicitudes_tracking (empleado_id, completada) VALUES ($1, false)', [empleado_id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// --- CHECK TRACKING REQUESTS (Polling front-end) ---
app.post('/api/check_tracking_requests', async (req, res) => {
    const { empleado_id } = req.body;
    if (!empleado_id) return res.json({ success: false, error: 'Missing employee ID' });

    try {
        const result = await pool.query('SELECT id FROM solicitudes_tracking WHERE empleado_id = $1 AND completada = false LIMIT 1', [empleado_id]);
        if (result.rows.length > 0) {
            const reqId = result.rows[0].id;
            await pool.query('UPDATE solicitudes_tracking SET completada = true WHERE id = $1', [reqId]);
            res.json({ success: true, has_request: true });
        } else {
            res.json({ success: true, has_request: false });
        }
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// --- CHECK ALERTS (motor de alertas de fichaje) ---
app.get('/api/check_alerts', async (req, res) => {
    // Verificar día de semana (Lun-Vie)
    const now = new Date();
    const day = now.getDay(); // 0=Dom, 6=Sab
    if (day === 0 || day === 6) {
        return res.json({ success: true, alertas_procesadas: 0, msg: 'Fin de semana ignorado' });
    }

    const hoy = now.toISOString().split('T')[0];
    // Hora actual en formato HH:MM (Argentina)
    const ahora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });

    let alertasProcesadas = 0;

    try {
        // Obtener técnicos
        const tecnicos = await pool.query(
            "SELECT id, nombre, hora_entrada_esperada, hora_salida_esperada FROM empleados WHERE rol != 'admin'"
        );

        for (const t of tecnicos.rows) {
            // Fichajes de hoy
            const fichajes = await pool.query(
                "SELECT tipo FROM fichajes WHERE empleado_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE",
                [t.id]
            );
            const tiposHoy = fichajes.rows.map(f => f.tipo);
            const tieneEntrada = tiposHoy.includes('entrada');
            const tieneSalida = tiposHoy.includes('salida');

            const horaEnt = t.hora_entrada_esperada || '09:00';
            const horaSal = t.hora_salida_esperada || '18:00';

            // Falta entrada
            if (!tieneEntrada && ahora > horaEnt) {
                alertasProcesadas += await procesarInfraccion(t.id, hoy, 'falta_entrada');
            }
            // Falta salida
            if (tieneEntrada && !tieneSalida && ahora > horaSal) {
                alertasProcesadas += await procesarInfraccion(t.id, hoy, 'falta_salida');
            }
        }

        res.json({ success: true, alertas_procesadas: alertasProcesadas });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error DB' });
    }
});

async function procesarInfraccion(empId, fecha, tipo) {
    const existing = await pool.query(
        'SELECT cantidad_enviada FROM registro_alertas WHERE empleado_id = $1 AND fecha = $2 AND tipo_alerta = $3',
        [empId, fecha, tipo]
    );

    if (existing.rows.length === 0) {
        await pool.query(
            'INSERT INTO registro_alertas (empleado_id, fecha, tipo_alerta, cantidad_enviada) VALUES ($1, $2, $3, 1)',
            [empId, fecha, tipo]
        );
        return 1;
    } else {
        const cant = existing.rows[0].cantidad_enviada;
        if (cant < 3) {
            await pool.query(
                'UPDATE registro_alertas SET cantidad_enviada = cantidad_enviada + 1 WHERE empleado_id = $1 AND fecha = $2 AND tipo_alerta = $3',
                [empId, fecha, tipo]
            );
            return 1;
        }
    }
    return 0;
}

// --- ADMIN: ADD FICHAJE MANUAL ---
app.post('/api/admin_add_fichaje', async (req, res) => {
    const { empleado_id, tipo, fecha, hora } = req.body;

    if (!empleado_id || !tipo || !fecha || !hora) {
        return res.json({ success: false, error: 'Missing required data' });
    }

    try {
        // Combinar fecha y hora usando la zona horaria local simulada o en UTC.
        // Asume hora local para "fecha_hora" field en PostgreSQL (que suele ser timestamptz o timestamp)
        const fechaHoraStr = `${fecha} ${hora}:00`;
        const foto_path = '✍️ Manual';
        await pool.query(
            'INSERT INTO fichajes (empleado_id, tipo, fecha_hora, foto_path) VALUES ($1, $2, $3, $4)',
            [empleado_id, tipo, fechaHoraStr, foto_path]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// --- ADMIN: UPDATE FICHAJE ---
app.post('/api/admin_update_fichaje', async (req, res) => {
    const { id, tipo, fecha_hora } = req.body;

    if (!id || !tipo || !fecha_hora) {
        return res.json({ success: false, error: 'Missing required data' });
    }

    try {
        // Reemplazar la T por espacio si viene del input datetime-local
        let dtStr = fecha_hora.replace('T', ' ');
        if (dtStr.length === 16) dtStr += ':00'; // add seconds if missing

        await pool.query(
            'UPDATE fichajes SET tipo = $1, fecha_hora = $2 WHERE id = $3',
            [tipo, dtStr, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// --- ADMIN: DELETE FICHAJE ---
app.post('/api/admin_delete_fichaje', async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.json({ success: false, error: 'Missing id' });
    }

    try {
        await pool.query('DELETE FROM fichajes WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});


// --- ADMIN: GET USERS ---
app.get('/api/admin_get_users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombre, rol, hora_entrada_esperada, hora_salida_esperada FROM empleados ORDER BY rol, id'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error de base de datos' });
    }
});

// --- ADMIN: CREATE USER ---
app.post('/api/admin_create_user', async (req, res) => {
    const { nombre, rol } = req.body;

    if (!nombre) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const result = await pool.query(
            "INSERT INTO empleados (nombre, pin, rol) VALUES ($1, '1234', $2) RETURNING id",
            [nombre.trim(), rol || 'empleado']
        );
        res.json({ success: true, id: result.rows[0].id, message: 'Usuario creado exitosamente con PIN 1234' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error de base de datos' });
    }
});

// --- ADMIN: UPDATE USER ---
app.post('/api/admin_update_user', async (req, res) => {
    const { id, nombre, action } = req.body;

    if (!id || !nombre) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        if (action === 'reset_pin') {
            await pool.query("UPDATE empleados SET nombre = $1, pin = '1234' WHERE id = $2", [nombre.trim(), id]);
            res.json({ success: true, message: 'Usuario actualizado y PIN reseteado a 1234' });
        } else {
            await pool.query('UPDATE empleados SET nombre = $1 WHERE id = $2', [nombre.trim(), id]);
            res.json({ success: true, message: 'Usuario actualizado' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error de base de datos' });
    }
});

// --- ADMIN: DELETE USER ---
app.post('/api/admin_delete_user', async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing ID' });
    }

    try {
        await pool.query('DELETE FROM empleados WHERE id = $1', [id]);
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'No se puede eliminar porque tiene historial. Contáctese con soporte o modifique el nombre a INACTIVO.'
        });
    }
});

// --- ADMIN: UPDATE HORARIOS ---
app.post('/api/admin_update_horarios', async (req, res) => {
    const { id, entrada, salida } = req.body;

    if (!id || !entrada || !salida) {
        return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    try {
        await pool.query(
            'UPDATE empleados SET hora_entrada_esperada = $1, hora_salida_esperada = $2 WHERE id = $3',
            [entrada, salida, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error de base de datos' });
    }
});

// --- ADMIN: GET ALERT LOGS ---
app.get('/api/admin_get_alert_logs', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ra.id, e.nombre, ra.tipo_alerta, ra.cantidad_enviada 
            FROM registro_alertas ra
            JOIN empleados e ON ra.empleado_id = e.id
            WHERE ra.fecha = CURRENT_DATE
            ORDER BY ra.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json([]);
    }
});

// --- LIMPIEZA AUTOMÁTICA: borrar fichajes > 30 días ---
app.get('/api/cleanup', async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM fichajes WHERE fecha_hora < NOW() - INTERVAL '30 days'"
        );
        const alertResult = await pool.query(
            "DELETE FROM registro_alertas WHERE fecha < CURRENT_DATE - INTERVAL '30 days'"
        );
        res.json({
            success: true,
            fichajes_eliminados: result.rowCount,
            alertas_eliminadas: alertResult.rowCount
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- SERVIR FOTOS BASE64 como imagen (para el admin panel) ---
app.get('/api/foto/:fichajeId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT foto_path FROM fichajes WHERE id = $1',
            [req.params.fichajeId]
        );
        if (result.rows.length === 0 || !result.rows[0].foto_path) {
            return res.status(404).send('Not found');
        }

        const base64Data = result.rows[0].foto_path;

        // Si es base64 data URI, extraer solo la data
        if (base64Data.startsWith('data:image')) {
            const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
            if (matches) {
                const imgBuffer = Buffer.from(matches[2], 'base64');
                res.set('Content-Type', `image/${matches[1]}`);
                return res.send(imgBuffer);
            }
        }

        // Si es un nombre de archivo viejo (no base64), devolver 404
        res.status(404).send('Photo not available');
    } catch (err) {
        res.status(500).send('Error');
    }
});

// Catch-all para SPA (admin/index.html)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 App Ficheo corriendo en http://localhost:${PORT}`);
});
