<?php
// api/save_tracking.php
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['empleado_id']) || !isset($data['status'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$empleado_id = $data['empleado_id'];
$status = $data['status'];
$foto_path = null; // Background tracking no usa foto

// Determinar el tipo para la BD
$tipo = ($status === 'error') ? 'tracking_error' : 'tracking';
$latitud = isset($data['lat']) ? $data['lat'] : null;
$longitud = isset($data['lng']) ? $data['lng'] : null;
$error_msg = isset($data['error']) ? $data['error'] : null;

try {
    // Si hay mensaje de error, lo guardamos temporalmente en foto_path (ya que es varchar y no es usado para foto aquí)
    $stmt = $pdo->prepare("INSERT INTO fichajes (empleado_id, tipo, foto_path, latitud, longitud) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        $empleado_id,
        $tipo,
        ($status === 'error') ? "Error: " . $error_msg : null,
        $latitud,
        $longitud
    ]);

    echo json_encode([
        'success' => true,
        'id' => $pdo->lastInsertId(),
        'message' => 'Tracking registrado'
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error', 'details' => $e->getMessage()]);
}
?>