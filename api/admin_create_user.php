<?php
// api/admin_create_user.php
require_once 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['nombre'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

try {
    // Por defecto el PIN es 1234. Los administradores tendrían que ingresarlo si modificamos el panel, 
    // pero para Técnicos, dejaremos 1234 y ellos se lo cambian.
    $rol = isset($data['rol']) ? $data['rol'] : 'empleado';

    $stmt = $pdo->prepare("INSERT INTO empleados (nombre, pin, rol) VALUES (?, '1234', ?)");
    $stmt->execute([trim($data['nombre']), $rol]);

    echo json_encode([
        'success' => true,
        'id' => $pdo->lastInsertId(),
        'message' => 'Usuario creado exitosamente con PIN 1234'
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
}
?>