<?php
// api/check_tracking_requests.php
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$empId = $data['empleado_id'] ?? null;

if (!$empId) {
    die(json_encode(['success' => false, 'error' => 'No employee ID provided']));
}

try {
    // Check if there are any incomplete tracking requests for this user
    $stmt = $pdo->prepare("SELECT id FROM solicitudes_tracking WHERE empleado_id = ? AND completada = 0");
    $stmt->execute([$empId]);
    $request = $stmt->fetch();

    if ($request) {
        // Mark as completed right away so we don't ask multiple times
        $updateStmt = $pdo->prepare("UPDATE solicitudes_tracking SET completada = 1 WHERE id = ?");
        $updateStmt->execute([$request['id']]);
        
        echo json_encode(['success' => true, 'has_request' => true]);
    } else {
        echo json_encode(['success' => true, 'has_request' => false]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
