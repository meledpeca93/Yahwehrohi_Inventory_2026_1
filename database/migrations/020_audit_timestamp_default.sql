IF OBJECT_ID('dbo.auditoria', 'U') IS NOT NULL
  AND COL_LENGTH('dbo.auditoria', 'fecha_hora') IS NULL
  AND COL_LENGTH('dbo.auditoria', 'fecha') IS NULL
  AND COL_LENGTH('dbo.auditoria', 'registrado_en') IS NULL
  AND COL_LENGTH('dbo.auditoria', 'creado_en') IS NULL
BEGIN
  ALTER TABLE dbo.auditoria
  ADD FECHA_HORA DATETIME2 NOT NULL
    CONSTRAINT DF_auditoria_FECHA_HORA DEFAULT (SYSDATETIME());
END;

IF OBJECT_ID('dbo.auditoria', 'U') IS NOT NULL
  AND COL_LENGTH('dbo.auditoria', 'fecha_hora') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c
      ON c.object_id = dc.parent_object_id
     AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.auditoria')
      AND c.name = 'fecha_hora'
  )
BEGIN
  ALTER TABLE dbo.auditoria
  ADD CONSTRAINT DF_auditoria_fecha_hora DEFAULT (SYSDATETIME()) FOR fecha_hora;
END;
