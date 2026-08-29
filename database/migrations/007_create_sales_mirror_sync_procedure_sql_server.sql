CREATE OR ALTER PROCEDURE dbo.sp_SincronizarVentasMirrorDesdeOriginal
  @FechaInicio DATETIME = NULL,
  @FechaFin DATETIME = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE
    @VentasInsertadas INT = 0,
    @VentasActualizadas INT = 0,
    @DetallesInsertados INT = 0,
    @DetallesActualizados INT = 0;

  DECLARE @VentasActions TABLE (accion NVARCHAR(10) NOT NULL);
  DECLARE @DetallesActions TABLE (accion NVARCHAR(10) NOT NULL);

  IF DB_ID(N'DBSistemaPuntoDeVenta') IS NULL
  BEGIN
    THROW 51010, 'No existe la base origen DBSistemaPuntoDeVenta en esta instancia.', 1;
  END;

  IF OBJECT_ID(N'DBSistemaPuntoDeVenta.dbo.Ventas', N'U') IS NULL
     OR OBJECT_ID(N'DBSistemaPuntoDeVenta.dbo.DetalleDeVenta', N'U') IS NULL
  BEGIN
    THROW 51011, 'No existen las tablas origen DBSistemaPuntoDeVenta.dbo.Ventas o dbo.DetalleDeVenta.', 1;
  END;

  IF OBJECT_ID(N'dbo.Ventas_Mirror', N'U') IS NULL
     OR OBJECT_ID(N'dbo.DetalleDeVenta_Mirror', N'U') IS NULL
  BEGIN
    THROW 51012, 'No existen las tablas destino dbo.Ventas_Mirror o dbo.DetalleDeVenta_Mirror en la base actual.', 1;
  END;

  BEGIN TRY
    BEGIN TRANSACTION;

    ;WITH VentasOrigen AS (
      SELECT
        v.IdVenta,
        v.ClienteId,
        v.UsuarioId,
        v.TipoComprobante,
        v.SerieComprobante,
        v.NumeroComprobante,
        v.Fecha,
        v.SubTotal,
        v.Impuesto,
        v.Total,
        v.Estado,
        v.MontoEfectivo,
        v.MontoCredito,
        v.GananciaConImpuesto,
        v.GananciaSinImpuesto,
        v.Observaciones,
        v.CostoTotal,
        v.MontoTarjeta,
        v.MontoTransferencia,
        v.MontoOtro,
        v.FormaDePago,
        v.OtraMoneda,
        v.TipoDeCambio,
        v.Moneda,
        v.SimboloDeMoneda
      FROM DBSistemaPuntoDeVenta.dbo.Ventas v
      WHERE (@FechaInicio IS NULL OR v.Fecha >= @FechaInicio)
        AND (@FechaFin IS NULL OR v.Fecha <= @FechaFin)
    )
    MERGE dbo.Ventas_Mirror AS target
    USING VentasOrigen AS source
      ON target.IdVenta = source.IdVenta
    WHEN MATCHED THEN
      UPDATE SET
        ClienteId = source.ClienteId,
        UsuarioId = source.UsuarioId,
        TipoComprobante = source.TipoComprobante,
        SerieComprobante = source.SerieComprobante,
        NumeroComprobante = source.NumeroComprobante,
        Fecha = source.Fecha,
        SubTotal = source.SubTotal,
        Impuesto = source.Impuesto,
        Total = source.Total,
        Estado = source.Estado,
        MontoEfectivo = source.MontoEfectivo,
        MontoCredito = source.MontoCredito,
        GananciaConImpuesto = source.GananciaConImpuesto,
        GananciaSinImpuesto = source.GananciaSinImpuesto,
        Observaciones = source.Observaciones,
        CostoTotal = source.CostoTotal,
        MontoTarjeta = source.MontoTarjeta,
        MontoTransferencia = source.MontoTransferencia,
        MontoOtro = source.MontoOtro,
        FormaDePago = source.FormaDePago,
        OtraMoneda = source.OtraMoneda,
        TipoDeCambio = source.TipoDeCambio,
        Moneda = source.Moneda,
        SimboloDeMoneda = source.SimboloDeMoneda,
        SourceDB = 'DBSistemaPuntoDeVenta',
        SyncDate = GETDATE()
    WHEN NOT MATCHED BY TARGET THEN
      INSERT (
        IdVenta,
        ClienteId,
        UsuarioId,
        TipoComprobante,
        SerieComprobante,
        NumeroComprobante,
        Fecha,
        SubTotal,
        Impuesto,
        Total,
        Estado,
        MontoEfectivo,
        MontoCredito,
        GananciaConImpuesto,
        GananciaSinImpuesto,
        Observaciones,
        CostoTotal,
        MontoTarjeta,
        MontoTransferencia,
        MontoOtro,
        FormaDePago,
        OtraMoneda,
        TipoDeCambio,
        Moneda,
        SimboloDeMoneda,
        SourceDB,
        SyncDate,
        Processed
      )
      VALUES (
        source.IdVenta,
        source.ClienteId,
        source.UsuarioId,
        source.TipoComprobante,
        source.SerieComprobante,
        source.NumeroComprobante,
        source.Fecha,
        source.SubTotal,
        source.Impuesto,
        source.Total,
        source.Estado,
        source.MontoEfectivo,
        source.MontoCredito,
        source.GananciaConImpuesto,
        source.GananciaSinImpuesto,
        source.Observaciones,
        source.CostoTotal,
        source.MontoTarjeta,
        source.MontoTransferencia,
        source.MontoOtro,
        source.FormaDePago,
        source.OtraMoneda,
        source.TipoDeCambio,
        source.Moneda,
        source.SimboloDeMoneda,
        'DBSistemaPuntoDeVenta',
        GETDATE(),
        0
      )
    OUTPUT $action INTO @VentasActions;

    ;WITH DetallesOrigen AS (
      SELECT
        d.IdDetalleDeVenta,
        d.VentaId,
        d.ProductoId,
        d.Cantidad,
        d.Precio,
        d.Descuento,
        d.CodigoProducto,
        d.NombreProducto,
        d.EsUnPack
      FROM DBSistemaPuntoDeVenta.dbo.DetalleDeVenta d
      INNER JOIN DBSistemaPuntoDeVenta.dbo.Ventas v
        ON v.IdVenta = d.VentaId
      WHERE (@FechaInicio IS NULL OR v.Fecha >= @FechaInicio)
        AND (@FechaFin IS NULL OR v.Fecha <= @FechaFin)
    )
    MERGE dbo.DetalleDeVenta_Mirror AS target
    USING DetallesOrigen AS source
      ON target.IdDetalleDeVenta = source.IdDetalleDeVenta
    WHEN MATCHED THEN
      UPDATE SET
        VentaId = source.VentaId,
        ProductoId = source.ProductoId,
        Cantidad = source.Cantidad,
        Precio = source.Precio,
        Descuento = source.Descuento,
        CodigoProducto = source.CodigoProducto,
        NombreProducto = source.NombreProducto,
        EsUnPack = source.EsUnPack,
        SourceDB = 'DBSistemaPuntoDeVenta',
        SyncDate = GETDATE()
    WHEN NOT MATCHED BY TARGET THEN
      INSERT (
        IdDetalleDeVenta,
        VentaId,
        ProductoId,
        Cantidad,
        Precio,
        Descuento,
        CodigoProducto,
        NombreProducto,
        EsUnPack,
        SourceDB,
        SyncDate,
        Processed
      )
      VALUES (
        source.IdDetalleDeVenta,
        source.VentaId,
        source.ProductoId,
        source.Cantidad,
        source.Precio,
        source.Descuento,
        source.CodigoProducto,
        source.NombreProducto,
        source.EsUnPack,
        'DBSistemaPuntoDeVenta',
        GETDATE(),
        0
      )
    OUTPUT $action INTO @DetallesActions;

    SELECT
      @VentasInsertadas = SUM(CASE WHEN accion = 'INSERT' THEN 1 ELSE 0 END),
      @VentasActualizadas = SUM(CASE WHEN accion = 'UPDATE' THEN 1 ELSE 0 END)
    FROM @VentasActions;

    SELECT
      @DetallesInsertados = SUM(CASE WHEN accion = 'INSERT' THEN 1 ELSE 0 END),
      @DetallesActualizados = SUM(CASE WHEN accion = 'UPDATE' THEN 1 ELSE 0 END)
    FROM @DetallesActions;

    SET @VentasInsertadas = ISNULL(@VentasInsertadas, 0);
    SET @VentasActualizadas = ISNULL(@VentasActualizadas, 0);
    SET @DetallesInsertados = ISNULL(@DetallesInsertados, 0);
    SET @DetallesActualizados = ISNULL(@DetallesActualizados, 0);

    IF OBJECT_ID(N'dbo.sync_log', N'U') IS NOT NULL
    BEGIN
      INSERT INTO dbo.sync_log (TableName, OperationType, RecordId, SyncDate, Status, Message)
      VALUES
        (
          'Ventas_Mirror',
          'MERGE',
          0,
          GETDATE(),
          'OK',
          CONCAT('Insertadas=', @VentasInsertadas, '; Actualizadas=', @VentasActualizadas)
        ),
        (
          'DetalleDeVenta_Mirror',
          'MERGE',
          0,
          GETDATE(),
          'OK',
          CONCAT('Insertados=', @DetallesInsertados, '; Actualizados=', @DetallesActualizados)
        );
    END;

    COMMIT TRANSACTION;

    SELECT
      @VentasInsertadas AS ventas_insertadas,
      @VentasActualizadas AS ventas_actualizadas,
      @DetallesInsertados AS detalles_insertados,
      @DetallesActualizados AS detalles_actualizados;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
      ROLLBACK TRANSACTION;
    END;

    IF OBJECT_ID(N'dbo.sync_errors', N'U') IS NOT NULL
    BEGIN
      INSERT INTO dbo.sync_errors (TableName, OperationType, RecordId, ErrorMessage)
      VALUES ('VENTAS_MIRROR', 'MERGE', 0, ERROR_MESSAGE());
    END;

    THROW;
  END CATCH;
END;
