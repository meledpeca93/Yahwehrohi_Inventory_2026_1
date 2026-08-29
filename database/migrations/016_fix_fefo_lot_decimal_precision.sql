SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID('dbo.PRODUCTO_LOTE', 'U') IS NULL
  BEGIN
    THROW 51016, 'La tabla dbo.PRODUCTO_LOTE no existe. Ejecute primero la migracion FEFO.', 1;
  END;

  IF OBJECT_ID('dbo.VENTA_LOTE_DETALLE', 'U') IS NULL
  BEGIN
    THROW 51017, 'La tabla dbo.VENTA_LOTE_DETALLE no existe. Ejecute primero la migracion FEFO.', 1;
  END;

  ALTER TABLE dbo.VENTA_LOTE_DETALLE ALTER COLUMN CANTIDAD DECIMAL(18, 3) NOT NULL;
  ALTER TABLE dbo.PRODUCTO_LOTE ALTER COLUMN CANTIDAD_INICIAL DECIMAL(18, 3) NOT NULL;
  ALTER TABLE dbo.PRODUCTO_LOTE ALTER COLUMN CANTIDAD_DISPONIBLE DECIMAL(18, 3) NOT NULL;

  DECLARE @lotes_agregados TABLE (
    ID_PRODUCTO INT NOT NULL,
    CANTIDAD DECIMAL(18, 3) NOT NULL
  );

  ;WITH stock_lotes AS (
    SELECT
      p.id_producto,
      p.codigo,
      CAST(ISNULL(i.stock, 0) AS DECIMAL(18, 3)) AS stock,
      CAST(ISNULL(i.precio_costo, 0) AS DECIMAL(18, 4)) AS precio_costo,
      CAST(ISNULL(SUM(CASE WHEN l.ESTADO = 'ACTIVO' THEN ISNULL(l.CANTIDAD_DISPONIBLE, 0) ELSE 0 END), 0) AS DECIMAL(18, 3)) AS stock_lotes
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.id_inventario = p.id_producto
    LEFT JOIN dbo.PRODUCTO_LOTE l
      ON l.ID_PRODUCTO = p.id_producto
    WHERE ISNULL(p.activo, 1) = 1
    GROUP BY p.id_producto, p.codigo, i.stock, i.precio_costo
  ),
  faltantes AS (
    SELECT
      id_producto,
      codigo,
      precio_costo,
      CAST(stock - stock_lotes AS DECIMAL(18, 3)) AS faltante
    FROM stock_lotes
    WHERE stock > stock_lotes + 0.0005
  )
  INSERT INTO dbo.PRODUCTO_LOTE (
    ID_PRODUCTO,
    CODIGO_PRODUCTO,
    NUM_LOTE,
    FECHA_INGRESO,
    FECHA_VENCIMIENTO,
    CANTIDAD_INICIAL,
    CANTIDAD_DISPONIBLE,
    COSTO_UNITARIO,
    ID_COMPRA,
    TABLA_COMPRA,
    NUM_FACT,
    ESTADO,
    ORIGEN,
    CREADO_POR
  )
  OUTPUT inserted.ID_PRODUCTO, inserted.CANTIDAD_DISPONIBLE
    INTO @lotes_agregados (ID_PRODUCTO, CANTIDAD)
  SELECT
    id_producto,
    CAST(ISNULL(codigo, id_producto) AS VARCHAR(120)),
    CONCAT('AJUSTE-FEFO-', id_producto, '-', CONVERT(CHAR(8), GETDATE(), 112)),
    CAST(GETDATE() AS DATE),
    NULL,
    faltante,
    faltante,
    precio_costo,
    NULL,
    NULL,
    NULL,
    'ACTIVO',
    'AJUSTE_STOCK_EXISTENTE',
    'Sistema'
  FROM faltantes
  WHERE faltante > 0.0005;

  COMMIT TRANSACTION;

  SELECT
    COUNT(1) AS productos_ajustados,
    CAST(ISNULL(SUM(CANTIDAD), 0) AS DECIMAL(18, 3)) AS unidades_agregadas_a_lotes
  FROM @lotes_agregados;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;

  THROW;
END CATCH;
