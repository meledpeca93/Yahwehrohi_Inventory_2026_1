/*
  Reconciliacion para lanzamiento del nuevo sistema.

  Fuente de lectura: DBSistemaPuntoDeVenta.
  Destino de escritura: yahweh_rohi_inventory.

  Este script no modifica DBSistemaPuntoDeVenta.
*/

SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF DB_ID(N'DBSistemaPuntoDeVenta') IS NULL
  BEGIN
    THROW 51030, 'No existe la base origen DBSistemaPuntoDeVenta.', 1;
  END;

  EXEC dbo.sp_SincronizarVentasMirrorDesdeOriginal;

  IF OBJECT_ID(N'dbo.COMPRA_EFECTIVO_BACKUP_PRE_LAUNCH', N'U') IS NULL
  BEGIN
    SELECT *
    INTO dbo.COMPRA_EFECTIVO_BACKUP_PRE_LAUNCH
    FROM dbo.COMPRA_EFECTIVO;
  END;

  IF OBJECT_ID(N'dbo.COMPRA_CREDITO_BACKUP_PRE_LAUNCH', N'U') IS NULL
  BEGIN
    SELECT *
    INTO dbo.COMPRA_CREDITO_BACKUP_PRE_LAUNCH
    FROM dbo.COMPRA_CREDITO;
  END;

  IF OBJECT_ID(N'dbo.VENTA_EFECTIVO_BACKUP_PRE_LAUNCH', N'U') IS NULL
  BEGIN
    SELECT *
    INTO dbo.VENTA_EFECTIVO_BACKUP_PRE_LAUNCH
    FROM dbo.VENTA_EFECTIVO;
  END;

  IF OBJECT_ID(N'dbo.VENTA_CREDITO_BACKUP_PRE_LAUNCH', N'U') IS NULL
  BEGIN
    SELECT *
    INTO dbo.VENTA_CREDITO_BACKUP_PRE_LAUNCH
    FROM dbo.VENTA_CREDITO;
  END;

  IF OBJECT_ID(N'dbo.VENTA_TRANSFERENCIA_BACKUP_PRE_LAUNCH', N'U') IS NULL
  BEGIN
    SELECT *
    INTO dbo.VENTA_TRANSFERENCIA_BACKUP_PRE_LAUNCH
    FROM dbo.VENTA_TRANSFERENCIA;
  END;

  ALTER TABLE dbo.COMPRA_EFECTIVO ALTER COLUMN CANT_PD decimal(18, 3) NOT NULL;
  ALTER TABLE dbo.COMPRA_EFECTIVO ALTER COLUMN PRECIO_COSTO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.COMPRA_CREDITO ALTER COLUMN CANT_PD decimal(18, 3) NOT NULL;
  ALTER TABLE dbo.COMPRA_CREDITO ALTER COLUMN PRECIO_COSTO decimal(18, 2) NOT NULL;

  ALTER TABLE dbo.VENTA_EFECTIVO ALTER COLUMN CANT_PD decimal(18, 3) NOT NULL;
  ALTER TABLE dbo.VENTA_EFECTIVO ALTER COLUMN PRECIO_COSTO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.VENTA_EFECTIVO ALTER COLUMN PRECIO_VENTA decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.VENTA_EFECTIVO ALTER COLUMN UTILIDAD decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.VENTA_CREDITO ALTER COLUMN CANT_PD decimal(18, 3) NOT NULL;
  ALTER TABLE dbo.VENTA_CREDITO ALTER COLUMN PRECIO_COSTO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.VENTA_CREDITO ALTER COLUMN PRECIO_VENTA decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.VENTA_CREDITO ALTER COLUMN UTILIDAD decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.VENTA_TRANSFERENCIA ALTER COLUMN CANT_PD decimal(18, 3) NOT NULL;
  ALTER TABLE dbo.VENTA_TRANSFERENCIA ALTER COLUMN PRECIO_COSTO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.VENTA_TRANSFERENCIA ALTER COLUMN PRECIO_VENTA decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.VENTA_TRANSFERENCIA ALTER COLUMN UTILIDAD decimal(18, 2) NOT NULL;

  /* Proveedores */
  SET IDENTITY_INSERT dbo.PROVEEDOR ON;

  MERGE dbo.PROVEEDOR AS target
  USING (
    SELECT
      p.IdProveedor,
      p.Nombre,
      p.Telefono,
      p.Estado,
      p.Representante,
      p.Email,
      p.PaginaWeb,
      p.Comentarios,
      compras.COMPRAS_REALIZADAS
    FROM DBSistemaPuntoDeVenta.dbo.Proveedores p
    OUTER APPLY (
      SELECT COUNT(*) AS COMPRAS_REALIZADAS
      FROM DBSistemaPuntoDeVenta.dbo.Compras c
      WHERE c.ProveedorId = p.IdProveedor
    ) compras
  ) AS source
    ON target.ID_PROVEEDOR = source.IdProveedor
  WHEN MATCHED THEN
    UPDATE SET
      NOMBRE = LEFT(source.Nombre, 100),
      TELEFONO = LEFT(ISNULL(source.Telefono, '00000000'), 12),
      DIRECCION = LEFT(CONCAT(
        'Representante: ', ISNULL(source.Representante, ''),
        '; Email: ', ISNULL(source.Email, ''),
        '; Web: ', ISNULL(source.PaginaWeb, ''),
        '; Comentarios: ', ISNULL(source.Comentarios, '')
      ), 500),
      CREDITO_ABIERTO = 0,
      COMPRAS_REALIZADAS = source.COMPRAS_REALIZADAS,
      FECHA_HORA = CONVERT(varchar(50), GETDATE(), 120)
  WHEN NOT MATCHED BY TARGET THEN
    INSERT (
      ID_PROVEEDOR,
      NOMBRE,
      TELEFONO,
      DIRECCION,
      CREDITO_ABIERTO,
      COMPRAS_REALIZADAS,
      FECHA_HORA
    )
    VALUES (
      source.IdProveedor,
      LEFT(source.Nombre, 100),
      LEFT(ISNULL(source.Telefono, '00000000'), 12),
      LEFT(CONCAT(
        'Representante: ', ISNULL(source.Representante, ''),
        '; Email: ', ISNULL(source.Email, ''),
        '; Web: ', ISNULL(source.PaginaWeb, ''),
        '; Comentarios: ', ISNULL(source.Comentarios, '')
      ), 500),
      0,
      source.COMPRAS_REALIZADAS,
      CONVERT(varchar(50), GETDATE(), 120)
    );

  SET IDENTITY_INSERT dbo.PROVEEDOR OFF;

  /* Productos faltantes desde origen */
  IF EXISTS (
    SELECT 1
    FROM DBSistemaPuntoDeVenta.dbo.Productos op
    LEFT JOIN dbo.producto p ON p.id_producto = op.IdProducto
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
      op.IdProducto,
      LEFT(op.Codigo, 50),
      LEFT(op.Nombre, 255),
      CONCAT('Ubicacion: ', ISNULL(op.Ubicacion, ''), '; CategoriaId: ', op.CategoriaId),
      CAST(op.UrlImagen AS varchar(500)),
      op.Estado,
      'sync_lanzamiento',
      GETDATE(),
      'sync_lanzamiento',
      GETDATE()
    FROM DBSistemaPuntoDeVenta.dbo.Productos op
    LEFT JOIN dbo.producto p ON p.id_producto = op.IdProducto
    WHERE p.id_producto IS NULL;

    SET IDENTITY_INSERT dbo.producto OFF;
  END;

  UPDATE p
  SET
    p.codigo = LEFT(op.Codigo, 50),
    p.nombre = LEFT(op.Nombre, 255),
    p.descripcion = CONCAT('Ubicacion: ', ISNULL(op.Ubicacion, ''), '; CategoriaId: ', op.CategoriaId),
    p.imagen_url = CAST(op.UrlImagen AS varchar(500)),
    p.activo = op.Estado,
    p.actualizado_por = 'sync_lanzamiento',
    p.actualizado_en = GETDATE()
  FROM dbo.producto p
  INNER JOIN DBSistemaPuntoDeVenta.dbo.Productos op
    ON op.IdProducto = p.id_producto;

  IF EXISTS (
    SELECT 1
    FROM DBSistemaPuntoDeVenta.dbo.Productos op
    LEFT JOIN dbo.inventario i ON i.id_inventario = op.IdProducto
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
      op.IdProducto,
      LEFT(op.Codigo, 50),
      CAST(ISNULL(op.PrecioDeCosto, 0) AS decimal(18, 2)),
      CAST(ISNULL(op.PrecioDeVenta, 0) AS decimal(18, 2)),
      CAST(op.PrecioDeMayoreo AS decimal(18, 2)),
      CASE WHEN op.AplicaAGranel = 1 THEN 'Granel' ELSE 'Unidad' END,
      CAST(ISNULL(op.Stock, 0) AS decimal(18, 2)),
      CAST(ISNULL(op.StockMinimo, 0) AS decimal(18, 2)),
      CAST(op.StockMaximo AS decimal(18, 2)),
      CONCAT('Categoria ', op.CategoriaId),
      LEFT(ISNULL(pr.Nombre, CONCAT('Proveedor ', op.ProveedorId)), 150),
      'sync_lanzamiento',
      GETDATE(),
      'sync_lanzamiento',
      GETDATE(),
      op.IdProducto,
      NULL,
      NULL,
      NULL,
      CAST(ISNULL(op.PrecioDeCosto, 0) AS decimal(18, 2)),
      CAST(ISNULL(op.PrecioDeVenta, 0) AS decimal(18, 2))
    FROM DBSistemaPuntoDeVenta.dbo.Productos op
    LEFT JOIN DBSistemaPuntoDeVenta.dbo.Proveedores pr
      ON pr.IdProveedor = op.ProveedorId
    LEFT JOIN dbo.inventario i
      ON i.id_inventario = op.IdProducto
    WHERE i.id_inventario IS NULL;

    SET IDENTITY_INSERT dbo.inventario OFF;
  END;

  UPDATE i
  SET
    i.codigo = LEFT(op.Codigo, 50),
    i.precio_costo = CAST(ISNULL(op.PrecioDeCosto, 0) AS decimal(18, 2)),
    i.precio_venta = CAST(ISNULL(op.PrecioDeVenta, 0) AS decimal(18, 2)),
    i.precio_mayoreo = CAST(op.PrecioDeMayoreo AS decimal(18, 2)),
    i.unidad_medida = CASE WHEN op.AplicaAGranel = 1 THEN 'Granel' ELSE 'Unidad' END,
    i.stock = CAST(ISNULL(op.Stock, 0) AS decimal(18, 2)),
    i.stock_minimo = CAST(ISNULL(op.StockMinimo, 0) AS decimal(18, 2)),
    i.stock_maximo = CAST(op.StockMaximo AS decimal(18, 2)),
    i.categoria = CONCAT('Categoria ', op.CategoriaId),
    i.proveedor = LEFT(ISNULL(pr.Nombre, CONCAT('Proveedor ', op.ProveedorId)), 150),
    i.actualizado_por = 'sync_lanzamiento',
    i.actualizado_en = GETDATE(),
    i.id_pd = op.IdProducto,
    i.PRECIO_COSTO_OPERATIVO = CAST(ISNULL(op.PrecioDeCosto, 0) AS decimal(18, 0)),
    i.PRECIO_VENTA_OPERATIVO = CAST(ISNULL(op.PrecioDeVenta, 0) AS decimal(18, 0))
  FROM dbo.inventario i
  INNER JOIN DBSistemaPuntoDeVenta.dbo.Productos op
    ON op.IdProducto = i.id_inventario
  LEFT JOIN DBSistemaPuntoDeVenta.dbo.Proveedores pr
    ON pr.IdProveedor = op.ProveedorId;

  /* Reconstruir ventas desde espejo, sin triggers para no volver a descontar stock. */
  DISABLE TRIGGER dbo.TRG_VENTA_STOCK_LOG ON dbo.VENTA_EFECTIVO;
  DISABLE TRIGGER dbo.TRG_VENTA_CREDITO_STOCK_LOG ON dbo.VENTA_CREDITO;
  DISABLE TRIGGER dbo.TRG_VENTA_TRANSFERENCIA_STOCK_LOG ON dbo.VENTA_TRANSFERENCIA;

  DELETE FROM dbo.VENTA_TRANSFERENCIA;
  DELETE FROM dbo.VENTA_CREDITO;
  DELETE FROM dbo.VENTA_EFECTIVO;

  DBCC CHECKIDENT ('dbo.VENTA_EFECTIVO', RESEED, 0) WITH NO_INFOMSGS;
  DBCC CHECKIDENT ('dbo.VENTA_CREDITO', RESEED, 0) WITH NO_INFOMSGS;
  DBCC CHECKIDENT ('dbo.VENTA_TRANSFERENCIA', RESEED, 0) WITH NO_INFOMSGS;

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
    d.ProductoId,
    CAST(d.Cantidad AS decimal(18, 3)),
    CAST(ISNULL(pm.PrecioDeCosto, 0) AS decimal(18, 2)),
    CAST(d.Precio AS decimal(18, 2)),
    CAST((d.Precio - ISNULL(pm.PrecioDeCosto, 0)) * d.Cantidad AS decimal(18, 2)),
    CAST(v.UsuarioId AS varchar(30)),
    CONVERT(varchar(50), v.Fecha, 120),
    1,
    v.ClienteId,
    CASE WHEN v.Estado = 1 THEN 2 ELSE 3 END,
    v.IdVenta
  FROM dbo.DetalleDeVenta_Mirror d
  INNER JOIN dbo.Ventas_Mirror v
    ON v.IdVenta = d.VentaId
  LEFT JOIN dbo.Productos_Mirror pm
    ON pm.IdProducto = d.ProductoId
  WHERE v.MontoEfectivo > 0
    AND d.ProductoId IS NOT NULL;

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
    d.ProductoId,
    CAST(d.Cantidad AS decimal(18, 3)),
    CAST(ISNULL(pm.PrecioDeCosto, 0) AS decimal(18, 2)),
    CAST(d.Precio AS decimal(18, 2)),
    CAST((d.Precio - ISNULL(pm.PrecioDeCosto, 0)) * d.Cantidad AS decimal(18, 2)),
    CAST(v.UsuarioId AS varchar(30)),
    v.ClienteId,
    2,
    CONVERT(varchar(50), v.Fecha, 120),
    CASE WHEN v.Estado = 1 THEN 2 ELSE 3 END,
    v.IdVenta
  FROM dbo.DetalleDeVenta_Mirror d
  INNER JOIN dbo.Ventas_Mirror v
    ON v.IdVenta = d.VentaId
  LEFT JOIN dbo.Productos_Mirror pm
    ON pm.IdProducto = d.ProductoId
  WHERE v.MontoCredito > 0
    AND d.ProductoId IS NOT NULL;

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
    d.ProductoId,
    CAST(d.Cantidad AS decimal(18, 3)),
    CAST(ISNULL(pm.PrecioDeCosto, 0) AS decimal(18, 2)),
    CAST(d.Precio AS decimal(18, 2)),
    CAST((d.Precio - ISNULL(pm.PrecioDeCosto, 0)) * d.Cantidad AS decimal(18, 2)),
    CAST(v.UsuarioId AS varchar(30)),
    v.ClienteId,
    3,
    CONVERT(varchar(50), v.Fecha, 120),
    CASE WHEN v.Estado = 1 THEN 2 ELSE 3 END,
    v.IdVenta
  FROM dbo.DetalleDeVenta_Mirror d
  INNER JOIN dbo.Ventas_Mirror v
    ON v.IdVenta = d.VentaId
  LEFT JOIN dbo.Productos_Mirror pm
    ON pm.IdProducto = d.ProductoId
  WHERE v.MontoTransferencia > 0
    AND d.ProductoId IS NOT NULL;

  ENABLE TRIGGER dbo.TRG_VENTA_STOCK_LOG ON dbo.VENTA_EFECTIVO;
  ENABLE TRIGGER dbo.TRG_VENTA_CREDITO_STOCK_LOG ON dbo.VENTA_CREDITO;
  ENABLE TRIGGER dbo.TRG_VENTA_TRANSFERENCIA_STOCK_LOG ON dbo.VENTA_TRANSFERENCIA;

  /* Reconstruir compras desde origen. */
  DELETE FROM dbo.COMPRA_CREDITO;
  DELETE FROM dbo.COMPRA_EFECTIVO;

  DBCC CHECKIDENT ('dbo.COMPRA_EFECTIVO', RESEED, 0) WITH NO_INFOMSGS;
  DBCC CHECKIDENT ('dbo.COMPRA_CREDITO', RESEED, 0) WITH NO_INFOMSGS;

  SET IDENTITY_INSERT dbo.COMPRA_EFECTIVO ON;

  INSERT INTO dbo.COMPRA_EFECTIVO (
    ID_CEFECT,
    ID_PD,
    CANT_PD,
    PRECIO_COSTO,
    ID_USUARIO,
    FECHA_HORA,
    ID_TP,
    ID_PROVEEDOR,
    ID_ESTADO_COMPRA,
    NUM_FACT
  )
  SELECT
    dc.IdDetalleDeCompra,
    dc.ProductoId,
    CAST(dc.Cantidad AS decimal(18, 3)),
    CAST(ISNULL(dc.PrecioCompra, ISNULL(op.PrecioDeCosto, 0)) AS decimal(18, 2)),
    ISNULL(c.UsuarioId, 1),
    CONVERT(varchar(50), ISNULL(c.FechaRecepcion, c.Fecha), 120),
    1,
    c.ProveedorId,
    CASE WHEN c.Estado = 1 THEN 4 ELSE 3 END,
    CAST(c.IdCompra AS varchar(50))
  FROM DBSistemaPuntoDeVenta.dbo.DetalleDeCompras dc
  INNER JOIN DBSistemaPuntoDeVenta.dbo.Compras c
    ON c.IdCompra = dc.CompraId
  LEFT JOIN DBSistemaPuntoDeVenta.dbo.Productos op
    ON op.IdProducto = dc.ProductoId
  ORDER BY dc.IdDetalleDeCompra;

  SET IDENTITY_INSERT dbo.COMPRA_EFECTIVO OFF;

  IF OBJECT_ID(N'dbo.sync_log', N'U') IS NOT NULL
  BEGIN
    INSERT INTO dbo.sync_log (TableName, OperationType, RecordId, SyncDate, Status, Message)
    VALUES (
      'RECONCILIACION_LANZAMIENTO',
      'SYNC',
      0,
      GETDATE(),
      'OK',
      'Ventas, compras, productos, inventario y proveedores reconciliados contra DBSistemaPuntoDeVenta.'
    );
  END;

  COMMIT TRANSACTION;

  SELECT
    (SELECT COUNT(*) FROM dbo.Ventas_Mirror) AS ventas_mirror,
    (SELECT COUNT(*) FROM DBSistemaPuntoDeVenta.dbo.Ventas) AS ventas_origen,
    (SELECT COUNT(*) FROM dbo.DetalleDeVenta_Mirror) AS detalle_ventas_mirror,
    (SELECT COUNT(*) FROM DBSistemaPuntoDeVenta.dbo.DetalleDeVenta) AS detalle_ventas_origen,
    (SELECT COUNT(*) FROM dbo.COMPRA_EFECTIVO) AS compra_efectivo,
    (SELECT COUNT(*) FROM DBSistemaPuntoDeVenta.dbo.DetalleDeCompras) AS detalle_compras_origen,
    (SELECT COUNT(*) FROM dbo.PROVEEDOR) AS proveedores_nueva,
    (SELECT COUNT(*) FROM DBSistemaPuntoDeVenta.dbo.Proveedores) AS proveedores_origen,
    (SELECT COUNT(*) FROM dbo.producto p INNER JOIN DBSistemaPuntoDeVenta.dbo.Productos op ON op.IdProducto = p.id_producto) AS productos_origen_en_nueva,
    (SELECT COUNT(*) FROM DBSistemaPuntoDeVenta.dbo.Productos) AS productos_origen,
    (SELECT COUNT(*) FROM dbo.inventario i INNER JOIN DBSistemaPuntoDeVenta.dbo.Productos op ON op.IdProducto = i.id_inventario) AS inventarios_origen_en_nueva;
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
    SET IDENTITY_INSERT dbo.PROVEEDOR OFF;
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

  BEGIN TRY
    SET IDENTITY_INSERT dbo.COMPRA_EFECTIVO OFF;
  END TRY
  BEGIN CATCH
  END CATCH;

  IF OBJECT_ID(N'dbo.sync_errors', N'U') IS NOT NULL
  BEGIN
    INSERT INTO dbo.sync_errors (TableName, OperationType, RecordId, ErrorMessage)
    VALUES ('RECONCILIACION_LANZAMIENTO', 'SYNC', 0, ERROR_MESSAGE());
  END;

  THROW;
END CATCH;
