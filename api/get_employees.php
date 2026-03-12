<?php
// api/get_employees.php
require_once 'db.php';

try {
    $stmt = $pdo->query("SELECT id, nombre FROM empleados ORDER BY nombre ASC");
    echo json_encode($stmt->fetchAll());
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>