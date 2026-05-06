/*
  Instala auditoria automatica para todas las tablas de usuario en SQL Server.

  Requisitos:
  - Debe existir dbo.auditoria.
  - dbo.auditoria debe tener, como minimo, las columnas dato_anterior y dato_nuevo.

  El script detecta columnas adicionales comunes en dbo.auditoria y las llena si existen:
  tabla / nombre_tabla / tabla_afectada
  accion / operacion / tipo_movimiento
  fecha / fecha_hora / creado_en / registrado_en
  usuario / usuario_bd / creado_por
  id_usuario / usuario_id
  clave / llave / id_registro / registro_id / registro

  Para pasar el usuario de la aplicacion a los triggers, antes de ejecutar escrituras puede usar:
    EXEC sys.sp_set_session_context @key = N'audit_user_id', @value = 1;
    EXEC sys.sp_set_session_context @key = N'audit_user', @value = N'usuario';
*/

IF OBJECT_ID('dbo.auditoria', 'U') IS NULL
BEGIN
  THROW 51000, 'No existe dbo.auditoria. Cree la tabla antes de instalar triggers de auditoria.', 1;
END;
GO

IF COL_LENGTH('dbo.auditoria', 'dato_anterior') IS NULL
   OR COL_LENGTH('dbo.auditoria', 'dato_nuevo') IS NULL
BEGIN
  THROW 51001, 'dbo.auditoria debe tener las columnas dato_anterior y dato_nuevo.', 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_instalar_triggers_auditoria
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE
    @schema_name sysname,
    @table_name sysname,
    @object_id int,
    @trigger_name sysname,
    @full_table nvarchar(517),
    @full_trigger nvarchar(517),
    @columns_values nvarchar(max),
    @pk_match nvarchar(max),
    @pk_value nvarchar(max),
    @audit_columns nvarchar(max),
    @audit_values nvarchar(max),
    @sql nvarchar(max);

  DECLARE table_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT s.name, t.name, t.object_id
    FROM sys.tables t
    INNER JOIN sys.schemas s
      ON s.schema_id = t.schema_id
    WHERE t.is_ms_shipped = 0
      AND NOT (s.name = 'dbo' AND LOWER(t.name) = 'auditoria')
      AND t.name NOT LIKE 'sys%'
      AND t.name NOT LIKE 'MSpeer%'
      AND t.name NOT LIKE 'MSreplication%'
    ORDER BY s.name, t.name;

  OPEN table_cursor;
  FETCH NEXT FROM table_cursor INTO @schema_name, @table_name, @object_id;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    SELECT @columns_values = STRING_AGG(
      CAST(
        '(''' + REPLACE(c.name, '''', '''''') + ''', ' +
        'CONVERT(nvarchar(max), d.' + QUOTENAME(c.name) + '), ' +
        'CONVERT(nvarchar(max), i.' + QUOTENAME(c.name) + '))'
      AS nvarchar(max)),
      ',' + CHAR(13) + CHAR(10) + '          '
    ) WITHIN GROUP (ORDER BY c.column_id)
    FROM sys.columns c
    INNER JOIN sys.types ty
      ON ty.user_type_id = c.user_type_id
    WHERE c.object_id = @object_id
      AND c.is_computed = 0
      AND ty.name NOT IN ('timestamp', 'rowversion', 'image', 'text', 'ntext');

    IF @columns_values IS NULL
    BEGIN
      FETCH NEXT FROM table_cursor INTO @schema_name, @table_name, @object_id;
      CONTINUE;
    END;

    SELECT @pk_match = STRING_AGG(
      CAST(
        '((i.' + QUOTENAME(c.name) + ' = d.' + QUOTENAME(c.name) + ') OR (i.' + QUOTENAME(c.name) + ' IS NULL AND d.' + QUOTENAME(c.name) + ' IS NULL))'
      AS nvarchar(max)),
      ' AND '
    )
    FROM sys.indexes ix
    INNER JOIN sys.index_columns ic
      ON ic.object_id = ix.object_id
     AND ic.index_id = ix.index_id
    INNER JOIN sys.columns c
      ON c.object_id = ic.object_id
     AND c.column_id = ic.column_id
    WHERE ix.object_id = @object_id
      AND ix.is_primary_key = 1;

    SELECT @pk_value = STRING_AGG(
      CAST(
        '''' + REPLACE(c.name, '''', '''''') + '='' + ISNULL(CONVERT(nvarchar(max), COALESCE(i.' + QUOTENAME(c.name) + ', d.' + QUOTENAME(c.name) + ')), ''NULL'')'
      AS nvarchar(max)),
      ' + ''|'' + '
    ) WITHIN GROUP (ORDER BY ic.key_ordinal)
    FROM sys.indexes ix
    INNER JOIN sys.index_columns ic
      ON ic.object_id = ix.object_id
     AND ic.index_id = ix.index_id
    INNER JOIN sys.columns c
      ON c.object_id = ic.object_id
     AND c.column_id = ic.column_id
    WHERE ix.object_id = @object_id
      AND ix.is_primary_key = 1;

    IF @pk_match IS NULL
    BEGIN
      SET @pk_match = 'i.__audit_row_number = d.__audit_row_number';
      SET @pk_value = '''fila='' + ISNULL(CONVERT(nvarchar(max), COALESCE(i.__audit_row_number, d.__audit_row_number)), ''NULL'')';
    END;

    SET @audit_columns = 'dato_anterior, dato_nuevo';
    SET @audit_values = 'audit_rows.dato_anterior, audit_rows.dato_nuevo';

    IF COL_LENGTH('dbo.auditoria', 'tabla') IS NOT NULL
    BEGIN
      SET @audit_columns += ', tabla';
      SET @audit_values += ', @audit_table_name';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'nombre_tabla') IS NOT NULL
    BEGIN
      SET @audit_columns += ', nombre_tabla';
      SET @audit_values += ', @audit_table_name';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'tabla_afectada') IS NOT NULL
    BEGIN
      SET @audit_columns += ', tabla_afectada';
      SET @audit_values += ', @audit_table_name';
    END;

    IF COL_LENGTH('dbo.auditoria', 'accion') IS NOT NULL
    BEGIN
      SET @audit_columns += ', accion';
      SET @audit_values += ', audit_rows.accion';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'operacion') IS NOT NULL
    BEGIN
      SET @audit_columns += ', operacion';
      SET @audit_values += ', audit_rows.accion';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'tipo_movimiento') IS NOT NULL
    BEGIN
      SET @audit_columns += ', tipo_movimiento';
      SET @audit_values += ', audit_rows.accion';
    END;

    IF COL_LENGTH('dbo.auditoria', 'fecha') IS NOT NULL
    BEGIN
      SET @audit_columns += ', fecha';
      SET @audit_values += ', GETDATE()';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'fecha_hora') IS NOT NULL
    BEGIN
      SET @audit_columns += ', fecha_hora';
      SET @audit_values += ', GETDATE()';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'creado_en') IS NOT NULL
    BEGIN
      SET @audit_columns += ', creado_en';
      SET @audit_values += ', GETDATE()';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'registrado_en') IS NOT NULL
    BEGIN
      SET @audit_columns += ', registrado_en';
      SET @audit_values += ', GETDATE()';
    END;

    IF COL_LENGTH('dbo.auditoria', 'usuario') IS NOT NULL
    BEGIN
      SET @audit_columns += ', usuario';
      SET @audit_values += ', COALESCE(CONVERT(nvarchar(255), SESSION_CONTEXT(N''audit_user'')), SUSER_SNAME())';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'usuario_bd') IS NOT NULL
    BEGIN
      SET @audit_columns += ', usuario_bd';
      SET @audit_values += ', SUSER_SNAME()';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'creado_por') IS NOT NULL
    BEGIN
      SET @audit_columns += ', creado_por';
      SET @audit_values += ', COALESCE(CONVERT(nvarchar(255), SESSION_CONTEXT(N''audit_user'')), SUSER_SNAME())';
    END;

    IF COL_LENGTH('dbo.auditoria', 'id_usuario') IS NOT NULL
    BEGIN
      SET @audit_columns += ', id_usuario';
      SET @audit_values += ', TRY_CONVERT(int, SESSION_CONTEXT(N''audit_user_id''))';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'usuario_id') IS NOT NULL
    BEGIN
      SET @audit_columns += ', usuario_id';
      SET @audit_values += ', TRY_CONVERT(int, SESSION_CONTEXT(N''audit_user_id''))';
    END;

    IF COL_LENGTH('dbo.auditoria', 'clave') IS NOT NULL
    BEGIN
      SET @audit_columns += ', clave';
      SET @audit_values += ', audit_rows.clave';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'llave') IS NOT NULL
    BEGIN
      SET @audit_columns += ', llave';
      SET @audit_values += ', audit_rows.clave';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'id_registro') IS NOT NULL
    BEGIN
      SET @audit_columns += ', id_registro';
      SET @audit_values += ', audit_rows.clave';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'registro_id') IS NOT NULL
    BEGIN
      SET @audit_columns += ', registro_id';
      SET @audit_values += ', audit_rows.clave';
    END;
    ELSE IF COL_LENGTH('dbo.auditoria', 'registro') IS NOT NULL
    BEGIN
      SET @audit_columns += ', registro';
      SET @audit_values += ', audit_rows.clave';
    END;

    SET @trigger_name = 'tr_auditoria_' + @table_name;
    SET @full_table = QUOTENAME(@schema_name) + '.' + QUOTENAME(@table_name);
    SET @full_trigger = QUOTENAME(@schema_name) + '.' + QUOTENAME(@trigger_name);

    SET @sql = N'
CREATE OR ALTER TRIGGER ' + @full_trigger + N'
ON ' + @full_table + N'
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @audit_table_name nvarchar(257) = N''' + REPLACE(@schema_name + '.' + @table_name, '''', '''''') + N''';

  ;WITH inserted_rows AS (
    SELECT ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS __audit_row_number, *
    FROM inserted
  ),
  deleted_rows AS (
    SELECT ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS __audit_row_number, *
    FROM deleted
  ),
  joined_rows AS (
    SELECT
      CASE
        WHEN d.__audit_row_number IS NULL THEN ''INSERT''
        WHEN i.__audit_row_number IS NULL THEN ''DELETE''
        ELSE ''UPDATE''
      END AS accion,
      ' + @pk_value + N' AS clave,
      changes.column_name,
      changes.old_value,
      changes.new_value
    FROM inserted_rows i
    FULL OUTER JOIN deleted_rows d
      ON ' + @pk_match + N'
    CROSS APPLY (VALUES
          ' + @columns_values + N'
    ) changes(column_name, old_value, new_value)
    WHERE
      d.__audit_row_number IS NULL
      OR i.__audit_row_number IS NULL
      OR ISNULL(changes.old_value, N''<NULL>'') <> ISNULL(changes.new_value, N''<NULL>'')
  ),
  audit_rows AS (
    SELECT
      accion,
      clave,
      STRING_AGG(CONVERT(nvarchar(max), column_name + N''='' + ISNULL(old_value, N''NULL'')), N''; '') AS dato_anterior,
      STRING_AGG(CONVERT(nvarchar(max), column_name + N''='' + ISNULL(new_value, N''NULL'')), N''; '') AS dato_nuevo
    FROM joined_rows
    GROUP BY accion, clave
  )
  INSERT INTO dbo.auditoria (' + @audit_columns + N')
  SELECT ' + @audit_values + N'
  FROM audit_rows
  WHERE ISNULL(dato_anterior, N'''') <> N''''
     OR ISNULL(dato_nuevo, N'''') <> N'''';
END;';

    EXEC sys.sp_executesql @sql;

    FETCH NEXT FROM table_cursor INTO @schema_name, @table_name, @object_id;
  END;

  CLOSE table_cursor;
  DEALLOCATE table_cursor;
END;
GO

EXEC dbo.sp_instalar_triggers_auditoria;
GO
