/*
  Migracion del historico de cortes desde la BD oficial DBSistemaPuntoDeVenta.

  Alcance:
  - No modifica DBSistemaPuntoDeVenta.
  - No toca cortes de la BD nueva posteriores a 2026-06-10.
  - Respalda los cortes historicos actuales de yahweh_rohi_inventory antes de reemplazarlos.
  - Conserva el IdCorte original como ID_CORTE para facilitar auditoria entre bases.
*/

SET XACT_ABORT ON;

DECLARE @cutoff_date date = '2026-06-10';

BEGIN TRY
  BEGIN TRANSACTION;

  IF DB_ID(N'DBSistemaPuntoDeVenta') IS NULL
  BEGIN
    THROW 51060, 'No existe la base origen DBSistemaPuntoDeVenta.', 1;
  END;

  IF OBJECT_ID(N'dbo.CORTE_DIARIO', N'U') IS NULL
  BEGIN
    THROW 51061, 'No existe la tabla destino dbo.CORTE_DIARIO.', 1;
  END;

  IF OBJECT_ID(N'dbo.CORTE_DIARIO_BACKUP_PRE_HISTORY_20260610', N'U') IS NULL
  BEGIN
    SELECT *
    INTO dbo.CORTE_DIARIO_BACKUP_PRE_HISTORY_20260610
    FROM dbo.CORTE_DIARIO
    WHERE TRY_CONVERT(date, FECHA_CORTE) <= @cutoff_date;
  END;

  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN VENTA_TOTAL_DIA decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN DINERO_INICIA_CAJA decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN VENTA_EFECTIVO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN VENTA_TRANSFERENCIA decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN VENTA_CREDITO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN ABONOS_CREDITO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN ENTRADA_DE_DINERO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN SALIDA_DE_DINERO decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN TOTAL_EN_CAJA decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN GANANCIA_DEL_DIA decimal(18, 2) NOT NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN DIFERENCIA decimal(18, 2) NULL;
  ALTER TABLE dbo.CORTE_DIARIO ALTER COLUMN TOTAL_CALCULADO decimal(18, 2) NULL;

  DELETE FROM dbo.CORTE_DIARIO
  WHERE TRY_CONVERT(date, FECHA_CORTE) <= @cutoff_date;

  SET IDENTITY_INSERT dbo.CORTE_DIARIO ON;

  WITH source_cuts AS (
    SELECT
      c.IdCorte,
      c.FechaInicio,
      c.FechaFin,
      c.TotalIngresos,
      c.TotalEgresos,
      c.DineroInicial,
      c.TotalCalculado,
      c.TotalReal,
      c.Diferencia,
      c.UsuarioId,
      c.Estado
    FROM DBSistemaPuntoDeVenta.dbo.Corte c
    WHERE CAST(c.FechaInicio AS date) <= @cutoff_date
  ),
  source_totals AS (
    SELECT
      c.IdCorte,
      CONVERT(varchar(19), c.FechaInicio, 120) AS FechaCorte,
      ISNULL(c.UsuarioId, 1) AS UsuarioId,
      CAST(ISNULL(c.DineroInicial, 0) AS decimal(18, 2)) AS DineroInicial,
      CAST(ISNULL(v.VentaTotal, 0) AS decimal(18, 2)) AS VentaTotal,
      CAST(ISNULL(v.VentaCredito, 0) AS decimal(18, 2)) AS VentaCredito,
      CAST(ISNULL(v.VentaTransferencia, 0) AS decimal(18, 2)) AS VentaTransferencia,
      CAST(ISNULL(v.VentaEfectivo, 0) AS decimal(18, 2)) AS VentaEfectivo,
      CAST(ISNULL(a.AbonosCredito, 0) AS decimal(18, 2)) AS AbonosCredito,
      CAST(ISNULL(i.Entradas, ISNULL(c.TotalIngresos, 0)) AS decimal(18, 2)) AS Entradas,
      CAST(ISNULL(s.Salidas, ISNULL(c.TotalEgresos, 0)) AS decimal(18, 2)) AS Salidas,
      CAST(ISNULL(v.Ganancia, 0) AS decimal(18, 2)) AS Ganancia,
      CAST(
        ISNULL(
          c.TotalCalculado,
          ISNULL(c.DineroInicial, 0)
            + ISNULL(v.VentaEfectivo, 0)
            + ISNULL(a.AbonosCredito, 0)
            + ISNULL(i.Entradas, ISNULL(c.TotalIngresos, 0))
            - ISNULL(s.Salidas, ISNULL(c.TotalEgresos, 0))
        ) AS decimal(18, 2)
      ) AS TotalCalculado,
      CAST(
        ISNULL(
          c.TotalReal,
          ISNULL(
            c.TotalCalculado,
            ISNULL(c.DineroInicial, 0)
              + ISNULL(v.VentaEfectivo, 0)
              + ISNULL(a.AbonosCredito, 0)
              + ISNULL(i.Entradas, ISNULL(c.TotalIngresos, 0))
              - ISNULL(s.Salidas, ISNULL(c.TotalEgresos, 0))
          )
        ) AS decimal(18, 2)
      ) AS TotalReal,
      CAST(ISNULL(c.Diferencia, 0) AS decimal(18, 2)) AS Diferencia,
      CASE WHEN c.Estado = 1 THEN 1 ELSE 4 END AS EstadoCorte
    FROM source_cuts c
    OUTER APPLY (
      SELECT
        SUM(CASE WHEN ISNULL(v.Estado, 0) = 1 THEN ISNULL(v.Total, 0) ELSE 0 END) AS VentaTotal,
        SUM(CASE WHEN ISNULL(v.Estado, 0) = 1 THEN ISNULL(v.MontoCredito, 0) ELSE 0 END) AS VentaCredito,
        SUM(CASE WHEN ISNULL(v.Estado, 0) = 1 THEN ISNULL(v.MontoTransferencia, 0) + ISNULL(v.MontoTarjeta, 0) + ISNULL(v.MontoOtro, 0) ELSE 0 END) AS VentaTransferencia,
        SUM(CASE WHEN ISNULL(v.Estado, 0) = 1 THEN
          ISNULL(v.Total, 0)
          - ISNULL(v.MontoCredito, 0)
          - ISNULL(v.MontoTransferencia, 0)
          - ISNULL(v.MontoTarjeta, 0)
          - ISNULL(v.MontoOtro, 0)
        ELSE 0 END) AS VentaEfectivo,
        SUM(CASE WHEN ISNULL(v.Estado, 0) = 1 THEN ISNULL(v.GananciaSinImpuesto, ISNULL(v.GananciaConImpuesto, 0)) ELSE 0 END) AS Ganancia
      FROM DBSistemaPuntoDeVenta.dbo.Ventas v
      WHERE v.Fecha >= c.FechaInicio
        AND v.Fecha < ISNULL(c.FechaFin, DATEADD(day, 1, CAST(c.FechaInicio AS date)))
    ) v
    OUTER APPLY (
      SELECT SUM(ac.Monto) AS AbonosCredito
      FROM DBSistemaPuntoDeVenta.dbo.AbonoDeCreditos ac
      WHERE ac.CorteId = c.IdCorte
    ) a
    OUTER APPLY (
      SELECT SUM(ic.Monto) AS Entradas
      FROM DBSistemaPuntoDeVenta.dbo.IngresosCorte ic
      WHERE ic.CorteId = c.IdCorte
    ) i
    OUTER APPLY (
      SELECT SUM(sc.Monto) AS Salidas
      FROM DBSistemaPuntoDeVenta.dbo.SalidasCorte sc
      WHERE sc.CorteId = c.IdCorte
    ) s
  )
  INSERT INTO dbo.CORTE_DIARIO (
    ID_CORTE,
    FECHA_CORTE,
    VENTA_TOTAL_DIA,
    DINERO_INICIA_CAJA,
    VENTA_EFECTIVO,
    VENTA_TRANSFERENCIA,
    VENTA_CREDITO,
    ABONOS_CREDITO,
    ENTRADA_DE_DINERO,
    SALIDA_DE_DINERO,
    TOTAL_EN_CAJA,
    ESTADO_CORTE,
    GANANCIA_DEL_DIA,
    ID_USUARIO,
    DIFERENCIA,
    TOTAL_CALCULADO
  )
  SELECT
    IdCorte,
    FechaCorte,
    VentaTotal,
    DineroInicial,
    VentaEfectivo,
    VentaTransferencia,
    VentaCredito,
    AbonosCredito,
    Entradas,
    Salidas,
    TotalReal,
    EstadoCorte,
    Ganancia,
    UsuarioId,
    Diferencia,
    TotalCalculado
  FROM source_totals
  ORDER BY IdCorte;

  SET IDENTITY_INSERT dbo.CORTE_DIARIO OFF;

  COMMIT TRANSACTION;

  SELECT
    COUNT(*) AS cortes_migrados,
    MIN(TRY_CONVERT(date, FECHA_CORTE)) AS fecha_minima,
    MAX(TRY_CONVERT(date, FECHA_CORTE)) AS fecha_maxima
  FROM dbo.CORTE_DIARIO
  WHERE TRY_CONVERT(date, FECHA_CORTE) <= @cutoff_date;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
  BEGIN
    ROLLBACK TRANSACTION;
  END;

  IF OBJECTPROPERTY(OBJECT_ID(N'dbo.CORTE_DIARIO'), 'TableHasIdentity') = 1
  BEGIN
    BEGIN TRY
      SET IDENTITY_INSERT dbo.CORTE_DIARIO OFF;
    END TRY
    BEGIN CATCH
    END CATCH;
  END;

  THROW;
END CATCH;
