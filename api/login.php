<?php
// api/login.php
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$id = $data['id'] ?? null;
$pin = $data['pin'] ?? null;

try {
    $stmt = $pdo->prepare("SELECT id, nombre, rol FROM empleados WHERE id = ? AND pin = ?");
    $stmt->execute([$id, $pin]);
    $user = $stmt->fetch();

    if ($user) {
        echo json_encode(['success' => true, 'user' => $user]);
    } else {
        echo json_encode(['success' => false]);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>