/*
  Habilita cantidades fraccionadas para productos vendidos por peso o granel.

  - inventario.permite_decimal controla si el producto puede facturarse con decimales.
  - Se inicializa desde Productos_Mirror.AplicaAGranel y nombres/codigos de productos historicos.
  - No altera stock ni ventas existentes.
*/

SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH('dbo.inventario', 'permite_decimal') IS NULL
  BEGIN
    ALTER TABLE dbo.inventario
      ADD permite_decimal bit NOT NULL
      CONSTRAINT DF_inventario_permite_decimal DEFAULT (0);
  END;

  EXEC sp_executesql N'
    UPDATE i
    SET
      i.permite_decimal = 1,
      i.unidad_medida = CASE
        WHEN NULLIF(LTRIM(RTRIM(i.unidad_medida)), '''') IS NULL OR UPPER(LTRIM(RTRIM(i.unidad_medida))) = ''UNIDAD''
          THEN ''Libra''
        ELSE i.unidad_medida
      END,
      i.actualizado_en = GETDATE()
    FROM dbo.inventario i
    INNER JOIN dbo.producto p
      ON p.id_producto = i.id_inventario
    LEFT JOIN dbo.Productos_Mirror pm
      ON pm.IdProducto = p.id_producto
      OR pm.Codigo COLLATE DATABASE_DEFAULT = p.codigo COLLATE DATABASE_DEFAULT
    WHERE ISNULL(pm.AplicaAGranel, 0) = 1
       OR p.nombre LIKE ''%granel%''
       OR p.nombre LIKE ''%libra%''
       OR p.nombre LIKE ''% lbs%''
       OR p.nombre LIKE ''% lb%''
       OR p.codigo LIKE ''%-Lb%'';
  ';

  COMMIT TRANSACTION;

  EXEC sp_executesql N'
    SELECT
      SUM(CASE WHEN permite_decimal = 1 THEN 1 ELSE 0 END) AS productos_fraccionables,
      COUNT(*) AS productos_inventario
    FROM dbo.inventario;
  ';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
  BEGIN
    ROLLBACK TRANSACTION;
  END;

  THROW;
END CATCH;
