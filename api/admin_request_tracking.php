<?php
// api/admin_request_tracking.php
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$empId = $data['empleado_id'] ?? null;

if (!$empId) {
    die(json_encode(['success' => false, 'error' => 'No employee ID provided']));
}

try {
    $stmt = $pdo->prepare("INSERT INTO solicitudes_tracking (empleado_id, completada) VALUES (?, 0)");
    $stmt->execute([$empId]);
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
