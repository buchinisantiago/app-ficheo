<?php
// api/admin_update_user.php
require_once 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id']) || !isset($data['nombre'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

try {
    // Si viene la acción de reseteo, reseteamos a PIN '1234'
    if (isset($data['action']) && $data['action'] === 'reset_pin') {
        $stmt = $pdo->prepare("UPDATE empleados SET nombre = ?, pin = '1234' WHERE id = ?");
        $stmt->execute([trim($data['nombre']), $data['id']]);
        echo json_encode(['success' => true, 'message' => 'Usuario actualizado y PIN reseteado a 1234']);
    } else {
        $stmt = $pdo->prepare("UPDATE empleados SET nombre = ? WHERE id = ?");
        $stmt->execute([trim($data['nombre']), $data['id']]);
        echo json_encode(['success' => true, 'message' => 'Usuario actualizado']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
}
?>