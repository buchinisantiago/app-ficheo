<?php
// api/admin_get_users.php
require_once 'db.php';
header('Content-Type: application/json');

try {
    // Retornamos todos los empleados asegurándonos de no enviar las contraseñas al frontend por seguridad,
    // salvo que en este diseño simple se requiera. Aquí las omitiremos para la tabla general.
    $stmt = $pdo->query("SELECT id, nombre, rol FROM empleados ORDER BY rol, id");
    $users = $stmt->fetchAll();

    echo json_encode($users);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error de base de datos']);
}
?>