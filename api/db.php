<?php
// api/db.php - Database connection and initialization

$db_path = __DIR__ . '/../data/ficheo.sqlite';
$data_dir = __DIR__ . '/../data';

if (!file_exists($data_dir)) {
    mkdir($data_dir, 0777, true);
}

try {
    $pdo = new PDO("sqlite:$db_path");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Initialize tables
    $pdo->exec("CREATE TABLE IF NOT EXISTS empleados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        pin TEXT NOT NULL,
        rol TEXT DEFAULT 'empleado'
    )");

    // Try to add rol column if it doesn't exist (for existing DBs)
    try {
        $pdo->exec("ALTER TABLE empleados ADD COLUMN rol TEXT DEFAULT 'empleado'");
    } catch (Exception $e) { /* Column might already exist */
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS ficha_empleados (
        -- Este es un backup si quisieramos migrar la tabla
        placeholder INTEGER
    )");

    // Añadir de forma segura las columnas nuevas a empleados (SQLite no soporta ADD COLUMN IF NOT EXISTS fácil, usamos un truco)
    $columns = $pdo->query("PRAGMA table_info(empleados)")->fetchAll(PDO::FETCH_ASSOC);
    $columnNames = array_column($columns, 'name');

    if (!in_array('hora_entrada_esperada', $columnNames)) {
        $pdo->exec("ALTER TABLE empleados ADD COLUMN hora_entrada_esperada TEXT DEFAULT '09:00'");
    }
    if (!in_array('hora_salida_esperada', $columnNames)) {
        $pdo->exec("ALTER TABLE empleados ADD COLUMN hora_salida_esperada TEXT DEFAULT '18:00'");
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS registro_alertas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id INTEGER NOT NULL,
        fecha DATE NOT NULL,
        tipo_alerta TEXT NOT NULL, -- 'falta_entrada' o 'falta_salida'
        cantidad_enviada INTEGER DEFAULT 0,
        FOREIGN KEY (empleado_id) REFERENCES empleados(id),
        UNIQUE(empleado_id, fecha, tipo_alerta)
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS fichajes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id INTEGER NOT NULL,
        tipo TEXT NOT NULL, -- 'entrada' or 'salida'
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        foto_path TEXT,
        latitud REAL,
        longitud REAL,
        FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS solicitudes_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id INTEGER NOT NULL,
        fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
        completada INTEGER DEFAULT 0,
        FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    )");

    // Seed a default employee if none exist
    $stmt = $pdo->query("SELECT COUNT(*) FROM empleados");
    if ($stmt->fetchColumn() == 0) {
        // Cargar Admin
        $pdo->exec("INSERT INTO empleados (nombre, pin, rol) VALUES ('Administrador', '0000', 'admin')");

        // Cargar Técnicos 1 al 10 con PIN 1234
        for ($i = 1; $i <= 10; $i++) {
            $nombre = "Tecnico " . $i;
            // Se usa prepare/execute por buena práctica, aunque sean ints hardcodeados
            $stmtInsert = $pdo->prepare("INSERT INTO empleados (nombre, pin, rol) VALUES (?, '1234', 'empleado')");
            $stmtInsert->execute([$nombre]);
        }
    } else {
        // Ensure Admin has the correct role if it already exists
        $pdo->exec("UPDATE empleados SET rol = 'admin' WHERE nombre = 'Administrador'");

        // Eliminar 'Empleado Demo' si existe, para limpiar la base (Opcional pero solicitado por el paso a producción real)
        $pdo->exec("DELETE FROM empleados WHERE nombre = 'Empleado Demo'");
    }

} catch (PDOException $e) {
    die("Database error: " . $e->getMessage());
}
?>