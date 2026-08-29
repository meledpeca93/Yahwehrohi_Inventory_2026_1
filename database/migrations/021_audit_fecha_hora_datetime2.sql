IF OBJECT_ID('dbo.auditoria', 'U') IS NOT NULL
  AND COL_LENGTH('dbo.auditoria', 'fecha_hora') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t
      ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.auditoria')
      AND c.name = 'FECHA_HORA'
      AND t.name NOT IN ('datetime', 'datetime2', 'smalldatetime', 'datetimeoffset')
  )
BEGIN
  DECLARE @drop_fecha_hora_default nvarchar(max) = N'';

  SELECT @drop_fecha_hora_default = @drop_fecha_hora_default +
    N'ALTER TABLE dbo.auditoria DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
  FROM sys.default_constraints dc
  JOIN sys.columns c
    ON c.object_id = dc.parent_object_id
   AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.auditoria')
    AND c.name = 'FECHA_HORA';

  IF @drop_fecha_hora_default <> N''
  BEGIN
    EXEC sys.sp_executesql @drop_fecha_hora_default;
  END;

  UPDATE dbo.auditoria
  SET FECHA_HORA = CONVERT(varchar(30), COALESCE(TRY_CONVERT(datetime2, FECHA_HORA), SYSDATETIME()), 126);

  ALTER TABLE dbo.auditoria ALTER COLUMN FECHA_HORA DATETIME2 NULL;

  ALTER TABLE dbo.auditoria
  ADD CONSTRAINT DF_auditoria_fecha_hora DEFAULT (SYSDATETIME()) FOR FECHA_HORA;
END;
