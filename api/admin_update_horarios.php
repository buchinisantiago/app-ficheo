<?php
// api/admin_update_horarios.php
require_once 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id']) || !isset($data['entrada']) || !isset($data['salida'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing fields']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE empleados SET hora_entrada_esperada = ?, hora_salida_esperada = ? WHERE id = ?");
    $stmt->execute([$data['entrada'], $data['salida'], $data['id']]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
}
?>