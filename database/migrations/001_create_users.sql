CREATE DATABASE IF NOT EXISTS yahweh_rohi_inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE yahweh_rohi_inventory;

CREATE TABLE usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  usuario VARCHAR(60) NOT NULL,
  correo VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin', 'supervisor', 'cajero', 'bodega', 'consulta') NOT NULL DEFAULT 'consulta',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acceso DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_usuario (usuario),
  UNIQUE KEY uq_usuarios_correo (correo),
  KEY idx_usuarios_rol (rol),
  KEY idx_usuarios_activo (activo)
);
