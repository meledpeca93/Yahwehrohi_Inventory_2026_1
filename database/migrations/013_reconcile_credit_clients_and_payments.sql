/*
  Reconciliacion de creditos desde la BD oficial DBSistemaPuntoDeVenta.

  Objetivo:
  - Mantener los nombres de clientes de la BD nueva iguales a la BD vieja.
  - Corregir PAGOS_CREDITO.MONTO para conservar centavos.
  - Reconstruir abonos y aplicaciones de credito desde AbonoDeCreditos.

  Ejecutar conectado a la BD nueva: yahweh_rohi_inventory.
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
  SELECT 1
  FROM sys.columns c
  JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID(N'dbo.PAGOS_CREDITO')
    AND c.name = N'MONTO'
    AND (t.name <> N'decimal' OR c.precision <> 18 OR c.scale <> 2)
)
BEGIN
  ALTER TABLE dbo.PAGOS_CREDITO ALTER COLUMN MONTO DECIMAL(18,2) NULL;
END;

IF OBJECT_ID(N'dbo.CLIENTE_BACKUP_PRE_CREDIT_RECONCILE_20260609', 'U') IS NULL
  SELECT * INTO dbo.CLIENTE_BACKUP_PRE_CREDIT_RECONCILE_20260609 FROM dbo.CLIENTE;

IF OBJECT_ID(N'dbo.PAGOS_CREDITO_BACKUP_PRE_CREDIT_RECONCILE_20260609', 'U') IS NULL
  SELECT * INTO dbo.PAGOS_CREDITO_BACKUP_PRE_CREDIT_RECONCILE_20260609 FROM dbo.PAGOS_CREDITO;

IF OBJECT_ID(N'dbo.CREDITO_ABONO_DETALLE_BACKUP_PRE_CREDIT_RECONCILE_20260609', 'U') IS NULL
  SELECT * INTO dbo.CREDITO_ABONO_DETALLE_BACKUP_PRE_CREDIT_RECONCILE_20260609 FROM dbo.CREDITO_ABONO_DETALLE;

SET IDENTITY_INSERT dbo.CLIENTE ON;

MERGE dbo.CLIENTE AS target
USING (
  SELECT IdCliente, Nombre, Telefono, Direccion
  FROM DBSistemaPuntoDeVenta.dbo.Clientes
) AS source
ON target.ID_CLIENTE = source.IdCliente
WHEN MATCHED THEN
  UPDATE SET
    NOMBRE = source.Nombre,
    APELLIDO = '',
    TELEFONO = source.Telefono,
    DIRECCION = source.Direccion
WHEN NOT MATCHED THEN
  INSERT (ID_CLIENTE, NOMBRE, APELLIDO, TELEFONO, DIRECCION, CREDITOS_ABIERTOS, FECHA_HORA, saldo)
  VALUES (source.IdCliente, source.Nombre, '', source.Telefono, source.Direccion, 0, CONVERT(VARCHAR(19), GETDATE(), 120), 0);

SET IDENTITY_INSERT dbo.CLIENTE OFF;

DELETE FROM dbo.CREDITO_ABONO_DETALLE;
DELETE FROM dbo.PAGOS_CREDITO;
DBCC CHECKIDENT ('dbo.CREDITO_ABONO_DETALLE', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.PAGOS_CREDITO', RESEED, 0) WITH NO_INFOMSGS;

DECLARE @payment_map TABLE (
  old_payment_id INT PRIMARY KEY,
  new_payment_id INT NOT NULL
);

MERGE dbo.PAGOS_CREDITO AS target
USING (
  SELECT
    IdAbonoDeCredito,
    ClienteId,
    VentaId,
    UsuarioId,
    Fecha,
    CAST(Monto AS DECIMAL(18,2)) AS Monto
  FROM DBSistemaPuntoDeVenta.dbo.AbonoDeCreditos
) AS source
ON 1 = 0
WHEN NOT MATCHED THEN
  INSERT (DESCRIPCION_PAGO, MONTO, ID_CLIENTE, ID_FACTURA, ID_USUARIO, FECHA_HORA)
  VALUES (
    CONCAT('Abono migrado BD oficial #', source.IdAbonoDeCredito),
    source.Monto,
    source.ClienteId,
    source.VentaId,
    ISNULL(source.UsuarioId, 1),
    CONVERT(VARCHAR(19), source.Fecha, 120)
  )
OUTPUT source.IdAbonoDeCredito, inserted.ID_PAGO_CREDITO
INTO @payment_map (old_payment_id, new_payment_id);

;WITH lineas AS (
  SELECT
    vc.ID_VENTA,
    vc.ID_FACT,
    vc.ID_CLIENTE,
    CAST(vc.CANT_PD * vc.PRECIO_VENTA AS DECIMAL(18,2)) AS total_linea,
    SUM(CAST(vc.CANT_PD * vc.PRECIO_VENTA AS DECIMAL(18,2))) OVER (
      PARTITION BY vc.ID_FACT
      ORDER BY vc.ID_VENTA
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS total_anterior
  FROM dbo.VENTA_CREDITO vc
), pagos AS (
  SELECT
    a.IdAbonoDeCredito,
    a.ClienteId,
    a.VentaId,
    a.UsuarioId,
    a.Fecha,
    CAST(a.Monto AS DECIMAL(18,2)) AS monto,
    SUM(CAST(a.Monto AS DECIMAL(18,2))) OVER (
      PARTITION BY a.VentaId
      ORDER BY a.Fecha, a.IdAbonoDeCredito
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS pago_anterior
  FROM DBSistemaPuntoDeVenta.dbo.AbonoDeCreditos a
), aplicaciones AS (
  SELECT
    pm.new_payment_id,
    l.ID_VENTA,
    l.ID_FACT,
    l.ID_CLIENTE,
    p.UsuarioId,
    p.Fecha,
    p.IdAbonoDeCredito,
    CAST(
      CASE
        WHEN
          (ISNULL(p.pago_anterior, 0) + p.monto) > ISNULL(l.total_anterior, 0)
          AND ISNULL(p.pago_anterior, 0) < (ISNULL(l.total_anterior, 0) + l.total_linea)
        THEN
          IIF(ISNULL(p.pago_anterior, 0) > ISNULL(l.total_anterior, 0), ISNULL(p.pago_anterior, 0), ISNULL(l.total_anterior, 0))
        ELSE NULL
      END AS DECIMAL(18,2)
    ) AS inicio,
    CAST(
      CASE
        WHEN
          (ISNULL(p.pago_anterior, 0) + p.monto) > ISNULL(l.total_anterior, 0)
          AND ISNULL(p.pago_anterior, 0) < (ISNULL(l.total_anterior, 0) + l.total_linea)
        THEN
          IIF((ISNULL(p.pago_anterior, 0) + p.monto) < (ISNULL(l.total_anterior, 0) + l.total_linea), (ISNULL(p.pago_anterior, 0) + p.monto), (ISNULL(l.total_anterior, 0) + l.total_linea))
        ELSE NULL
      END AS DECIMAL(18,2)
    ) AS fin
  FROM pagos p
  JOIN @payment_map pm ON pm.old_payment_id = p.IdAbonoDeCredito
  JOIN lineas l ON l.ID_FACT = p.VentaId
)
INSERT INTO dbo.CREDITO_ABONO_DETALLE (
  ID_PAGO_CREDITO,
  ID_VENTA,
  ID_FACT,
  ID_CLIENTE,
  MONTO,
  ID_USUARIO,
  DESCRIPCION,
  FECHA_HORA
)
SELECT
  new_payment_id,
  ID_VENTA,
  ID_FACT,
  ID_CLIENTE,
  CAST(fin - inicio AS DECIMAL(18,2)),
  ISNULL(UsuarioId, 1),
  CONCAT('Aplicacion abono oficial #', IdAbonoDeCredito),
  CONVERT(VARCHAR(19), Fecha, 120)
FROM aplicaciones
WHERE inicio IS NOT NULL
  AND fin IS NOT NULL
  AND fin > inicio;

;WITH venta_totales AS (
  SELECT ID_FACT, ID_CLIENTE, SUM(CAST(CANT_PD * PRECIO_VENTA AS DECIMAL(18,2))) AS total_credito
  FROM dbo.VENTA_CREDITO
  GROUP BY ID_FACT, ID_CLIENTE
), abonos AS (
  SELECT ID_FACT, ID_CLIENTE, SUM(MONTO) AS total_abonado
  FROM dbo.CREDITO_ABONO_DETALLE
  GROUP BY ID_FACT, ID_CLIENTE
), factura_estado AS (
  SELECT v.ID_FACT,
         CASE WHEN ROUND(v.total_credito - ISNULL(a.total_abonado, 0), 2) <= 0 THEN 1 ELSE 2 END AS estado
  FROM venta_totales v
  LEFT JOIN abonos a ON a.ID_FACT = v.ID_FACT AND a.ID_CLIENTE = v.ID_CLIENTE
)
UPDATE vc
SET ID_ESTADO_VENTA = fe.estado
FROM dbo.VENTA_CREDITO vc
JOIN factura_estado fe ON fe.ID_FACT = vc.ID_FACT;

;WITH cliente_saldo AS (
  SELECT
    v.ID_CLIENTE,
    SUM(v.total_credito) AS total_credito,
    SUM(ISNULL(a.total_abonado, 0)) AS total_abonado,
    SUM(CASE WHEN ROUND(v.total_credito - ISNULL(a.total_abonado, 0), 2) > 0 THEN 1 ELSE 0 END) AS creditos_abiertos
  FROM (
    SELECT ID_FACT, ID_CLIENTE, SUM(CAST(CANT_PD * PRECIO_VENTA AS DECIMAL(18,2))) AS total_credito
    FROM dbo.VENTA_CREDITO
    GROUP BY ID_FACT, ID_CLIENTE
  ) v
  LEFT JOIN (
    SELECT ID_FACT, ID_CLIENTE, SUM(MONTO) AS total_abonado
    FROM dbo.CREDITO_ABONO_DETALLE
    GROUP BY ID_FACT, ID_CLIENTE
  ) a ON a.ID_FACT = v.ID_FACT AND a.ID_CLIENTE = v.ID_CLIENTE
  GROUP BY v.ID_CLIENTE
)
UPDATE c
SET
  c.saldo = ROUND(ISNULL(cs.total_credito, 0) - ISNULL(cs.total_abonado, 0), 2),
  c.CREDITOS_ABIERTOS = ISNULL(cs.creditos_abiertos, 0)
FROM dbo.CLIENTE c
LEFT JOIN cliente_saldo cs ON cs.ID_CLIENTE = c.ID_CLIENTE;

COMMIT TRANSACTION;
