<?php
// api/save_pin.php
require_once 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id']) || !isset($data['new_pin'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing ID or PIN']);
    exit;
}

// Básico validación (asegurarse 4 dígitos)
if (!preg_match('/^\d{4}$/', $data['new_pin'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid PIN format']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE empleados SET pin = ? WHERE id = ?");
    $stmt->execute([$data['new_pin'], $data['id']]);

    echo json_encode(['success' => true, 'message' => 'PIN actualizado correctamente']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
}
?>