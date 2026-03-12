<?php
// api/check_alerts.php
require_once 'db.php';
header('Content-Type: application/json');

// --- 1. Verificación de Día de la Semana (Lunes a Viernes) ---
$diaSemana = (int) date('w'); // 0 (Dom) a 6 (Sab)
if ($diaSemana == 0 || $diaSemana == 6) {
    // Es fin de semana, no se ejecutan alertas según requerimiento
    echo json_encode(['success' => true, 'alertas_procesadas' => 0, 'msg' => 'Fin de semana ignorado']);
    exit;
}

$alertasProcesadas = 0;
$ahora = date('H:i');
$hoy = date('Y-m-d');

try {
    // --- 2. Listar todos los técnicos y sus horarios ---
    $stmt = $pdo->query("SELECT id, nombre, hora_entrada_esperada, hora_salida_esperada FROM empleados WHERE rol != 'admin'");
    $tecnicos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // --- 3. Buscar fichajes de hoy ---
    $stmtFichajes = $pdo->prepare("SELECT tipo FROM fichajes WHERE empleado_id = ? AND date(fecha_hora) = ?");

    foreach ($tecnicos as $t) {
        $stmtFichajes->execute([$t['id'], $hoy]);
        $fichajesHoy = $stmtFichajes->fetchAll(PDO::FETCH_COLUMN);

        $tieneEntrada = in_array('entrada', $fichajesHoy);
        $tieneSalida = in_array('salida', $fichajesHoy);

        $horaEntEscrita = $t['hora_entrada_esperada'] ?: '09:00';
        $horaSalEscrita = $t['hora_salida_esperada'] ?: '18:00';

        // COMPROBAR: Faltó a la Entrada
        if (!$tieneEntrada && $ahora > $horaEntEscrita) {
            $alertasProcesadas += procesarInfraccion($pdo, $t['id'], $hoy, 'falta_entrada');
        }

        // COMPROBAR: Faltó a la Salida (Opcional, si hizo entrada pero ya hace rato se pasó la de salida)
        if ($tieneEntrada && !$tieneSalida && $ahora > $horaSalEscrita) {
            $alertasProcesadas += procesarInfraccion($pdo, $t['id'], $hoy, 'falta_salida');
        }
    }

    echo json_encode(['success' => true, 'alertas_procesadas' => $alertasProcesadas]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error DB']);
}

// Función auxiliar para registrar la infracción respetando el maximo de 3 envios 
function procesarInfraccion($pdo, $empId, $fecha, $tipo)
{
    // Buscar si ya existe la alerta hoy
    $stmt = $pdo->prepare("SELECT cantidad_enviada FROM registro_alertas WHERE empleado_id = ? AND fecha = ? AND tipo_alerta = ?");
    $stmt->execute([$empId, $fecha, $tipo]);
    $registro = $stmt->fetch();

    if (!$registro) {
        // Primera vez que se detecta hoy
        $pdo->prepare("INSERT INTO registro_alertas (empleado_id, fecha, tipo_alerta, cantidad_enviada) VALUES (?, ?, ?, 1)")
            ->execute([$empId, $fecha, $tipo]);
        return 1;
    } else {
        $cant = (int) $registro['cantidad_enviada'];
        if ($cant < 3) {
            // Aún podemos enviar/escalar la alerta
            $pdo->prepare("UPDATE registro_alertas SET cantidad_enviada = cantidad_enviada + 1 WHERE empleado_id = ? AND fecha = ? AND tipo_alerta = ?")
                ->execute([$empId, $fecha, $tipo]);
            return 1;
        }
    }
    // Si ya tiene 3 o más, no cuenta como procesada nueva
    return 0;
}
?>