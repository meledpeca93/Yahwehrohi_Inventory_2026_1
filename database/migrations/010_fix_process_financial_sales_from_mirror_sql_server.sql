CREATE OR ALTER PROCEDURE dbo.sp_ProcesarVentasFinancieras
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE
    @EfectivoInsertadas INT = 0,
    @CreditoInsertadas INT = 0,
    @TransferenciaInsertadas INT = 0,
    @ProductosInsertados INT = 0,
    @InventariosInsertados INT = 0;

  BEGIN TRY
    IF OBJECT_ID(N'dbo.Ventas_Mirror', N'U') IS NULL
       OR OBJECT_ID(N'dbo.DetalleDeVenta_Mirror', N'U') IS NULL
    BEGIN
      THROW 51040, 'No existen Ventas_Mirror o DetalleDeVenta_Mirror.', 1;
    END;

    BEGIN TRANSACTION;

    IF OBJECT_ID('tempdb..#VentasPendientes') IS NOT NULL
    BEGIN
      DROP TABLE #VentasPendientes;
    END;

    ;WITH expected AS (
      SELECT
        'EFECTIVO' AS tipo,
        v.IdVenta,
        d.ProductoId,
        MAX(v.UsuarioId) AS UsuarioId,
        MAX(v.ClienteId) AS ClienteId,
        MAX(v.Fecha) AS Fecha,
        MAX(CAST(v.Estado AS int)) AS Estado,
        SUM(CAST(d.Cantidad AS decimal(18, 3))) AS cantidad_esperada,
        SUM(CAST(d.Precio * d.Cantidad AS decimal(18, 2))) AS venta_total_esperada,
        SUM(CAST(ISNULL(pm.PrecioDeCosto, i.precio_costo) * d.Cantidad AS decimal(18, 2))) AS costo_total_esperado
      FROM dbo.Ventas_Mirror v
      INNER JOIN dbo.DetalleDeVenta_Mirror d
        ON d.VentaId = v.IdVenta
      LEFT JOIN dbo.Productos_Mirror pm
        ON pm.IdProducto = d.ProductoId
      LEFT JOIN dbo.inventario i
        ON i.id_inventario = d.ProductoId
      WHERE v.MontoEfectivo > 0
        AND d.ProductoId IS NOT NULL
      GROUP BY v.IdVenta, d.ProductoId

      UNION ALL

      SELECT
        'CREDITO',
        v.IdVenta,
        d.ProductoId,
        MAX(v.UsuarioId),
        MAX(v.ClienteId),
        MAX(v.Fecha),
        MAX(CAST(v.Estado AS int)),
        SUM(CAST(d.Cantidad AS decimal(18, 3))),
        SUM(CAST(d.Precio * d.Cantidad AS decimal(18, 2))),
        SUM(CAST(ISNULL(pm.PrecioDeCosto, i.precio_costo) * d.Cantidad AS decimal(18, 2)))
      FROM dbo.Ventas_Mirror v
      INNER JOIN dbo.DetalleDeVenta_Mirror d
        ON d.VentaId = v.IdVenta
      LEFT JOIN dbo.Productos_Mirror pm
        ON pm.IdProducto = d.ProductoId
      LEFT JOIN dbo.inventario i
        ON i.id_inventario = d.ProductoId
      WHERE v.MontoCredito > 0
        AND d.ProductoId IS NOT NULL
      GROUP BY v.IdVenta, d.ProductoId

      UNION ALL

      SELECT
        'TRANSFERENCIA',
        v.IdVenta,
        d.ProductoId,
        MAX(v.UsuarioId),
        MAX(v.ClienteId),
        MAX(v.Fecha),
        MAX(CAST(v.Estado AS int)),
        SUM(CAST(d.Cantidad AS decimal(18, 3))),
        SUM(CAST(d.Precio * d.Cantidad AS decimal(18, 2))),
        SUM(CAST(ISNULL(pm.PrecioDeCosto, i.precio_costo) * d.Cantidad AS decimal(18, 2)))
      FROM dbo.Ventas_Mirror v
      INNER JOIN dbo.DetalleDeVenta_Mirror d
        ON d.VentaId = v.IdVenta
      LEFT JOIN dbo.Productos_Mirror pm
        ON pm.IdProducto = d.ProductoId
      LEFT JOIN dbo.inventario i
        ON i.id_inventario = d.ProductoId
      WHERE v.MontoTransferencia > 0
        AND d.ProductoId IS NOT NULL
      GROUP BY v.IdVenta, d.ProductoId
    ),
    actual AS (
      SELECT
        'EFECTIVO' AS tipo,
        ID_FACT AS IdVenta,
        ID_PD AS ProductoId,
        SUM(CAST(CANT_PD AS decimal(18, 3))) AS cantidad_actual
      FROM dbo.VENTA_EFECTIVO
      GROUP BY ID_FACT, ID_PD

      UNION ALL

      SELECT
        'CREDITO',
        ID_FACT,
        ID_PD,
        SUM(CAST(CANT_PD AS decimal(18, 3)))
      FROM dbo.VENTA_CREDITO
      GROUP BY ID_FACT, ID_PD

      UNION ALL

      SELECT
        'TRANSFERENCIA',
        ID_FACT,
        ID_PD,
        SUM(CAST(CANT_PD AS decimal(18, 3)))
      FROM dbo.VENTA_TRANSFERENCIA
      GROUP BY ID_FACT, ID_PD
    )
    SELECT
      e.tipo,
      e.IdVenta,
      e.ProductoId,
      e.UsuarioId,
      e.ClienteId,
      e.Fecha,
      e.Estado,
      CAST(e.cantidad_esperada - ISNULL(a.cantidad_actual, 0) AS decimal(18, 3)) AS cantidad_pendiente,
      CAST(CASE WHEN e.cantidad_esperada = 0 THEN 0 ELSE e.venta_total_esperada / e.cantidad_esperada END AS decimal(18, 2)) AS precio_venta,
      CAST(CASE WHEN e.cantidad_esperada = 0 THEN 0 ELSE ISNULL(e.costo_total_esperado, 0) / e.cantidad_esperada END AS decimal(18, 2)) AS precio_costo
    INTO #VentasPendientes
    FROM expected e
    LEFT JOIN actual a
      ON a.tipo = e.tipo
     AND a.IdVenta = e.IdVenta
     AND a.ProductoId = e.ProductoId
    WHERE e.cantidad_esperada > ISNULL(a.cantidad_actual, 0);

    IF EXISTS (SELECT 1 FROM #VentasPendientes)
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM #VentasPendientes vp
        LEFT JOIN dbo.producto p ON p.id_producto = vp.ProductoId
        WHERE p.id_producto IS NULL
      )
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
          vp.ProductoId,
          LEFT(COALESCE(pm.Codigo, MAX(d.CodigoProducto), CONCAT('MIG-', vp.ProductoId)), 50),
          LEFT(COALESCE(pm.Nombre, MAX(d.NombreProducto), CONCAT('Producto migrado ', vp.ProductoId)), 255),
          'Producto creado automaticamente por procesamiento de Ventas_Mirror.',
          CAST(pm.UrlImagen AS varchar(500)),
          ISNULL(pm.Estado, 1),
          'sync_ventas_mirror',
          GETDATE(),
          'sync_ventas_mirror',
          GETDATE()
        FROM #VentasPendientes vp
        LEFT JOIN dbo.Productos_Mirror pm
          ON pm.IdProducto = vp.ProductoId
        LEFT JOIN dbo.DetalleDeVenta_Mirror d
          ON d.ProductoId = vp.ProductoId
        LEFT JOIN dbo.producto p
          ON p.id_producto = vp.ProductoId
        WHERE p.id_producto IS NULL
        GROUP BY
          vp.ProductoId,
          pm.Codigo,
          pm.Nombre,
          pm.UrlImagen,
          pm.Estado;

        SET @ProductosInsertados = @@ROWCOUNT;
        SET IDENTITY_INSERT dbo.producto OFF;
      END;

      IF EXISTS (
        SELECT 1
        FROM #VentasPendientes vp
        LEFT JOIN dbo.inventario i ON i.id_inventario = vp.ProductoId
        WHERE i.id_inventario IS NULL
      )
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
          vp.ProductoId,
          LEFT(COALESCE(pm.Codigo, MAX(d.CodigoProducto), CONCAT('MIG-', vp.ProductoId)), 50),
          CAST(ISNULL(pm.PrecioDeCosto, MAX(vp.precio_costo)) AS decimal(18, 2)),
          CAST(ISNULL(pm.PrecioDeVenta, MAX(vp.precio_venta)) AS decimal(18, 2)),
          CAST(pm.PrecioDeMayoreo AS decimal(18, 2)),
          CASE WHEN ISNULL(pm.AplicaAGranel, 0) = 1 THEN 'Granel' ELSE 'Unidad' END,
          CAST(ISNULL(pm.Stock, 0) AS decimal(18, 2)),
          CAST(ISNULL(pm.StockMinimo, 0) AS decimal(18, 2)),
          CAST(pm.StockMaximo AS decimal(18, 2)),
          CONCAT('Categoria ', ISNULL(CAST(pm.CategoriaId AS varchar(20)), '0')),
          CONCAT('Proveedor ', ISNULL(CAST(pm.ProveedorId AS varchar(20)), '0')),
          'sync_ventas_mirror',
          GETDATE(),
          'sync_ventas_mirror',
          GETDATE(),
          vp.ProductoId,
          NULL,
          NULL,
          NULL,
          CAST(ISNULL(pm.PrecioDeCosto, MAX(vp.precio_costo)) AS decimal(18, 0)),
          CAST(ISNULL(pm.PrecioDeVenta, MAX(vp.precio_venta)) AS decimal(18, 0))
        FROM #VentasPendientes vp
        LEFT JOIN dbo.Productos_Mirror pm
          ON pm.IdProducto = vp.ProductoId
        LEFT JOIN dbo.DetalleDeVenta_Mirror d
          ON d.ProductoId = vp.ProductoId
        LEFT JOIN dbo.inventario i
          ON i.id_inventario = vp.ProductoId
        WHERE i.id_inventario IS NULL
        GROUP BY
          vp.ProductoId,
          pm.Codigo,
          pm.PrecioDeCosto,
          pm.PrecioDeVenta,
          pm.PrecioDeMayoreo,
          pm.AplicaAGranel,
          pm.Stock,
          pm.StockMinimo,
          pm.StockMaximo,
          pm.CategoriaId,
          pm.ProveedorId;

        SET @InventariosInsertados = @@ROWCOUNT;
        SET IDENTITY_INSERT dbo.inventario OFF;
      END;
    END;

    DISABLE TRIGGER dbo.TRG_VENTA_STOCK_LOG ON dbo.VENTA_EFECTIVO;
    DISABLE TRIGGER dbo.TRG_VENTA_CREDITO_STOCK_LOG ON dbo.VENTA_CREDITO;
    DISABLE TRIGGER dbo.TRG_VENTA_TRANSFERENCIA_STOCK_LOG ON dbo.VENTA_TRANSFERENCIA;

    INSERT INTO dbo.VENTA_EFECTIVO (
      ID_PD,
      CANT_PD,
      PRECIO_COSTO,
      PRECIO_VENTA,
      UTILIDAD,
      USUARIO,
      FECHA_HORA,
      ID_TP,
      ID_CLIENTE,
      ID_ESTADO_VENTA,
      ID_FACT
    )
    SELECT
      ProductoId,
      cantidad_pendiente,
      precio_costo,
      precio_venta,
      CAST((precio_venta - precio_costo) * cantidad_pendiente AS decimal(18, 2)),
      CAST(UsuarioId AS varchar(30)),
      CONVERT(varchar(50), Fecha, 120),
      1,
      ClienteId,
      CASE WHEN Estado = 1 THEN 2 ELSE 3 END,
      IdVenta
    FROM #VentasPendientes
    WHERE tipo = 'EFECTIVO'
      AND cantidad_pendiente > 0;

    SET @EfectivoInsertadas = @@ROWCOUNT;

    INSERT INTO dbo.VENTA_CREDITO (
      ID_PD,
      CANT_PD,
      PRECIO_COSTO,
      PRECIO_VENTA,
      UTILIDAD,
      USUARIO,
      ID_CLIENTE,
      ID_TP,
      FECHA_HORA,
      ID_ESTADO_VENTA,
      ID_FACT
    )
    SELECT
      ProductoId,
      cantidad_pendiente,
      precio_costo,
      precio_venta,
      CAST((precio_venta - precio_costo) * cantidad_pendiente AS decimal(18, 2)),
      CAST(UsuarioId AS varchar(30)),
      ClienteId,
      2,
      CONVERT(varchar(50), Fecha, 120),
      CASE WHEN Estado = 1 THEN 2 ELSE 3 END,
      IdVenta
    FROM #VentasPendientes
    WHERE tipo = 'CREDITO'
      AND cantidad_pendiente > 0;

    SET @CreditoInsertadas = @@ROWCOUNT;

    INSERT INTO dbo.VENTA_TRANSFERENCIA (
      ID_PD,
      CANT_PD,
      PRECIO_COSTO,
      PRECIO_VENTA,
      UTILIDAD,
      USUARIO,
      ID_CLIENTE,
      ID_TP,
      FECHA_HORA,
      ID_ESTADO_VENTA,
      ID_FACT
    )
    SELECT
      ProductoId,
      cantidad_pendiente,
      precio_costo,
      precio_venta,
      CAST((precio_venta - precio_costo) * cantidad_pendiente AS decimal(18, 2)),
      CAST(UsuarioId AS varchar(30)),
      ClienteId,
      3,
      CONVERT(varchar(50), Fecha, 120),
      CASE WHEN Estado = 1 THEN 2 ELSE 3 END,
      IdVenta
    FROM #VentasPendientes
    WHERE tipo = 'TRANSFERENCIA'
      AND cantidad_pendiente > 0;

    SET @TransferenciaInsertadas = @@ROWCOUNT;

    ENABLE TRIGGER dbo.TRG_VENTA_STOCK_LOG ON dbo.VENTA_EFECTIVO;
    ENABLE TRIGGER dbo.TRG_VENTA_CREDITO_STOCK_LOG ON dbo.VENTA_CREDITO;
    ENABLE TRIGGER dbo.TRG_VENTA_TRANSFERENCIA_STOCK_LOG ON dbo.VENTA_TRANSFERENCIA;

    IF OBJECT_ID(N'dbo.sync_log', N'U') IS NOT NULL
    BEGIN
      INSERT INTO dbo.sync_log (TableName, OperationType, RecordId, SyncDate, Status, Message)
      VALUES (
        'VENTAS_FINANCIERAS',
        'PROCESS',
        0,
        GETDATE(),
        'OK',
        CONCAT(
          'Efectivo=', @EfectivoInsertadas,
          '; Credito=', @CreditoInsertadas,
          '; Transferencia=', @TransferenciaInsertadas,
          '; Productos=', @ProductosInsertados,
          '; Inventarios=', @InventariosInsertados
        )
      );
    END;

    COMMIT TRANSACTION;

    SELECT
      @EfectivoInsertadas AS efectivo_insertadas,
      @CreditoInsertadas AS credito_insertadas,
      @TransferenciaInsertadas AS transferencia_insertadas,
      @ProductosInsertados AS productos_insertados,
      @InventariosInsertados AS inventarios_insertados;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0
    BEGIN
      ROLLBACK TRANSACTION;
    END;

    BEGIN TRY
      ENABLE TRIGGER dbo.TRG_VENTA_STOCK_LOG ON dbo.VENTA_EFECTIVO;
      ENABLE TRIGGER dbo.TRG_VENTA_CREDITO_STOCK_LOG ON dbo.VENTA_CREDITO;
      ENABLE TRIGGER dbo.TRG_VENTA_TRANSFERENCIA_STOCK_LOG ON dbo.VENTA_TRANSFERENCIA;
    END TRY
    BEGIN CATCH
    END CATCH;

    BEGIN TRY
      SET IDENTITY_INSERT dbo.producto OFF;
    END TRY
    BEGIN CATCH
    END CATCH;

    BEGIN TRY
      SET IDENTITY_INSERT dbo.inventario OFF;
    END TRY
    BEGIN CATCH
    END CATCH;

    IF OBJECT_ID(N'dbo.sync_errors', N'U') IS NOT NULL
    BEGIN
      INSERT INTO dbo.sync_errors (TableName, OperationType, RecordId, ErrorMessage)
      VALUES ('VENTAS_FINANCIERAS', 'PROCESS', 0, ERROR_MESSAGE());
    END;

    THROW;
  END CATCH;
END;
