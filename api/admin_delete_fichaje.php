<?php
// api/admin_delete_fichaje.php
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$id = $data['id'] ?? null;

if (!$id) {
    die(json_encode(['success' => false, 'error' => 'No ID provided']));
}

try {
    $stmt = $pdo->prepare("DELETE FROM fichajes WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
