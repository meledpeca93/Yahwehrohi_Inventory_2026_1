IF DB_ID('yahweh_rohi_inventory') IS NULL
BEGIN
  CREATE DATABASE yahweh_rohi_inventory;
END;
GO

USE yahweh_rohi_inventory;
GO

IF OBJECT_ID('dbo.usuario', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.usuario (
    id_usuario INT IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    usuario VARCHAR(60) NOT NULL,
    pass VARCHAR(255) NOT NULL,
    rol VARCHAR(25) NOT NULL,
    activo BIT NOT NULL CONSTRAINT DF_usuario_activo DEFAULT 1,
    ultimo_acceso DATETIME NULL,
    creado_en DATETIME NOT NULL CONSTRAINT DF_usuario_creado_en DEFAULT GETDATE(),
    actualizado_en DATETIME NOT NULL CONSTRAINT DF_usuario_actualizado_en DEFAULT GETDATE(),
    CONSTRAINT PK_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT UQ_usuario_usuario UNIQUE (usuario)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.usuario WHERE usuario = 'admin')
BEGIN
  INSERT INTO dbo.usuario (nombre, usuario, pass, rol, activo)
  VALUES ('Administrador', 'admin', '123456', 'admin', 1);
END;
GO
