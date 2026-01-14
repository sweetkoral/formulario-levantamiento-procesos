<?php
declare(strict_types=1);

/**
 * Entorno: 'local' | 'production'
 */
define('APP_ENV', 'local'); // ← en cPanel: 'production'

/**
 * API Key (pon una clave larga y aleatoria)
 * - En local puede ser la misma o distinta.
 * - En producción debe ser distinta y secreta.
 */
define('API_KEY', 'Ser0921*/');

/**
 * Rate limit (por sesión)
 */
define('RATE_LIMIT_PER_MIN', APP_ENV === 'production' ? 20 : 1000);

/**
 * CORS (solo si el frontend está en otro dominio)
 * Si todo está en el mismo dominio, puedes dejarlo igual.
 */
define('ENABLE_CORS', false); // true solo si tu front y API están en dominios distintos
define('ALLOWED_ORIGIN', 'https://tudominio.cl'); // si ENABLE_CORS=true
