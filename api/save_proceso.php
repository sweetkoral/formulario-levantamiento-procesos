<?php
declare(strict_types=1);

require __DIR__ . '/config.php';
require __DIR__ . '/db.php';

/** CORS (solo si corresponde) */
if (ENABLE_CORS && APP_ENV === 'production') {
  header("Access-Control-Allow-Origin: " . ALLOWED_ORIGIN);
  header("Access-Control-Allow-Headers: Content-Type, X-API-KEY");
  header("Access-Control-Allow-Methods: POST, OPTIONS");
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

/** API KEY */
$clientKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!hash_equals(API_KEY, $clientKey)) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
  exit;
}

/** Rate limit por sesión (anti spam básico) */
session_start();
$now = time();
$_SESSION['hits'] = $_SESSION['hits'] ?? [];
$_SESSION['hits'] = array_filter($_SESSION['hits'], fn($t) => $t > $now - 60);

if (count($_SESSION['hits']) >= RATE_LIMIT_PER_MIN) {
  http_response_code(429);
  echo json_encode(['ok'=>false,'error'=>'Too Many Requests']);
  exit;
}
$_SESSION['hits'][] = $now;

/** Payload size limit */
$raw = file_get_contents('php://input');
if (strlen($raw) > 300000) { // 300 KB
  http_response_code(413);
  echo json_encode(['ok' => false, 'error' => 'Payload too large']);
  exit;
}

$data = json_decode($raw, true);
if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
  exit;
}

function s($v, $max = 100000) {
  if ($v === null) return null;
  $t = trim((string)$v);
  if ($t === '') return null;
  return mb_substr($t, 0, $max);
}

$nombre = s($data['nombre_proceso'] ?? null, 255);
$unidad = s($data['unidad_responsable'] ?? null, 255);
if ($nombre === null || $unidad === null) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Faltan campos obligatorios (nombre_proceso, unidad_responsable)']);
  exit;
}

$actividades = $data['actividades'] ?? [];
if (!is_array($actividades)) $actividades = [];

$almacenamiento = $data['almacenamiento'] ?? [];
if (!is_array($almacenamiento)) $almacenamiento = [];
$almacenamiento_json = json_encode(array_values($almacenamiento), JSON_UNESCAPED_UNICODE);

try {
  $pdo->beginTransaction();

  $stmt = $pdo->prepare("
    INSERT INTO procesos (
      nombre_proceso, unidad_responsable, objetivo_proceso, resultado_final,
      evento_inicio, evento_termino, actores,
      instituciones_externas, instituciones_externas_detalle,
      docs_inicio, docs_durante, momento_expediente,
      almacenamiento_json, almacenamiento_otro,
      problemas, etapas_criticas, validacion, obs_adicionales,
      fecha_levantamiento, unidad_participante, profesional_levantamiento, contacto_validacion
    ) VALUES (
      :nombre_proceso, :unidad_responsable, :objetivo_proceso, :resultado_final,
      :evento_inicio, :evento_termino, :actores,
      :instituciones_externas, :instituciones_externas_detalle,
      :docs_inicio, :docs_durante, :momento_expediente,
      :almacenamiento_json, :almacenamiento_otro,
      :problemas, :etapas_criticas, :validacion, :obs_adicionales,
      :fecha_levantamiento, :unidad_participante, :profesional_levantamiento, :contacto_validacion
    )
  ");

  $stmt->execute([
    ':nombre_proceso' => $nombre,
    ':unidad_responsable' => $unidad,
    ':objetivo_proceso' => s($data['objetivo_proceso'] ?? null),
    ':resultado_final' => s($data['resultado_final'] ?? null),
    ':evento_inicio' => s($data['evento_inicio'] ?? null),
    ':evento_termino' => s($data['evento_termino'] ?? null),
    ':actores' => s($data['actores'] ?? null),

    ':instituciones_externas' => in_array(($data['instituciones_externas'] ?? null), ['si','no'], true) ? $data['instituciones_externas'] : null,
    ':instituciones_externas_detalle' => s($data['instituciones_externas_detalle'] ?? null, 255),

    ':docs_inicio' => s($data['docs_inicio'] ?? null),
    ':docs_durante' => s($data['docs_durante'] ?? null),
    ':momento_expediente' => in_array(($data['momento_expediente'] ?? null), ['inicio','durante','final','no'], true) ? $data['momento_expediente'] : null,

    ':almacenamiento_json' => $almacenamiento_json,
    ':almacenamiento_otro' => s($data['almacenamiento_otro'] ?? null, 255),

    ':problemas' => s($data['problemas'] ?? null),
    ':etapas_criticas' => s($data['etapas_criticas'] ?? null),
    ':validacion' => in_array(($data['validacion'] ?? null), ['si','no'], true) ? $data['validacion'] : null,
    ':obs_adicionales' => s($data['obs_adicionales'] ?? null),

    ':fecha_levantamiento' => s($data['fecha_levantamiento'] ?? null, 10),
    ':unidad_participante' => s($data['unidad_participante'] ?? null, 255),
    ':profesional_levantamiento' => s($data['profesional_levantamiento'] ?? null, 255),
    ':contacto_validacion' => s($data['contacto_validacion'] ?? null, 255),
  ]);

  $procesoId = (int)$pdo->lastInsertId();

  $stmtAct = $pdo->prepare("
    INSERT INTO actividades (proceso_id, orden, descripcion, ejecutor)
    VALUES (:pid, :ord, :desc, :ejec)
  ");

  $count = 0;
  foreach ($actividades as $a) {
    if (!is_array($a)) continue;

    $ord = (int)($a['orden'] ?? 0);
    $desc = s($a['descripcion'] ?? null, 500);
    $ejec = s($a['ejecutor'] ?? null, 255);

    if ($ord <= 0 || $desc === null) continue;

    $stmtAct->execute([
      ':pid' => $procesoId,
      ':ord' => $ord,
      ':desc' => $desc,
      ':ejec' => $ejec,
    ]);

    $count++;
    if ($count >= 50) break;
  }

  $pdo->commit();
  echo json_encode(['ok' => true, 'id' => $procesoId], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Save failed'], JSON_UNESCAPED_UNICODE);
}
