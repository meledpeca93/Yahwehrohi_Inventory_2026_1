/*
  Prepara en la nueva BD los productos requeridos por ventas historicas pendientes.

  No modifica DBSistemaPuntoDeVenta.
  Usa Productos_Mirror y DetalleDeVenta_Mirror ya sincronizadas en yahweh_rohi_inventory.

  Regla de stock:
  - stock_requerido = stock actual en Productos_Mirror + cantidad vendida historica pendiente.
  - Esto permite ejecutar despues dbo.sp_ProcesarVentasFinancieras y que los triggers descuenten
    el historico sin dejar el stock por debajo del stock actual de la BD original.
*/

SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.Productos_Mirror', N'U') IS NULL
     OR OBJECT_ID(N'dbo.DetalleDeVenta_Mirror', N'U') IS NULL
     OR OBJECT_ID(N'dbo.Ventas_Mirror', N'U') IS NULL
  BEGIN
    THROW 51020, 'Faltan tablas espejo: Productos_Mirror, Ventas_Mirror o DetalleDeVenta_Mirror.', 1;
  END;

  IF OBJECT_ID(N'dbo.producto', N'U') IS NULL
     OR OBJECT_ID(N'dbo.inventario', N'U') IS NULL
  BEGIN
    THROW 51021, 'Faltan tablas destino dbo.producto o dbo.inventario.', 1;
  END;

  IF OBJECT_ID('tempdb..#ProductosHistoricosFaltantes') IS NOT NULL
  BEGIN
    DROP TABLE #ProductosHistoricosFaltantes;
  END;

  ;WITH ventas_historicas_pendientes AS (
    SELECT
      d.ProductoId,
      SUM(CAST(d.Cantidad AS decimal(18, 2))) AS cantidad_vendida_historica,
      COUNT(*) AS lineas_venta
    FROM dbo.DetalleDeVenta_Mirror d
    INNER JOIN dbo.Ventas_Mirror v
      ON v.IdVenta = d.VentaId
    WHERE d.ProductoId IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.VENTA_EFECTIVO ve
        WHERE ve.ID_FACT = v.IdVenta
          AND ve.ID_PD = d.ProductoId
      )
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.VENTA_CREDITO vc
        WHERE vc.ID_FACT = v.IdVenta
          AND vc.ID_PD = d.ProductoId
      )
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.VENTA_TRANSFERENCIA vt
        WHERE vt.ID_FACT = v.IdVenta
          AND vt.ID_PD = d.ProductoId
      )
    GROUP BY d.ProductoId
  )
  SELECT
    vh.ProductoId,
    pm.Codigo,
    pm.Nombre,
    pm.UrlImagen,
    pm.PrecioDeCosto,
    pm.PrecioDeVenta,
    pm.PrecioDeMayoreo,
    pm.Stock,
    pm.StockMinimo,
    pm.StockMaximo,
    pm.CategoriaId,
    pm.ProveedorId,
    pm.Estado,
    vh.cantidad_vendida_historica,
    vh.lineas_venta,
    CAST(ISNULL(pm.Stock, 0) + vh.cantidad_vendida_historica AS decimal(18, 2)) AS stock_para_insertar,
    CASE WHEN p.id_producto IS NULL THEN 1 ELSE 0 END AS falta_producto,
    CASE WHEN i.id_inventario IS NULL THEN 1 ELSE 0 END AS falta_inventario
  INTO #ProductosHistoricosFaltantes
  FROM ventas_historicas_pendientes vh
  INNER JOIN dbo.Productos_Mirror pm
    ON pm.IdProducto = vh.ProductoId
  LEFT JOIN dbo.producto p
    ON p.id_producto = vh.ProductoId
  LEFT JOIN dbo.inventario i
    ON i.id_inventario = vh.ProductoId;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT d.ProductoId
      FROM dbo.DetalleDeVenta_Mirror d
      INNER JOIN dbo.Ventas_Mirror v
        ON v.IdVenta = d.VentaId
      LEFT JOIN dbo.Productos_Mirror pm
        ON pm.IdProducto = d.ProductoId
      WHERE d.ProductoId IS NOT NULL
        AND pm.IdProducto IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM dbo.VENTA_EFECTIVO ve WHERE ve.ID_FACT = v.IdVenta AND ve.ID_PD = d.ProductoId
        )
        AND NOT EXISTS (
          SELECT 1 FROM dbo.VENTA_CREDITO vc WHERE vc.ID_FACT = v.IdVenta AND vc.ID_PD = d.ProductoId
        )
        AND NOT EXISTS (
          SELECT 1 FROM dbo.VENTA_TRANSFERENCIA vt WHERE vt.ID_FACT = v.IdVenta AND vt.ID_PD = d.ProductoId
        )
    ) missing_source
  )
  BEGIN
    THROW 51022, 'Hay productos vendidos historicos que no existen en Productos_Mirror. Sincronice productos primero.', 1;
  END;

  DECLARE @ProductosInsertados INT = 0;
  DECLARE @InventariosInsertados INT = 0;
  DECLARE @InventariosActualizados INT = 0;

  IF EXISTS (SELECT 1 FROM #ProductosHistoricosFaltantes WHERE falta_producto = 1)
  BEGIN
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
      ProductoId,
      LEFT(CAST(Codigo AS varchar(50)), 50),
      LEFT(CAST(Nombre AS varchar(255)), 255),
      CONCAT('Producto historico importado desde Productos_Mirror. Lineas historicas: ', lineas_venta),
      CAST(UrlImagen AS varchar(500)),
      ISNULL(Estado, 1),
      'sync_historico',
      GETDATE(),
      'sync_historico',
      GETDATE()
    FROM #ProductosHistoricosFaltantes
    WHERE falta_producto = 1
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.producto p
        WHERE p.id_producto = #ProductosHistoricosFaltantes.ProductoId
      );

    SET @ProductosInsertados = @@ROWCOUNT;
    SET IDENTITY_INSERT dbo.producto OFF;
  END;

  IF EXISTS (SELECT 1 FROM #ProductosHistoricosFaltantes WHERE falta_inventario = 1)
  BEGIN
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
      ProductoId,
      LEFT(CAST(Codigo AS varchar(50)), 50),
      CAST(ISNULL(PrecioDeCosto, 0) AS decimal(18, 2)),
      CAST(ISNULL(PrecioDeVenta, 0) AS decimal(18, 2)),
      CAST(PrecioDeMayoreo AS decimal(18, 2)),
      CASE WHEN ISNULL(CAST(Codigo AS varchar(100)), '') LIKE '%granel%' THEN 'Granel' ELSE 'Unidad' END,
      CAST(stock_para_insertar AS decimal(18, 2)),
      CAST(ISNULL(StockMinimo, 0) AS decimal(18, 2)),
      CAST(StockMaximo AS decimal(18, 2)),
      CONCAT('Categoria ', ISNULL(CAST(CategoriaId AS varchar(20)), '0')),
      CONCAT('Proveedor ', ISNULL(CAST(ProveedorId AS varchar(20)), '0')),
      'sync_historico',
      GETDATE(),
      'sync_historico',
      GETDATE(),
      ProductoId,
      NULL,
      NULL,
      NULL,
      CAST(ISNULL(PrecioDeCosto, 0) AS decimal(18, 2)),
      CAST(ISNULL(PrecioDeVenta, 0) AS decimal(18, 2))
    FROM #ProductosHistoricosFaltantes
    WHERE falta_inventario = 1
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.inventario i
        WHERE i.id_inventario = #ProductosHistoricosFaltantes.ProductoId
      );

    SET @InventariosInsertados = @@ROWCOUNT;
    SET IDENTITY_INSERT dbo.inventario OFF;
  END;

  UPDATE i
  SET
    i.stock = CASE
      WHEN i.stock < h.stock_para_insertar THEN h.stock_para_insertar
      ELSE i.stock
    END,
    i.precio_costo = CAST(ISNULL(h.PrecioDeCosto, i.precio_costo) AS decimal(18, 2)),
    i.precio_venta = CAST(ISNULL(h.PrecioDeVenta, i.precio_venta) AS decimal(18, 2)),
    i.precio_mayoreo = CAST(COALESCE(h.PrecioDeMayoreo, i.precio_mayoreo) AS decimal(18, 2)),
    i.id_pd = COALESCE(i.id_pd, h.ProductoId),
    i.actualizado_por = 'sync_historico',
    i.actualizado_en = GETDATE()
  FROM dbo.inventario i
  INNER JOIN #ProductosHistoricosFaltantes h
    ON h.ProductoId = i.id_inventario
  WHERE i.stock < h.stock_para_insertar
     OR i.id_pd IS NULL
     OR ISNULL(i.precio_costo, 0) <> ISNULL(h.PrecioDeCosto, 0)
     OR ISNULL(i.precio_venta, 0) <> ISNULL(h.PrecioDeVenta, 0);

  SET @InventariosActualizados = @@ROWCOUNT;

  IF OBJECT_ID(N'dbo.sync_log', N'U') IS NOT NULL
  BEGIN
    INSERT INTO dbo.sync_log (TableName, OperationType, RecordId, SyncDate, Status, Message)
    VALUES (
      'PRODUCTOS_HISTORICOS',
      'INSERT',
      0,
      GETDATE(),
      'OK',
        CONCAT(
        'Productos insertados=', @ProductosInsertados,
        '; Inventarios insertados=', @InventariosInsertados,
        '; Inventarios actualizados=', @InventariosActualizados,
        '; Productos evaluados=', (SELECT COUNT(*) FROM #ProductosHistoricosFaltantes)
      )
    );
  END;

  COMMIT TRANSACTION;

  SELECT
    @ProductosInsertados AS productos_insertados,
    @InventariosInsertados AS inventarios_insertados,
    @InventariosActualizados AS inventarios_actualizados,
    COUNT(*) AS productos_historicos_evaluados,
    SUM(cantidad_vendida_historica) AS cantidad_historica_pendiente,
    SUM(stock_para_insertar) AS stock_total_insertado_calculado
  FROM #ProductosHistoricosFaltantes;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
  BEGIN
    ROLLBACK TRANSACTION;
  END;

  IF OBJECT_ID(N'dbo.sync_errors', N'U') IS NOT NULL
  BEGIN
    INSERT INTO dbo.sync_errors (TableName, OperationType, RecordId, ErrorMessage)
    VALUES ('PRODUCTOS_HISTORICOS', 'INSERT', 0, ERROR_MESSAGE());
  END;

  IF (SELECT OBJECTPROPERTY(OBJECT_ID(N'dbo.producto'), 'TableHasIdentity')) = 1
  BEGIN
    BEGIN TRY
      SET IDENTITY_INSERT dbo.producto OFF;
    END TRY
    BEGIN CATCH
    END CATCH;
  END;

  IF (SELECT OBJECTPROPERTY(OBJECT_ID(N'dbo.inventario'), 'TableHasIdentity')) = 1
  BEGIN
    BEGIN TRY
      SET IDENTITY_INSERT dbo.inventario OFF;
    END TRY
    BEGIN CATCH
    END CATCH;
  END;

  THROW;
END CATCH;
