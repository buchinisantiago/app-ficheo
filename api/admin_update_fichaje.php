<?php
// api/admin_update_fichaje.php
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);

$id = $data['id'] ?? null;
$tipo = $data['tipo'] ?? null;
$fecha_hora = $data['fecha_hora'] ?? null;

if (!$id || !$tipo || !$fecha_hora) {
    die(json_encode(['success' => false, 'error' => 'Missing data']));
}

try {
    $stmt = $pdo->prepare("UPDATE fichajes SET tipo = ?, fecha_hora = ? WHERE id = ?");
    $stmt->execute([$tipo, $fecha_hora, $id]);
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
