<?php
// api/get_active_employees.php
require_once 'db.php';
header('Content-Type: application/json');

try {
    // Buscar id de empleados que tuvieron entrada HOY
    // y comprobar si su último registro de hoy no es 'salida'
    $stmt = $pdo->query("
        SELECT empleado_id, nombre, MAX(fecha_hora) as last_action, tipo
        FROM fichajes
        JOIN empleados ON fichajes.empleado_id = empleados.id
        WHERE date(fecha_hora) = date('now', 'localtime')
        GROUP BY empleado_id
    ");

    $fichajes_hoy = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $activos = 0;
    $lista_activos = [];

    foreach ($fichajes_hoy as $row) {
        if ($row['tipo'] === 'entrada') {
            $activos++;
            $lista_activos[] = $row['nombre'];
        }
    }

    echo json_encode(['success' => true, 'activos' => $activos, 'lista' => $lista_activos]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos', 'activos' => 0]);
}
?>