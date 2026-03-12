<?php
// api/admin_delete_user.php
require_once 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing ID']);
    exit;
}

try {
    // Si queremos hard delete
    $stmt = $pdo->prepare("DELETE FROM empleados WHERE id = ?");
    $stmt->execute([$data['id']]);

    // Opcional: También podríamos borrar sus fichajes para mantener la BD limpia, 
    // pero usualmente se conservan por histórico legal. Lo dejamos por ahora.

    echo json_encode(['success' => true, 'message' => 'Usuario eliminado']);
} catch (PDOException $e) {
    // Si ha fichado antes, fallará por llave foránea a menos que usemos ON DELETE CASCADE en SQLite.
    // Una opción rápida si esto ocurre es solo cambiar su nombre a "Eliminado".
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se puede eliminar porque tiene historial. Contáctese con soporte o modifique el nombre a INACTIVO.']);
}
?>