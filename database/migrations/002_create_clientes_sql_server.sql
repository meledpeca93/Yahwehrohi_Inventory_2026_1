IF DB_ID('yahweh_rohi_inventory') IS NULL
BEGIN
  CREATE DATABASE yahweh_rohi_inventory;
END;

USE yahweh_rohi_inventory;

IF OBJECT_ID('dbo.cliente', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.cliente (
    id_cliente INT IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(160) NOT NULL,
    telefono VARCHAR(30) NULL,
    direccion VARCHAR(255) NULL,
    activo BIT NOT NULL CONSTRAINT DF_cliente_activo DEFAULT 1,
    saldo DECIMAL(18,2) NOT NULL CONSTRAINT DF_cliente_saldo DEFAULT 0,
    creado_en DATETIME NOT NULL CONSTRAINT DF_cliente_creado_en DEFAULT GETDATE(),
    actualizado_en DATETIME NOT NULL CONSTRAINT DF_cliente_actualizado_en DEFAULT GETDATE(),
    CONSTRAINT PK_cliente PRIMARY KEY (id_cliente)
  );
END;

IF COL_LENGTH('dbo.cliente', 'saldo') IS NULL
BEGIN
  ALTER TABLE dbo.cliente
  ADD saldo DECIMAL(18,2) NOT NULL CONSTRAINT DF_cliente_saldo_alter DEFAULT 0;
END;
