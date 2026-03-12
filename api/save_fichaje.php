<?php
// api/save_fichaje.php
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);

$empId = $data['empleado_id'] ?? null;
$tipo = $data['tipo'] ?? null;
$fotoData = $data['foto'] ?? null;
$lat = $data['lat'] ?? null;
$lng = $data['lng'] ?? null;

if (!$empId || !$tipo || !$fotoData) {
    die(json_encode(['success' => false, 'error' => 'Missing data']));
}

try {
    // Save Photo
    $img = str_replace('data:image/jpeg;base64,', '', $fotoData);
    $img = str_replace(' ', '+', $img);
    $dataBin = base64_decode($img);

    $fileName = 'ficheo_' . $empId . '_' . time() . '.jpg';
    $filePath = __DIR__ . '/../uploads/' . $fileName;

    if (!file_exists(__DIR__ . '/../uploads')) {
        mkdir(__DIR__ . '/../uploads', 0777, true);
    }

    file_put_contents($filePath, $dataBin);

    // Save to DB
    $stmt = $pdo->prepare("INSERT INTO fichajes (empleado_id, tipo, foto_path, latitud, longitud) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$empId, $tipo, $fileName, $lat, $lng]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>