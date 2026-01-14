<?php
declare(strict_types=1);

require __DIR__ . '/config.php';
require __DIR__ . '/db.php';

// CORS (solo si aplica)
if (defined('ENABLE_CORS') && ENABLE_CORS && APP_ENV === 'production') {
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

// API KEY
$clientKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!hash_equals(API_KEY, $clientKey)) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
  exit;
}

// Rate limit (anti spam)
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

// Payload size limit
$raw = file_get_contents('php://input');
if (strlen($raw) > 300000) {
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

// ===== VALIDACIONES ESTRICTAS =====
$nombre   = s($data['nombre_proceso'] ?? null, 255);
$unidad   = s($data['unidad_responsable'] ?? null, 255);
$objetivo = s($data['objetivo_proceso'] ?? null);
$result   = s($data['resultado_final'] ?? null);
$inicio   = s($data['evento_inicio'] ?? null);
$termino  = s($data['evento_termino'] ?? null);
$actores  = s($data['actores'] ?? null);

$instExt  = $data['instituciones_externas'] ?? null;
$instDet  = s($data['instituciones_externas_detalle'] ?? null, 255);

$valid    = $data['validacion'] ?? null;

$fecha    = s($data['fecha_levantamiento'] ?? null, 10);
$unidadP  = s($data['unidad_participante'] ?? null, 255);
$prof     = s($data['profesional_levantamiento'] ?? null, 255);

if ($nombre === null || $unidad === null) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Faltan campos obligatorios: nombre_proceso/unidad_responsable']);
  exit;
}
if ($objetivo === null || $result === null || $inicio === null || $termino === null || $actores === null) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Faltan campos obligatorios: objetivo/resultado/inicio/termino/actores']);
  exit;
}

if (!in_array($instExt, ['si','no'], true)) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Falta instituciones_externas (si/no)']);
  exit;
}
if ($instExt === 'si' && $instDet === null) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Falta instituciones_externas_detalle']);
  exit;
}

if (!in_array($valid, ['si','no'], true)) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Falta validacion (si/no)']);
  exit;
}

if ($fecha === null || $unidadP === null || $prof === null) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Faltan datos de registro: fecha_levantamiento/unidad_participante/profesional_levantamiento']);
  exit;
}

// Almacenamiento
$alm = $data['almacenamiento'] ?? [];
if (!is_array($alm) || count($alm) === 0) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Falta almacenamiento (seleccione al menos uno)']);
  exit;
}
$almOtro = s($data['almacenamiento_otro'] ?? null, 255);
if (in_array('otro', $alm, true) && $almOtro === null) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Falta almacenamiento_otro']);
  exit;
}
$alm_json = json_encode(array_values($alm), JSON_UNESCAPED_UNICODE);

// Actividades (mínimo 1) y ejecutor obligatorio
$acts = $data['actividades'] ?? [];
if (!is_array($acts) || count($acts) === 0) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Falta al menos 1 actividad']);
  exit;
}

$acts_limpias = [];
foreach ($acts as $a) {
  if (!is_array($a)) continue;
  $ord = (int)($a['orden'] ?? 0);
  $desc = s($a['descripcion'] ?? null, 500);
  $ejec = s($a['ejecutor'] ?? null, 255);

  if ($ord <= 0 || $desc === null) continue;
  if ($ejec === null) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'Toda actividad debe incluir ejecutor']);
    exit;
  }

  $acts_limpias[] = ['orden'=>$ord,'descripcion'=>$desc,'ejecutor'=>$ejec];
  if (count($acts_limpias) >= 50) break;
}
if (count($acts_limpias) === 0) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Falta al menos 1 actividad válida']);
  exit;
}

// ===== INSERCIÓN =====
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
    ':objetivo_proceso' => $objetivo,
    ':resultado_final' => $result,
    ':evento_inicio' => $inicio,
    ':evento_termino' => $termino,
    ':actores' => $actores,

    ':instituciones_externas' => $instExt,
    ':instituciones_externas_detalle' => $instDet,

    ':docs_inicio' => s($data['docs_inicio'] ?? null),
    ':docs_durante' => s($data['docs_durante'] ?? null),
    ':momento_expediente' => in_array(($data['momento_expediente'] ?? null), ['inicio','durante','final','no'], true)
      ? $data['momento_expediente'] : null,

    ':almacenamiento_json' => $alm_json,
    ':almacenamiento_otro' => $almOtro,

    ':problemas' => s($data['problemas'] ?? null),
    ':etapas_criticas' => s($data['etapas_criticas'] ?? null),
    ':validacion' => $valid,
    ':obs_adicionales' => s($data['obs_adicionales'] ?? null),

    ':fecha_levantamiento' => $fecha,
    ':unidad_participante' => $unidadP,
    ':profesional_levantamiento' => $prof,
    ':contacto_validacion' => s($data['contacto_validacion'] ?? null, 255),
  ]);

  $procesoId = (int)$pdo->lastInsertId();

  $stmtAct = $pdo->prepare("
    INSERT INTO actividades (proceso_id, orden, descripcion, ejecutor)
    VALUES (:pid, :ord, :desc, :ejec)
  ");

  foreach ($acts_limpias as $a) {
    $stmtAct->execute([
      ':pid' => $procesoId,
      ':ord' => $a['orden'],
      ':desc' => $a['descripcion'],
      ':ejec' => $a['ejecutor'],
    ]);
  }

  $pdo->commit();
  echo json_encode(['ok' => true, 'id' => $procesoId], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Save failed'], JSON_UNESCAPED_UNICODE);
}
