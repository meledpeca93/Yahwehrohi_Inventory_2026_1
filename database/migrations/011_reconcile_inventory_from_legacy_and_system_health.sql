USE [yahweh_rohi_inventory];
GO

SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO (
    id_cambio INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    sync_batch UNIQUEIDENTIFIER NOT NULL,
    accion VARCHAR(40) NOT NULL,
    codigo VARCHAR(120) NOT NULL,
    id_producto_oficial INT NULL,
    id_producto_afectado INT NULL,
    stock_anterior DECIMAL(18, 2) NULL,
    stock_nuevo DECIMAL(18, 2) NULL,
    detalle VARCHAR(500) NULL,
    creado_en DATETIME2 NOT NULL CONSTRAINT DF_SISTEMA_SALUD_PRODUCTO_CAMBIO_creado_en DEFAULT SYSUTCDATETIME()
  );
END;
GO

DECLARE @batch UNIQUEIDENTIFIER = NEWID();

IF OBJECT_ID('dbo.producto_backup_pre_inventory_reconcile_20260609', 'U') IS NULL
  SELECT * INTO dbo.producto_backup_pre_inventory_reconcile_20260609 FROM dbo.producto;

IF OBJECT_ID('dbo.inventario_backup_pre_inventory_reconcile_20260609', 'U') IS NULL
  SELECT * INTO dbo.inventario_backup_pre_inventory_reconcile_20260609 FROM dbo.inventario;

BEGIN TRANSACTION;

IF OBJECT_ID('tempdb..#source_products') IS NOT NULL DROP TABLE #source_products;

SELECT
  IdProducto,
  LTRIM(RTRIM(Codigo)) COLLATE DATABASE_DEFAULT AS codigo,
  Nombre COLLATE DATABASE_DEFAULT AS nombre,
  CAST(ISNULL(PrecioDeCosto, 0) AS DECIMAL(18, 4)) AS precio_costo,
  CAST(ISNULL(PrecioDeVenta, 0) AS DECIMAL(18, 4)) AS precio_venta,
  CAST(PrecioDeMayoreo AS DECIMAL(18, 4)) AS precio_mayoreo,
  CAST(ISNULL(Stock, 0) AS DECIMAL(18, 2)) AS stock,
  CAST(ISNULL(StockMinimo, 0) AS DECIMAL(18, 2)) AS stock_minimo,
  CAST(StockMaximo AS DECIMAL(18, 2)) AS stock_maximo,
  CAST(Estado AS BIT) AS activo,
  UrlImagen COLLATE DATABASE_DEFAULT AS imagen_url,
  CONCAT('Ubicacion: ', ISNULL(Ubicacion, ''), '; CategoriaId: ', CategoriaId) COLLATE DATABASE_DEFAULT AS descripcion,
  CAST(CategoriaId AS VARCHAR(40)) COLLATE DATABASE_DEFAULT AS categoria,
  CAST(ProveedorId AS VARCHAR(40)) COLLATE DATABASE_DEFAULT AS proveedor
INTO #source_products
FROM (
  SELECT
    p.*,
    ROW_NUMBER() OVER (
      PARTITION BY LTRIM(RTRIM(p.Codigo)) COLLATE DATABASE_DEFAULT
      ORDER BY p.Estado DESC, p.IdProducto ASC
    ) AS rn
  FROM [DBSistemaPuntoDeVenta].dbo.Productos p
  WHERE NULLIF(LTRIM(RTRIM(p.Codigo)), '') IS NOT NULL
) src
WHERE rn = 1;

INSERT INTO dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO (
  sync_batch, accion, codigo, id_producto_oficial, id_producto_afectado, detalle
)
SELECT
  @batch,
  'REASIGNAR_ID_EXTRA',
  s.codigo,
  s.IdProducto,
  p.id_producto,
  CONCAT('El ID ', s.IdProducto, ' tenia codigo ', p.codigo, ' y fue reasignado al codigo oficial de la BD vieja.')
FROM #source_products s
INNER JOIN dbo.producto p
  ON p.id_producto = s.IdProducto
 AND p.codigo COLLATE DATABASE_DEFAULT <> s.codigo;

UPDATE p
SET
  p.codigo = s.codigo,
  p.nombre = s.nombre,
  p.descripcion = s.descripcion,
  p.imagen_url = s.imagen_url,
  p.activo = s.activo,
  p.actualizado_por = 'sync_bd_oficial',
  p.actualizado_en = GETDATE()
FROM dbo.producto p
INNER JOIN #source_products s
  ON s.IdProducto = p.id_producto;

SET IDENTITY_INSERT dbo.producto ON;

INSERT INTO dbo.producto (
  id_producto,
  codigo,
  nombre,
  descripcion,
  imagen_url,
  activo,
  creado_por,
  creado_en,
  actualizado_por,
  actualizado_en
)
SELECT
  s.IdProducto,
  s.codigo,
  s.nombre,
  s.descripcion,
  s.imagen_url,
  s.activo,
  'sync_bd_oficial',
  GETDATE(),
  'sync_bd_oficial',
  GETDATE()
FROM #source_products s
LEFT JOIN dbo.producto p
  ON p.id_producto = s.IdProducto
WHERE p.id_producto IS NULL;

SET IDENTITY_INSERT dbo.producto OFF;

UPDATE i
SET
  i.codigo = s.codigo,
  i.precio_costo = s.precio_costo,
  i.precio_venta = s.precio_venta,
  i.precio_mayoreo = s.precio_mayoreo,
  i.unidad_medida = 'Unidad',
  i.stock = s.stock,
  i.stock_minimo = s.stock_minimo,
  i.stock_maximo = s.stock_maximo,
  i.categoria = s.categoria,
  i.proveedor = s.proveedor,
  i.actualizado_por = 'sync_bd_oficial',
  i.actualizado_en = GETDATE(),
  i.id_pd = s.IdProducto
FROM dbo.inventario i
INNER JOIN #source_products s
  ON s.IdProducto = i.id_inventario;

SET IDENTITY_INSERT dbo.inventario ON;

INSERT INTO dbo.inventario (
  id_inventario,
  codigo,
  precio_costo,
  precio_venta,
  precio_mayoreo,
  unidad_medida,
  stock,
  stock_minimo,
  stock_maximo,
  categoria,
  proveedor,
  creado_por,
  creado_en,
  actualizado_por,
  actualizado_en,
  id_pd,
  FECHA_INGRESO,
  FECHA_VENCIMIENTO,
  NUM_LOTE,
  PRECIO_COSTO_OPERATIVO,
  PRECIO_VENTA_OPERATIVO
)
SELECT
  s.IdProducto,
  s.codigo,
  s.precio_costo,
  s.precio_venta,
  s.precio_mayoreo,
  'Unidad',
  s.stock,
  s.stock_minimo,
  s.stock_maximo,
  s.categoria,
  s.proveedor,
  'sync_bd_oficial',
  GETDATE(),
  'sync_bd_oficial',
  GETDATE(),
  s.IdProducto,
  CONVERT(VARCHAR(30), GETDATE(), 120),
  NULL,
  NULL,
  s.precio_costo,
  s.precio_venta
FROM #source_products s
LEFT JOIN dbo.inventario i
  ON i.id_inventario = s.IdProducto
WHERE i.id_inventario IS NULL;

SET IDENTITY_INSERT dbo.inventario OFF;

IF OBJECT_ID('tempdb..#duplicate_product_ids') IS NOT NULL DROP TABLE #duplicate_product_ids;

SELECT
  p.id_producto AS duplicate_id,
  s.IdProducto AS official_id,
  s.codigo
INTO #duplicate_product_ids
FROM dbo.producto p
INNER JOIN #source_products s
  ON s.codigo = p.codigo COLLATE DATABASE_DEFAULT
WHERE p.id_producto <> s.IdProducto;

UPDATE v SET ID_PD = d.official_id FROM dbo.VENTA_EFECTIVO v INNER JOIN #duplicate_product_ids d ON d.duplicate_id = v.ID_PD;
UPDATE v SET ID_PD = d.official_id FROM dbo.VENTA_CREDITO v INNER JOIN #duplicate_product_ids d ON d.duplicate_id = v.ID_PD;
UPDATE v SET ID_PD = d.official_id FROM dbo.VENTA_TRANSFERENCIA v INNER JOIN #duplicate_product_ids d ON d.duplicate_id = v.ID_PD;
UPDATE c SET ID_PD = d.official_id FROM dbo.COMPRA_EFECTIVO c INNER JOIN #duplicate_product_ids d ON d.duplicate_id = c.ID_PD;
UPDATE c SET ID_PD = d.official_id FROM dbo.COMPRA_CREDITO c INNER JOIN #duplicate_product_ids d ON d.duplicate_id = c.ID_PD;
UPDATE l SET ID_PD = d.official_id FROM dbo.INVENTARIO_LOG l INNER JOIN #duplicate_product_ids d ON d.duplicate_id = l.ID_PD;
UPDATE pv SET ID_PRODUCTO = d.official_id FROM dbo.PRODUCTO_PROXIMO_VENCER pv INNER JOIN #duplicate_product_ids d ON d.duplicate_id = pv.ID_PRODUCTO;

INSERT INTO dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO (
  sync_batch, accion, codigo, id_producto_oficial, id_producto_afectado, detalle
)
SELECT
  @batch,
  'DUPLICADO_ELIMINADO',
  d.codigo,
  d.official_id,
  d.duplicate_id,
  'Producto duplicado reasignado al ID oficial y eliminado de catalogo/inventario nuevo.'
FROM #duplicate_product_ids d;

DELETE i
FROM dbo.inventario i
INNER JOIN #source_products s
  ON s.codigo = i.codigo COLLATE DATABASE_DEFAULT
WHERE i.id_inventario <> s.IdProducto;

DELETE p
FROM dbo.producto p
INNER JOIN #duplicate_product_ids d
  ON d.duplicate_id = p.id_producto;

INSERT INTO dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO (
  sync_batch, accion, codigo, id_producto_oficial, id_producto_afectado, stock_anterior, stock_nuevo, detalle
)
SELECT
  @batch,
  'STOCK_SINCRONIZADO',
  s.codigo,
  s.IdProducto,
  s.IdProducto,
  b.stock,
  s.stock,
  'Stock actualizado segun BD vieja oficial.'
FROM #source_products s
LEFT JOIN dbo.inventario_backup_pre_inventory_reconcile_20260609 b
  ON b.id_inventario = s.IdProducto
WHERE ABS(ISNULL(b.stock, 0) - ISNULL(s.stock, 0)) > 0.001
   OR b.id_inventario IS NULL;

INSERT INTO dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO (
  sync_batch, accion, codigo, id_producto_oficial, id_producto_afectado, detalle
)
SELECT
  @batch,
  'CODIGO_NUEVO_AGREGADO',
  s.codigo,
  s.IdProducto,
  s.IdProducto,
  'Codigo existente en BD vieja que no estaba correctamente disponible en BD nueva.'
FROM #source_products s
LEFT JOIN dbo.producto_backup_pre_inventory_reconcile_20260609 p
  ON p.codigo COLLATE DATABASE_DEFAULT = s.codigo
WHERE p.id_producto IS NULL;

INSERT INTO dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO (
  sync_batch, accion, codigo, id_producto_afectado, detalle
)
SELECT
  @batch,
  'CODIGO_DESACTIVADO',
  p.codigo,
  p.id_producto,
  'Codigo excedente en BD nueva no encontrado en BD vieja oficial; se desactiva para no mostrarse en formularios.'
FROM dbo.producto p
LEFT JOIN #source_products s
  ON s.codigo = p.codigo COLLATE DATABASE_DEFAULT
WHERE s.codigo IS NULL
  AND p.activo = 1;

UPDATE p
SET
  p.activo = 0,
  p.actualizado_por = 'sync_bd_oficial',
  p.actualizado_en = GETDATE()
FROM dbo.producto p
LEFT JOIN #source_products s
  ON s.codigo = p.codigo COLLATE DATABASE_DEFAULT
WHERE s.codigo IS NULL;

COMMIT TRANSACTION;

SELECT
  @batch AS sync_batch,
  SUM(CASE WHEN accion = 'CODIGO_NUEVO_AGREGADO' THEN 1 ELSE 0 END) AS codigos_agregados,
  SUM(CASE WHEN accion = 'DUPLICADO_ELIMINADO' THEN 1 ELSE 0 END) AS duplicados_eliminados,
  SUM(CASE WHEN accion = 'CODIGO_DESACTIVADO' THEN 1 ELSE 0 END) AS codigos_desactivados,
  SUM(CASE WHEN accion = 'STOCK_SINCRONIZADO' THEN 1 ELSE 0 END) AS stocks_sincronizados
FROM dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO
WHERE sync_batch = @batch;
GO
