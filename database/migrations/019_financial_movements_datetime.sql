IF OBJECT_ID('dbo.MOVIMIENTO_FINANCIERO', 'U') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t
      ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.MOVIMIENTO_FINANCIERO')
      AND c.name = 'FECHA'
      AND t.name <> 'datetime2'
  )
BEGIN
  ALTER TABLE dbo.MOVIMIENTO_FINANCIERO ALTER COLUMN FECHA DATETIME2 NOT NULL;
END;
