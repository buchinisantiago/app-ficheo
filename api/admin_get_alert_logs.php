<?php
// api/admin_get_alert_logs.php
require_once 'db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("
        SELECT ra.id, e.nombre, ra.tipo_alerta, ra.cantidad_enviada 
        FROM registro_alertas ra
        JOIN empleados e ON ra.empleado_id = e.id
        WHERE ra.fecha = date('now', 'localtime')
        ORDER BY ra.id DESC
    ");

    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($logs);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([]);
}
?>