IF OBJECT_ID('dbo.HISTORICO_COSTO_PRODUCTO', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HISTORICO_COSTO_PRODUCTO (
    id_historial INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    periodo_anio INT NOT NULL,
    periodo_mes INT NOT NULL,
    id_producto INT NOT NULL,
    codigo VARCHAR(120) NOT NULL,
    producto VARCHAR(200) NOT NULL,
    categoria VARCHAR(120) NOT NULL CONSTRAINT DF_HISTORICO_COSTO_PRODUCTO_categoria DEFAULT ('Sin categoria'),
    precio_costo DECIMAL(18,2) NOT NULL,
    precio_venta DECIMAL(18,2) NOT NULL,
    stock DECIMAL(18,2) NOT NULL,
    capturado_en DATETIME NOT NULL CONSTRAINT DF_HISTORICO_COSTO_PRODUCTO_capturado_en DEFAULT (GETDATE()),
    capturado_por INT NULL,
    CONSTRAINT UQ_HISTORICO_COSTO_PRODUCTO_periodo_producto UNIQUE (periodo_anio, periodo_mes, id_producto)
  );
END;
GO

IF OBJECT_ID('dbo.ALERTA_AUMENTO_COSTO_MENSUAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ALERTA_AUMENTO_COSTO_MENSUAL (
    id_alerta INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    periodo_anio INT NOT NULL,
    periodo_mes INT NOT NULL,
    id_producto INT NOT NULL,
    codigo VARCHAR(120) NOT NULL,
    producto VARCHAR(200) NOT NULL,
    categoria VARCHAR(120) NOT NULL CONSTRAINT DF_ALERTA_AUMENTO_COSTO_MENSUAL_categoria DEFAULT ('Sin categoria'),
    costo_anterior DECIMAL(18,2) NOT NULL,
    costo_actual DECIMAL(18,2) NOT NULL,
    aumento_valor DECIMAL(18,2) NOT NULL,
    aumento_porcentaje DECIMAL(18,4) NOT NULL,
    precio_venta_actual DECIMAL(18,2) NOT NULL,
    stock_actual DECIMAL(18,2) NOT NULL,
    detectado_en DATETIME NOT NULL CONSTRAINT DF_ALERTA_AUMENTO_COSTO_MENSUAL_detectado_en DEFAULT (GETDATE()),
    detectado_por INT NULL,
    CONSTRAINT UQ_ALERTA_AUMENTO_COSTO_MENSUAL_periodo_producto UNIQUE (periodo_anio, periodo_mes, id_producto)
  );
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_registrar_aumentos_costo_ultimo_mes
  @usuario_id INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @periodo_actual DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
  DECLARE @periodo_anterior DATE = DATEADD(MONTH, -1, @periodo_actual);
  DECLARE @anio_actual INT = YEAR(@periodo_actual);
  DECLARE @mes_actual INT = MONTH(@periodo_actual);
  DECLARE @anio_anterior INT = YEAR(@periodo_anterior);
  DECLARE @mes_anterior INT = MONTH(@periodo_anterior);

  ;WITH inventario_actual AS (
    SELECT
      p.id_producto,
      p.codigo,
      p.nombre AS producto,
      ISNULL(i.categoria, 'Sin categoria') AS categoria,
      CAST(ISNULL(i.precio_costo, 0) AS DECIMAL(18,2)) AS precio_costo,
      CAST(ISNULL(i.precio_venta, 0) AS DECIMAL(18,2)) AS precio_venta,
      CAST(ISNULL(i.stock, 0) AS DECIMAL(18,2)) AS stock
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    WHERE p.activo = 1
  )
  MERGE dbo.HISTORICO_COSTO_PRODUCTO AS target
  USING inventario_actual AS source
    ON target.periodo_anio = @anio_actual
   AND target.periodo_mes = @mes_actual
   AND target.id_producto = source.id_producto
  WHEN MATCHED THEN
    UPDATE SET
      codigo = source.codigo,
      producto = source.producto,
      categoria = source.categoria,
      precio_costo = source.precio_costo,
      precio_venta = source.precio_venta,
      stock = source.stock,
      capturado_en = GETDATE(),
      capturado_por = @usuario_id
  WHEN NOT MATCHED THEN
    INSERT (
      periodo_anio,
      periodo_mes,
      id_producto,
      codigo,
      producto,
      categoria,
      precio_costo,
      precio_venta,
      stock,
      capturado_en,
      capturado_por
    )
    VALUES (
      @anio_actual,
      @mes_actual,
      source.id_producto,
      source.codigo,
      source.producto,
      source.categoria,
      source.precio_costo,
      source.precio_venta,
      source.stock,
      GETDATE(),
      @usuario_id
    );

  ;WITH comparativo AS (
    SELECT
      actual.id_producto,
      actual.codigo,
      actual.producto,
      actual.categoria,
      anterior.precio_costo AS costo_anterior,
      actual.precio_costo AS costo_actual,
      CAST(actual.precio_costo - anterior.precio_costo AS DECIMAL(18,2)) AS aumento_valor,
      CAST(
        CASE
          WHEN anterior.precio_costo <= 0 THEN 0
          ELSE ((actual.precio_costo - anterior.precio_costo) / anterior.precio_costo) * 100
        END AS DECIMAL(18,4)
      ) AS aumento_porcentaje,
      actual.precio_venta AS precio_venta_actual,
      actual.stock AS stock_actual
    FROM dbo.HISTORICO_COSTO_PRODUCTO actual
    INNER JOIN dbo.HISTORICO_COSTO_PRODUCTO anterior
      ON anterior.id_producto = actual.id_producto
     AND anterior.periodo_anio = @anio_anterior
     AND anterior.periodo_mes = @mes_anterior
    WHERE actual.periodo_anio = @anio_actual
      AND actual.periodo_mes = @mes_actual
      AND actual.precio_costo > anterior.precio_costo
  )
  MERGE dbo.ALERTA_AUMENTO_COSTO_MENSUAL AS target
  USING comparativo AS source
    ON target.periodo_anio = @anio_actual
   AND target.periodo_mes = @mes_actual
   AND target.id_producto = source.id_producto
  WHEN MATCHED THEN
    UPDATE SET
      codigo = source.codigo,
      producto = source.producto,
      categoria = source.categoria,
      costo_anterior = source.costo_anterior,
      costo_actual = source.costo_actual,
      aumento_valor = source.aumento_valor,
      aumento_porcentaje = source.aumento_porcentaje,
      precio_venta_actual = source.precio_venta_actual,
      stock_actual = source.stock_actual,
      detectado_en = GETDATE(),
      detectado_por = @usuario_id
  WHEN NOT MATCHED THEN
    INSERT (
      periodo_anio,
      periodo_mes,
      id_producto,
      codigo,
      producto,
      categoria,
      costo_anterior,
      costo_actual,
      aumento_valor,
      aumento_porcentaje,
      precio_venta_actual,
      stock_actual,
      detectado_en,
      detectado_por
    )
    VALUES (
      @anio_actual,
      @mes_actual,
      source.id_producto,
      source.codigo,
      source.producto,
      source.categoria,
      source.costo_anterior,
      source.costo_actual,
      source.aumento_valor,
      source.aumento_porcentaje,
      source.precio_venta_actual,
      source.stock_actual,
      GETDATE(),
      @usuario_id
    )
  WHEN NOT MATCHED BY SOURCE
    AND target.periodo_anio = @anio_actual
    AND target.periodo_mes = @mes_actual
  THEN DELETE;

  SELECT
    periodo_anio,
    periodo_mes,
    id_producto,
    codigo,
    producto,
    categoria,
    costo_anterior,
    costo_actual,
    aumento_valor,
    aumento_porcentaje,
    precio_venta_actual,
    stock_actual,
    detectado_en
  FROM dbo.ALERTA_AUMENTO_COSTO_MENSUAL
  WHERE periodo_anio = @anio_actual
    AND periodo_mes = @mes_actual
  ORDER BY aumento_valor DESC, producto ASC;
END;
GO
