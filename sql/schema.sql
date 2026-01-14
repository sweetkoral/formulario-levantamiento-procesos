CREATE TABLE IF NOT EXISTS procesos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre_proceso VARCHAR(255) NULL,
  unidad_responsable VARCHAR(255) NULL,
  objetivo_proceso TEXT NULL,
  resultado_final TEXT NULL,
  evento_inicio TEXT NULL,
  evento_termino TEXT NULL,
  actores TEXT NULL,
  instituciones_externas ENUM('si','no') NULL,
  instituciones_externas_detalle VARCHAR(255) NULL,
  docs_inicio TEXT NULL,
  docs_durante TEXT NULL,
  momento_expediente ENUM('inicio','durante','final','no') NULL,
  almacenamiento_json TEXT NULL,
  almacenamiento_otro VARCHAR(255) NULL,
  problemas TEXT NULL,
  etapas_criticas TEXT NULL,
  validacion ENUM('si','no') NULL,
  obs_adicionales TEXT NULL,
  fecha_levantamiento DATE NULL,
  unidad_participante VARCHAR(255) NULL,
  profesional_levantamiento VARCHAR(255) NULL,
  contacto_validacion VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS actividades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proceso_id INT NOT NULL,
  orden INT NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  ejecutor VARCHAR(255) NULL,
  CONSTRAINT fk_actividades_proceso
    FOREIGN KEY (proceso_id) REFERENCES procesos(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
