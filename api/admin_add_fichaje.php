<?php
// api/admin_add_fichaje.php
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);

$empId = $data['empleado_id'] ?? null;
$tipo = $data['tipo'] ?? null;
$fecha = $data['fecha'] ?? null;
$hora = $data['hora'] ?? null;

if (!$empId || !$tipo || !$fecha || !$hora) {
    die(json_encode(['success' => false, 'error' => 'Missing data']));
}

try {
    // Combinar fecha y hora para el campo fecha_hora TIMESTAMP
    // Formato de PostgreSQL TIMESTAMPTZ esperado o YYYY-MM-DD HH:MM:SS
    $fecha_hora_str = $fecha . ' ' . $hora . ':00'; // Formato asumiendo hora es HH:MM
    $fecha_hora_obj = new DateTime($fecha_hora_str);
    $fecha_hora_format = $fecha_hora_obj->format('Y-m-d H:i:s');

    // Save to DB
    // Para fichajes manuales, no hay GPS ni foto, indicamos manual
    $lat = null;
    $lng = null;
    $fotoPath = 'admin_manual_entry'; // un indicador de que fue manual

    // Como fecha_hora tiene default NOW() pero aquí forzamos una hora:
    $stmt = $pdo->prepare("INSERT INTO fichajes (empleado_id, tipo, foto_path, latitud, longitud, fecha_hora) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$empId, $tipo, $fotoPath, $lat, $lng, $fecha_hora_format]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
