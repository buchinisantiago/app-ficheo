<?php
// api/get_fichajes.php
require_once 'db.php';

try {
    $stmt = $pdo->query("
        SELECT f.*, e.nombre 
        FROM fichajes f 
        JOIN empleados e ON f.empleado_id = e.id 
        ORDER BY f.fecha_hora DESC
    ");
    echo json_encode($stmt->fetchAll());
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>