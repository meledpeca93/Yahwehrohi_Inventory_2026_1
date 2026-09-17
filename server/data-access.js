const fs = require('fs');
const os = require('os');
const path = require('path');
const { getPool, sql } = require('./db');

const projectRootPath = path.join(__dirname, '..');
const imageAssetsPrefix = 'assets/img/';
const imageAssetsPath = path.join(projectRootPath, 'src', 'img');

function findImageAssetFile(fileName) {
  const normalizedFileName = String(fileName || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const safeRelativeFileName = normalizedFileName
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
  const safeFileName = path.basename(safeRelativeFileName);

  if (!safeFileName || !fs.existsSync(imageAssetsPath)) {
    return null;
  }

  const assetFileNames = fs.readdirSync(imageAssetsPath, { recursive: true })
    .filter((assetFileName) => fs.statSync(path.join(imageAssetsPath, assetFileName)).isFile())
    .map((assetFileName) => String(assetFileName).replace(/\\/g, '/'));
  const relativeFile = assetFileNames.find((assetFileName) => assetFileName === safeRelativeFileName);

  if (relativeFile) {
    return relativeFile;
  }

  const exactFile = assetFileNames.find((assetFileName) => assetFileName === safeFileName);

  if (exactFile) {
    return exactFile;
  }

  const lowerSafeFileName = safeFileName.toLowerCase();
  const lowerSafeBaseName = path.parse(safeFileName).name.toLowerCase();

  return (
    assetFileNames.find((assetFileName) => assetFileName.toLowerCase() === lowerSafeFileName) ||
    assetFileNames.find((assetFileName) => path.parse(assetFileName).name.toLowerCase() === lowerSafeBaseName) ||
    null
  );
}

function normalizeProductImageUrlForStorage(imageUrl) {
  const normalizedImageUrl = String(imageUrl || '').trim().replace(/\\/g, '/');

  if (!normalizedImageUrl) {
    return null;
  }

  const assetFile = findImageAssetFile(normalizedImageUrl);

  if (assetFile) {
    return `${imageAssetsPrefix}${assetFile}`;
  }

  return normalizedImageUrl;
}

function truncateText(value, maxLength) {
  return String(value ?? '').slice(0, maxLength);
}

function resolveHealthImagePath(imageUrl) {
  const normalizedImageUrl = String(imageUrl || '').trim();

  if (!normalizedImageUrl) {
    return null;
  }

  if (path.isAbsolute(normalizedImageUrl)) {
    return normalizedImageUrl;
  }

  if (normalizedImageUrl.toLowerCase().startsWith(imageAssetsPrefix)) {
    return path.join(imageAssetsPath, normalizedImageUrl.slice(imageAssetsPrefix.length));
  }

  return path.join(projectRootPath, normalizedImageUrl);
}

function getDiskHealthSnapshot() {
  try {
    if (typeof fs.statfsSync !== 'function') {
      return { availableBytes: null, totalBytes: null, availablePercent: null };
    }

    const stats = fs.statfsSync(projectRootPath);
    const availableBytes = Number(stats.bavail || 0) * Number(stats.bsize || 0);
    const totalBytes = Number(stats.blocks || 0) * Number(stats.bsize || 0);

    return {
      availableBytes,
      totalBytes,
      availablePercent: totalBytes > 0 ? (availableBytes / totalBytes) * 100 : null,
    };
  } catch {
    return { availableBytes: null, totalBytes: null, availablePercent: null };
  }
}

async function safeRollback(transaction) {
  try {
    await transaction.rollback();
  } catch {
    // If SQL Server already closed the transaction/connection, keep the original error.
  }
}

async function setAuditContext(transaction, { userId = null, user = null } = {}) {
  const resolvedUser = user || (userId ? await resolveUserName(transaction, userId) : null);

  await new sql.Request(transaction)
    .input('audit_user_id', sql.Int, userId ? Number(userId) : null)
    .input('audit_user', sql.NVarChar(255), resolvedUser ? String(resolvedUser) : null)
    .query(`
      EXEC sys.sp_set_session_context @key = N'audit_user_id', @value = @audit_user_id;
      EXEC sys.sp_set_session_context @key = N'audit_user', @value = @audit_user;
    `);
}

async function resolveUserName(executor, userId) {
  const resolvedUserId = Number(userId || 0);

  if (!resolvedUserId || resolvedUserId <= 0) {
    return null;
  }

  try {
    const result = await new sql.Request(executor)
      .input('user_id', sql.Int, resolvedUserId)
      .query(`
        SELECT TOP 1 nombre, usuario
        FROM dbo.usuario
        WHERE id_usuario = @user_id
      `);

    const row = result.recordset[0];
    return row ? String(row.nombre || row.usuario || '').trim() || null : null;
  } catch {
    return null;
  }
}

async function resolveUserLogin(executor, userId) {
  const resolvedUserId = Number(userId || 0);

  if (!resolvedUserId || resolvedUserId <= 0) {
    return null;
  }

  try {
    const result = await new sql.Request(executor)
      .input('user_id', sql.Int, resolvedUserId)
      .query(`
        SELECT TOP 1 usuario
        FROM dbo.usuario
        WHERE id_usuario = @user_id
      `);

    const row = result.recordset[0];
    return row ? String(row.usuario || '').trim() || null : null;
  } catch {
    return null;
  }
}

async function ensureAuditTimestampSupport(executor) {
  await new sql.Request(executor).query(`
    IF OBJECT_ID('dbo.auditoria', 'U') IS NULL
      RETURN;

    IF COL_LENGTH('dbo.auditoria', 'fecha_hora') IS NOT NULL
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
      SET FECHA_HORA = CONVERT(varchar(30), COALESCE(TRY_CONVERT(datetime2, FECHA_HORA), SYSDATETIME()), 126)
      WHERE FECHA_HORA IS NULL
         OR TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
         OR TRY_CONVERT(datetime2, FECHA_HORA) IS NULL;

      ALTER TABLE dbo.auditoria ALTER COLUMN FECHA_HORA DATETIME2 NULL;
    END;

    IF COL_LENGTH('dbo.auditoria', 'fecha_hora') IS NULL
      AND COL_LENGTH('dbo.auditoria', 'fecha') IS NULL
      AND COL_LENGTH('dbo.auditoria', 'registrado_en') IS NULL
      AND COL_LENGTH('dbo.auditoria', 'creado_en') IS NULL
    BEGIN
      ALTER TABLE dbo.auditoria
      ADD FECHA_HORA DATETIME2 NOT NULL
        CONSTRAINT DF_auditoria_FECHA_HORA DEFAULT (SYSDATETIME());
    END;

    IF COL_LENGTH('dbo.auditoria', 'fecha_hora') IS NOT NULL
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
  `);
}

async function getAuditColumns(executor) {
  await ensureAuditTimestampSupport(executor);

  const result = await new sql.Request(executor).query(`
    IF OBJECT_ID('dbo.auditoria', 'U') IS NULL
    BEGIN
      SELECT CAST(NULL AS sysname) AS column_name
      WHERE 1 = 0;
      RETURN;
    END;

    SELECT name AS column_name
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.auditoria', 'U')
    ORDER BY column_id;
  `);

  return result.recordset.map((column) => String(column.column_name));
}

async function insertAuditRecord(executor, {
  tableName,
  action,
  recordKey = '',
  userId = null,
  user = null,
  previousData = '',
  newData = '',
}) {
  const columns = await getAuditColumns(executor);

  if (columns.length === 0) {
    return;
  }

  const columnSet = new Set(columns.map((column) => column.toLowerCase()));
  const firstExistingColumn = (candidates) => candidates.find((column) => columnSet.has(column.toLowerCase()));
  const auditColumns = [];
  const auditValues = [];
  const request = new sql.Request(executor);
  const resolvedUser = user || (userId ? await resolveUserName(executor, userId) : null);

  const addColumn = (column, valueExpression, inputName, type, value) => {
    if (!column) {
      return;
    }

    auditColumns.push(sqlColumnName(column));
    auditValues.push(valueExpression);

    if (inputName) {
      request.input(inputName, type, value);
    }
  };

  addColumn(firstExistingColumn(['tabla', 'nombre_tabla', 'tabla_afectada', 'TABLA_AFECTADA', 'TABLA']), '@table_name', 'table_name', sql.NVarChar(257), truncateText(tableName, 257));
  addColumn(firstExistingColumn(['accion', 'operacion', 'tipo_movimiento', 'ACCION']), '@action', 'action', sql.NVarChar(40), truncateText(action, 40));
  addColumn(firstExistingColumn(['fecha_hora', 'fecha', 'registrado_en', 'creado_en', 'FECHA_HORA', 'FECHA']), 'GETDATE()');
  addColumn(firstExistingColumn(['usuario', 'usuario_bd', 'creado_por', 'USUARIO']), '@user_name', 'user_name', sql.NVarChar(255), truncateText(resolvedUser || 'Sistema', 255));
  addColumn(firstExistingColumn(['id_usuario', 'usuario_id', 'ID_USUARIO', 'ID_USER']), '@user_id', 'user_id', sql.Int, userId ? Number(userId) : null);
  addColumn(firstExistingColumn(['clave', 'llave', 'id_registro', 'registro_id', 'registro']), '@record_key', 'record_key', sql.NVarChar(255), truncateText(recordKey, 255));
  addColumn(firstExistingColumn(['dato_anterior', 'DATO_ANTERIOR']), '@previous_data', 'previous_data', sql.NVarChar(700), truncateText(previousData, 700));
  addColumn(firstExistingColumn(['dato_nuevo', 'DATO_NUEVO']), '@new_data', 'new_data', sql.NVarChar(700), truncateText(newData, 700));

  if (auditColumns.length === 0) {
    return;
  }

  await request.query(`
    INSERT INTO dbo.auditoria (${auditColumns.join(', ')})
    VALUES (${auditValues.join(', ')});
  `);
}

async function insertInventoryLogRecord(executor, {
  action,
  productId,
  quantity,
  previousStock,
  newStock,
  unitCost,
  userId,
  date,
  customerId = null,
  paymentTypeId = null,
}) {
  const resolvedProductId = Number(productId || 0);
  const resolvedUserId = Number(userId || 1);

  if (!resolvedProductId || resolvedProductId <= 0) {
    return;
  }

  await new sql.Request(executor)
    .input('action', sql.VarChar(40), truncateText(action || 'INVENTARIO', 40))
    .input('product_id', sql.Int, resolvedProductId)
    .input('quantity', sql.Decimal(10, 2), Number(quantity || 0))
    .input('previous_stock', sql.Decimal(10, 2), Number(previousStock || 0))
    .input('new_stock', sql.Decimal(10, 2), Number(newStock || 0))
    .input('unit_cost', sql.Decimal(10, 2), Number(unitCost || 0))
    .input('user_id', sql.Int, resolvedUserId > 0 ? resolvedUserId : 1)
    .input('created_at', sql.VarChar(50), String(date || new Date().toISOString()).slice(0, 50))
    .input('customer_id', sql.Int, customerId === null || customerId === undefined ? null : Number(customerId || 0))
    .input('payment_type_id', sql.Int, paymentTypeId === null || paymentTypeId === undefined ? null : Number(paymentTypeId || 0))
    .query(`
      IF OBJECT_ID('dbo.INVENTARIO_LOG', 'U') IS NULL
      BEGIN
        RETURN;
      END;

      INSERT INTO dbo.INVENTARIO_LOG (
        ACCION_REALIZADA,
        ID_PD,
        CANT_PD,
        STOCK_ANT,
        STOCK_ACT,
        PRECIO_COSTO,
        ID_USER,
        FECHA_HORA,
        ID_CLIENTE,
        ID_TP
      )
      VALUES (
        @action,
        @product_id,
        @quantity,
        @previous_stock,
        @new_stock,
        @unit_cost,
        @user_id,
        @created_at,
        @customer_id,
        @payment_type_id
      );
    `);
}

async function ensureInventoryInsertCompatibility(executor) {
  const result = await new sql.Request(executor).query(`
    SELECT
      dc.name AS default_name,
      dc.definition,
      t.name AS type_name
    FROM sys.columns c
    JOIN sys.types t
      ON t.user_type_id = c.user_type_id
    LEFT JOIN sys.default_constraints dc
      ON dc.parent_object_id = c.object_id
      AND dc.parent_column_id = c.column_id
    WHERE c.object_id = OBJECT_ID('dbo.inventario')
      AND c.name = 'NUM_LOTE';
  `);

  const row = result.recordset[0];
  const defaultDefinition = String(row?.definition || '').toUpperCase();

  if (row?.default_name && String(row.type_name || '').toLowerCase() === 'int' && defaultDefinition.includes('SIN LOTE')) {
    await new sql.Request(executor).query(`
      ALTER TABLE dbo.inventario DROP CONSTRAINT ${sqlColumnName(row.default_name)};
    `);
  }
}

async function ensureQuoteObjects(executor) {
  await new sql.Request(executor).query(`
    IF OBJECT_ID('dbo.COTIZACION', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.COTIZACION (
        ID_COTIZACION INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        NUM_COTIZACION AS ('COT-' + RIGHT('000000' + CONVERT(VARCHAR(12), ID_COTIZACION), 6)) PERSISTED,
        ID_CLIENTE INT NULL,
        CLIENTE_NOMBRE NVARCHAR(250) NULL,
        ID_TP INT NOT NULL DEFAULT 1,
        SUBTOTAL DECIMAL(18, 2) NOT NULL DEFAULT 0,
        UTILIDAD_ESTIMADA DECIMAL(18, 2) NOT NULL DEFAULT 0,
        ESTADO VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
        ID_FACT INT NULL,
        USUARIO NVARCHAR(120) NULL,
        ID_USUARIO INT NULL,
        NOTA NVARCHAR(500) NULL,
        FECHA_HORA DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        ACTUALIZADO_EN DATETIME2 NULL
      );
    END;

    IF OBJECT_ID('dbo.COTIZACION_DETALLE', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.COTIZACION_DETALLE (
        ID_COTIZACION_DETALLE INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID_COTIZACION INT NOT NULL,
        ID_PRODUCTO INT NOT NULL,
        CODIGO_PRODUCTO VARCHAR(120) NULL,
        PRODUCTO_NOMBRE NVARCHAR(250) NULL,
        CANTIDAD DECIMAL(18, 3) NOT NULL,
        PRECIO_COSTO DECIMAL(18, 4) NOT NULL DEFAULT 0,
        PRECIO_VENTA DECIMAL(18, 4) NOT NULL DEFAULT 0,
        UTILIDAD DECIMAL(18, 2) NOT NULL DEFAULT 0,
        TOTAL_LINEA DECIMAL(18, 2) NOT NULL DEFAULT 0,
        FECHA_HORA DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    END;
  `);
}

function mapQuoteRow(row) {
  return {
    id: Number(row.ID_COTIZACION || 0),
    number: row.NUM_COTIZACION || `COT-${String(row.ID_COTIZACION || 0).padStart(6, '0')}`,
    customerId: row.ID_CLIENTE === null || row.ID_CLIENTE === undefined ? null : Number(row.ID_CLIENTE),
    customerName: row.CLIENTE_NOMBRE || 'Cliente final',
    paymentTypeId: Number(row.ID_TP || 1),
    subtotal: Number(row.SUBTOTAL || 0),
    estimatedUtility: Number(row.UTILIDAD_ESTIMADA || 0),
    status: row.ESTADO || 'ABIERTA',
    invoiceId: row.ID_FACT === null || row.ID_FACT === undefined ? null : Number(row.ID_FACT),
    userName: row.USUARIO || 'Sistema',
    userId: row.ID_USUARIO === null || row.ID_USUARIO === undefined ? null : Number(row.ID_USUARIO),
    note: row.NOTA || '',
    createdAt: row.FECHA_HORA ? new Date(row.FECHA_HORA).toISOString() : null,
    updatedAt: row.ACTUALIZADO_EN ? new Date(row.ACTUALIZADO_EN).toISOString() : null,
    linesCount: Number(row.LINEAS || 0),
  };
}

async function listQuotes(status = 'ABIERTA') {
  const pool = await getPool();
  await ensureQuoteObjects(pool);
  const normalizedStatus = String(status || 'ABIERTA').trim().toUpperCase();
  const result = await pool.request()
    .input('status', sql.VarChar(20), normalizedStatus)
    .query(`
      SELECT
        q.ID_COTIZACION, q.NUM_COTIZACION, q.ID_CLIENTE, q.CLIENTE_NOMBRE, q.ID_TP,
        q.SUBTOTAL, q.UTILIDAD_ESTIMADA, q.ESTADO, q.ID_FACT, q.USUARIO, q.ID_USUARIO,
        q.NOTA, q.FECHA_HORA, q.ACTUALIZADO_EN,
        COUNT(d.ID_COTIZACION_DETALLE) AS LINEAS
      FROM dbo.COTIZACION q
      LEFT JOIN dbo.COTIZACION_DETALLE d
        ON d.ID_COTIZACION = q.ID_COTIZACION
      WHERE (@status = 'TODAS' OR q.ESTADO = @status)
      GROUP BY
        q.ID_COTIZACION, q.NUM_COTIZACION, q.ID_CLIENTE, q.CLIENTE_NOMBRE, q.ID_TP,
        q.SUBTOTAL, q.UTILIDAD_ESTIMADA, q.ESTADO, q.ID_FACT, q.USUARIO, q.ID_USUARIO,
        q.NOTA, q.FECHA_HORA, q.ACTUALIZADO_EN
      ORDER BY q.FECHA_HORA DESC, q.ID_COTIZACION DESC;
    `);

  return result.recordset.map(mapQuoteRow);
}

async function getQuoteDetails(quoteId) {
  const pool = await getPool();
  await ensureQuoteObjects(pool);
  const quoteResult = await pool.request()
    .input('quote_id', sql.Int, Number(quoteId))
    .query(`
      SELECT
        q.ID_COTIZACION, q.NUM_COTIZACION, q.ID_CLIENTE, q.CLIENTE_NOMBRE, q.ID_TP,
        q.SUBTOTAL, q.UTILIDAD_ESTIMADA, q.ESTADO, q.ID_FACT, q.USUARIO, q.ID_USUARIO,
        q.NOTA, q.FECHA_HORA, q.ACTUALIZADO_EN,
        COUNT(d.ID_COTIZACION_DETALLE) AS LINEAS
      FROM dbo.COTIZACION q
      LEFT JOIN dbo.COTIZACION_DETALLE d
        ON d.ID_COTIZACION = q.ID_COTIZACION
      WHERE q.ID_COTIZACION = @quote_id
      GROUP BY
        q.ID_COTIZACION, q.NUM_COTIZACION, q.ID_CLIENTE, q.CLIENTE_NOMBRE, q.ID_TP,
        q.SUBTOTAL, q.UTILIDAD_ESTIMADA, q.ESTADO, q.ID_FACT, q.USUARIO, q.ID_USUARIO,
        q.NOTA, q.FECHA_HORA, q.ACTUALIZADO_EN;
    `);
  const quote = quoteResult.recordset[0];

  if (!quote) {
    throw new Error('Cotizacion no encontrada');
  }

  const linesResult = await pool.request()
    .input('quote_id', sql.Int, Number(quoteId))
    .query(`
      SELECT
        ID_COTIZACION_DETALLE, ID_COTIZACION, ID_PRODUCTO, CODIGO_PRODUCTO,
        PRODUCTO_NOMBRE, CANTIDAD, PRECIO_COSTO, PRECIO_VENTA, UTILIDAD, TOTAL_LINEA
      FROM dbo.COTIZACION_DETALLE
      WHERE ID_COTIZACION = @quote_id
      ORDER BY ID_COTIZACION_DETALLE ASC;
    `);

  return {
    quote: mapQuoteRow(quote),
    lines: linesResult.recordset.map((line) => ({
      id: Number(line.ID_COTIZACION_DETALLE || 0),
      quoteId: Number(line.ID_COTIZACION || 0),
      productId: Number(line.ID_PRODUCTO || 0),
      sku: line.CODIGO_PRODUCTO || '',
      productName: line.PRODUCTO_NOMBRE || '',
      quantity: Number(line.CANTIDAD || 0),
      unitCost: Number(line.PRECIO_COSTO || 0),
      salePrice: Number(line.PRECIO_VENTA || 0),
      utility: Number(line.UTILIDAD || 0),
      total: Number(line.TOTAL_LINEA || 0),
    })),
  };
}

async function createQuote({ user, userId, paymentTypeId, customerId, customerName, lines, note = '' }) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('No hay productos para guardar la cotizacion');
  }

  const pool = await getPool();
  await ensureInventoryInsertCompatibility(pool);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await ensureQuoteObjects(transaction);
    await setAuditContext(transaction, { userId, user });
    const resolvedPaymentTypeId = Number(paymentTypeId || 1);
    const resolvedUserId = userId ? Number(userId) : null;
    const resolvedUserName = user || (resolvedUserId ? await resolveUserName(transaction, resolvedUserId) : 'Sistema') || 'Sistema';
    const subtotal = lines.reduce((total, line) => total + Number(line.salePrice || 0) * Number(line.quantity || 0), 0);
    const utility = lines.reduce((total, line) => total + (Number(line.salePrice || 0) - Number(line.unitCost || 0)) * Number(line.quantity || 0), 0);

    const quoteResult = await new sql.Request(transaction)
      .input('customer_id', sql.Int, customerId ? Number(customerId) : null)
      .input('customer_name', sql.NVarChar(250), String(customerName || 'Cliente final').trim().slice(0, 250))
      .input('payment_type_id', sql.Int, resolvedPaymentTypeId)
      .input('subtotal', sql.Decimal(18, 2), Number(subtotal.toFixed(2)))
      .input('utility', sql.Decimal(18, 2), Number(utility.toFixed(2)))
      .input('user_name', sql.NVarChar(120), String(resolvedUserName).slice(0, 120))
      .input('user_id', sql.Int, resolvedUserId)
      .input('note', sql.NVarChar(500), String(note || '').trim().slice(0, 500))
      .query(`
        INSERT INTO dbo.COTIZACION (
          ID_CLIENTE, CLIENTE_NOMBRE, ID_TP, SUBTOTAL, UTILIDAD_ESTIMADA,
          ESTADO, USUARIO, ID_USUARIO, NOTA
        )
        VALUES (
          @customer_id, @customer_name, @payment_type_id, @subtotal, @utility,
          'ABIERTA', @user_name, @user_id, @note
        );

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS quote_id;
      `);
    const quoteId = Number(quoteResult.recordset[0]?.quote_id || 0);

    if (!quoteId) {
      throw new Error('No se pudo crear la cotizacion');
    }

    for (const line of lines) {
      if (!line.productId || !line.quantity || Number(line.quantity) <= 0) {
        throw new Error('Linea de cotizacion invalida');
      }

      const productResult = await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.productId))
        .query('SELECT TOP 1 codigo, nombre FROM dbo.producto WHERE id_producto = @product_id;');
      const product = productResult.recordset[0] || {};
      const lineQuantity = roundLotQuantity(line.quantity);
      const lineTotal = Number(line.salePrice || 0) * lineQuantity;
      const lineUtility = (Number(line.salePrice || 0) - Number(line.unitCost || 0)) * lineQuantity;


      /* muestrar error para guardar una compra en cotizaciones
      const preservedCashOut = Number(cut.SALIDA_DE_DINERO || totals.cashOut || 0);
      const recalculatedCashTotal = Number((
        Number(cut.DINERO_INICIA_CAJA || totals.initialCash || 0) +
        Number(totals.cashSales || 0) +
        Number(totals.creditPayments || 0) +
        Number(totals.cashIn || 0) -
        preservedCashOut
      ).toFixed(2));

      */


      await new sql.Request(transaction)
        .input('quote_id', sql.Int, quoteId)
        .input('product_id', sql.Int, Number(line.productId))
        .input('sku', sql.VarChar(120), String(product.codigo || '').slice(0, 120))
        .input('product_name', sql.NVarChar(250), String(product.nombre || line.productName || '').slice(0, 250))
        .input('quantity', sql.Decimal(18, 3), lineQuantity)
        .input('unit_cost', sql.Decimal(18, 4), Number(line.unitCost || 0))
        .input('sale_price', sql.Decimal(18, 4), Number(line.salePrice || 0))
        .input('utility', sql.Decimal(18, 2), Number(lineUtility.toFixed(2)))
        .input('line_total', sql.Decimal(18, 2), Number(lineTotal.toFixed(2)))
        .query(`
          INSERT INTO dbo.COTIZACION_DETALLE (
            ID_COTIZACION, ID_PRODUCTO, CODIGO_PRODUCTO, PRODUCTO_NOMBRE,
            CANTIDAD, PRECIO_COSTO, PRECIO_VENTA, UTILIDAD, TOTAL_LINEA
          )
          VALUES (
            @quote_id, @product_id, @sku, @product_name,
            @quantity, @unit_cost, @sale_price, @utility, @line_total
          );
        `);
    }

    await insertAuditRecord(transaction, {
      tableName: 'dbo.COTIZACION',
      action: 'COTIZACION',
      recordKey: `ID_COTIZACION=${quoteId}`,
      userId: resolvedUserId,
      user: resolvedUserName,
      newData: `cotizacion=${quoteId}; productos=${lines.length}; total=${Number(subtotal.toFixed(2))}; tipo_pago=${resolvedPaymentTypeId}`,
    });

    await transaction.commit();
    return getQuoteDetails(quoteId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO VALIDA EL USUARIO Y LA CONTRASENA CONTRA LA TABLA USUARIO.
// TAMBIEN ACTUALIZA LA FECHA DEL ULTIMO ACCESO DEL USUARIO AUTENTICADO.

async function loginUser(usuario, pass) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('usuario', sql.VarChar(60), usuario)
    .input('pass', sql.VarChar(255), pass)
    .query(`
      SELECT TOP 1
        id_usuario,
        nombre,
        usuario,
        rol,
        activo
      FROM usuario
      WHERE usuario = @usuario
        AND pass = @pass
        AND activo = 1
    `);

  const user = result.recordset[0];

  if (!user) {
    return null;
  }

  await pool
    .request()
    .input('id_usuario', sql.Int, user.id_usuario)
    .query(`
      UPDATE usuario
      SET ultimo_acceso = GETDATE(),
          actualizado_en = GETDATE()
      WHERE id_usuario = @id_usuario
    `);

  await refreshExpiringProducts();

  try {
    await executeMonthlyCostIncreaseProcedure(user.id_usuario);
  } catch (error) {
    console.error('No se pudo ejecutar sp_registrar_aumentos_costo_ultimo_mes:', error.message || error);
  }

  return {
    id: user.id_usuario,
    nombre: user.nombre,
    usuario: user.usuario,
    rol: user.rol,
  };
}

async function executeMonthlyCostIncreaseProcedure(userId = null) {
  const pool = await getPool();

  await pool
    .request()
    .input('usuario_id', sql.Int, userId ? Number(userId) : null)
    .execute('dbo.sp_registrar_aumentos_costo_ultimo_mes');
}

async function listMonthlyCostIncreaseAlerts() {
  const pool = await getPool();
  const result = await pool.request().query(`
    WITH ultimo_periodo AS (
      SELECT TOP 1
        periodo_anio,
        periodo_mes
      FROM dbo.ALERTA_AUMENTO_COSTO_MENSUAL
      ORDER BY periodo_anio DESC, periodo_mes DESC
    )
    SELECT
      a.periodo_anio,
      a.periodo_mes,
      a.id_producto,
      a.codigo,
      a.producto,
      a.categoria,
      a.costo_anterior,
      a.costo_actual,
      a.aumento_valor,
      a.aumento_porcentaje,
      a.precio_venta_actual,
      a.stock_actual,
      a.detectado_en
    FROM dbo.ALERTA_AUMENTO_COSTO_MENSUAL a
    INNER JOIN ultimo_periodo p
      ON p.periodo_anio = a.periodo_anio
     AND p.periodo_mes = a.periodo_mes
    ORDER BY a.aumento_valor DESC, a.producto ASC
  `);

  const rows = result.recordset.map((row) => ({
    year: Number(row.periodo_anio || 0),
    month: Number(row.periodo_mes || 0),
    productId: Number(row.id_producto || 0),
    sku: row.codigo || '',
    productName: row.producto || 'Sin producto',
    category: row.categoria || 'Sin categoria',
    previousCost: Number(row.costo_anterior || 0),
    currentCost: Number(row.costo_actual || 0),
    increaseAmount: Number(row.aumento_valor || 0),
    increasePercentage: Number(row.aumento_porcentaje || 0),
    currentSalePrice: Number(row.precio_venta_actual || 0),
    currentStock: Number(row.stock_actual || 0),
    detectedAt: row.detectado_en ? new Date(row.detectado_en).toISOString() : null,
  }));

  return {
    period: rows[0]
      ? {
          year: rows[0].year,
          month: rows[0].month,
        }
      : null,
    rows,
  };
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO OBTIENE LOS USUARIOS ACTIVOS DE LA TABLA USUARIO
// PARA CARGARLOS EN EL CAMPO DE INICIO DE SESION.
async function listActiveUsers() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      id_usuario,
      nombre,
      usuario,
      rol
    FROM dbo.usuario
    WHERE activo = 1
    ORDER BY usuario ASC
  `);

  return result.recordset.map((user) => ({
    id: user.id_usuario,
    nombre: user.nombre,
    usuario: user.usuario,
    rol: user.rol,
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA dbo.usuario, dbo.ASISTENCIA Y dbo.VW_ASISTENCIA_HORAS
// PARA ALIMENTAR LAS PAGINAS DE ASISTENCIA Y PLANILLA CON USUARIOS REALES Y HORAS TRABAJADAS REALES.
// TAMBIEN DEVUELVE EL HISTORIAL DIARIO PARA AGRUPARLO POR USUARIO, SEMANA Y DIA EN EL FRONTEND.
async function listAttendanceUsers() {
  const pool = await getPool();
  const summaryResult = await pool.request().query(`
    WITH asistencia_hoy AS (
      SELECT
        a.ID_EMPLEADO,
        TRY_CONVERT(date, a.FECHA) AS FECHA_ASISTENCIA,
        CONVERT(varchar(5), TRY_CONVERT(time, a.HORA_ENTRADA), 108) AS HORA_ENTRADA,
        CONVERT(varchar(5), TRY_CONVERT(time, a.HORA_SALIDA), 108) AS HORA_SALIDA,
        UPPER(LTRIM(RTRIM(ISNULL(a.ESTADO, '')))) AS ESTADO,
        ROW_NUMBER() OVER (
          PARTITION BY a.ID_EMPLEADO
          ORDER BY a.ID_ASISTENCIA DESC
        ) AS rn
      FROM dbo.ASISTENCIA a
      WHERE TRY_CONVERT(date, a.FECHA) = CAST(GETDATE() AS date)
    ),
    horas_hoy AS (
      SELECT
        vh.ID_EMPLEADO,
        SUM(CAST(ISNULL(vh.HORAS_TRABAJADAS, 0) AS decimal(18, 2))) AS HORAS_HOY
      FROM dbo.VW_ASISTENCIA_HORAS vh
      WHERE TRY_CONVERT(date, vh.FECHA) = CAST(GETDATE() AS date)
      GROUP BY vh.ID_EMPLEADO
    ),
    horas_semana AS (
      SELECT
        vh.ID_EMPLEADO,
        SUM(CAST(ISNULL(vh.HORAS_TRABAJADAS, 0) AS decimal(18, 2))) AS HORAS_SEMANA,
        COUNT(DISTINCT TRY_CONVERT(date, vh.FECHA)) AS DIAS_TRABAJADOS
      FROM dbo.VW_ASISTENCIA_HORAS vh
      WHERE TRY_CONVERT(date, vh.FECHA) BETWEEN DATEADD(day, -6, CAST(GETDATE() AS date)) AND CAST(GETDATE() AS date)
      GROUP BY vh.ID_EMPLEADO
    )
    SELECT
      u.id_usuario,
      u.nombre,
      u.usuario,
      u.rol,
      CAST(GETDATE() AS date) AS FECHA_REFERENCIA,
      ah.FECHA_ASISTENCIA,
      ah.HORA_ENTRADA,
      ah.HORA_SALIDA,
      CASE
        WHEN ah.ESTADO IN ('AUSENTE', 'PERMISO', 'VACACIONES', 'INCAPACIDAD') THEN ah.ESTADO
        WHEN ISNULL(hh.HORAS_HOY, 0) > 0 AND ISNULL(ah.HORA_ENTRADA, '00:00') > '08:00' THEN 'TARDE'
        WHEN ISNULL(hh.HORAS_HOY, 0) > 0 THEN 'PUNTUAL'
        ELSE 'SIN REGISTRO'
      END AS ESTADO_ASISTENCIA,
      CAST(ISNULL(hh.HORAS_HOY, 0) AS decimal(18, 2)) AS HORAS_HOY,
      CAST(ISNULL(hs.HORAS_SEMANA, 0) AS decimal(18, 2)) AS HORAS_SEMANA,
      CAST(ISNULL(hs.DIAS_TRABAJADOS, 0) AS int) AS DIAS_TRABAJADOS
    FROM dbo.usuario u
    LEFT JOIN asistencia_hoy ah
      ON ah.ID_EMPLEADO = u.id_usuario
      AND ah.rn = 1
    LEFT JOIN horas_hoy hh
      ON hh.ID_EMPLEADO = u.id_usuario
    LEFT JOIN horas_semana hs
      ON hs.ID_EMPLEADO = u.id_usuario
    WHERE u.activo = 1
    ORDER BY u.nombre ASC
  `);

  const historyResult = await pool.request().query(`
    WITH asistencia_historial AS (
      SELECT
        a.ID_ASISTENCIA,
        a.ID_EMPLEADO,
        TRY_CONVERT(date, a.FECHA) AS FECHA_ASISTENCIA,
        a.num_semana,
        CONVERT(varchar(5), TRY_CONVERT(time, a.HORA_ENTRADA), 108) AS HORA_ENTRADA,
        CONVERT(varchar(5), TRY_CONVERT(time, a.HORA_SALIDA), 108) AS HORA_SALIDA,
        UPPER(LTRIM(RTRIM(ISNULL(a.ESTADO, '')))) AS ESTADO,
        ROW_NUMBER() OVER (
          PARTITION BY a.ID_EMPLEADO, TRY_CONVERT(date, a.FECHA)
          ORDER BY a.ID_ASISTENCIA DESC
        ) AS rn
      FROM dbo.ASISTENCIA a
      WHERE TRY_CONVERT(date, a.FECHA) IS NOT NULL
    )
    SELECT
      u.id_usuario,
      ah.ID_ASISTENCIA,
      ah.FECHA_ASISTENCIA,
      ISNULL(ah.num_semana, DATEPART(ISO_WEEK, ah.FECHA_ASISTENCIA)) AS NUM_SEMANA,
      ah.HORA_ENTRADA,
      ah.HORA_SALIDA,
      CASE
        WHEN ah.ESTADO IN ('AUSENTE', 'PERMISO', 'VACACIONES', 'INCAPACIDAD') THEN ah.ESTADO
        WHEN ISNULL(vh.HORAS_TRABAJADAS, 0) > 0 AND ISNULL(ah.HORA_ENTRADA, '00:00') > '08:00' THEN 'TARDE'
        WHEN ISNULL(vh.HORAS_TRABAJADAS, 0) > 0 THEN 'PUNTUAL'
        ELSE 'SIN REGISTRO'
      END AS ESTADO_ASISTENCIA,
      CAST(ISNULL(vh.HORAS_TRABAJADAS, 0) AS decimal(18, 2)) AS HORAS_TRABAJADAS
    FROM dbo.usuario u
    LEFT JOIN asistencia_historial ah
      ON ah.ID_EMPLEADO = u.id_usuario
      AND ah.rn = 1
    LEFT JOIN dbo.VW_ASISTENCIA_HORAS vh
      ON vh.ID_EMPLEADO = ah.ID_EMPLEADO
      AND TRY_CONVERT(date, vh.FECHA) = ah.FECHA_ASISTENCIA
    WHERE u.activo = 1
      AND ah.FECHA_ASISTENCIA IS NOT NULL
    ORDER BY u.nombre ASC, ah.FECHA_ASISTENCIA DESC
  `);

  const historyByUserId = new Map();

  for (const row of historyResult.recordset) {
    const userId = Number(row.id_usuario);
    const existingHistory = historyByUserId.get(userId) || [];
      existingHistory.push({
        id: Number(row.ID_ASISTENCIA),
        date: row.FECHA_ASISTENCIA || null,
        weekNumber: Number(row.NUM_SEMANA || 0),
        entryTime: row.HORA_ENTRADA || '',
        exitTime: row.HORA_SALIDA || '',
        status: row.ESTADO_ASISTENCIA || 'SIN REGISTRO',
        workedHours: Number(row.HORAS_TRABAJADAS || 0),
      });
    historyByUserId.set(userId, existingHistory);
  }

  return summaryResult.recordset.map((user) => ({
    id: Number(user.id_usuario),
    nombre: user.nombre,
    usuario: user.usuario,
    rol: user.rol,
    date: user.FECHA_ASISTENCIA || user.FECHA_REFERENCIA || null,
    entryTime: user.HORA_ENTRADA || '',
    exitTime: user.HORA_SALIDA || '',
    status: user.ESTADO_ASISTENCIA || 'SIN REGISTRO',
    workedHours: Number(user.HORAS_HOY || 0),
    weeklyHours: Number(user.HORAS_SEMANA || 0),
    attendanceDays: Number(user.DIAS_TRABAJADOS || 0),
    history: historyByUserId.get(Number(user.id_usuario)) || [],
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CREA O ACTUALIZA LA MARCA DIARIA EN dbo.ASISTENCIA.
// ACEPTA ENTRADA Y SALIDA JUNTAS, O UNA MARCA PARCIAL DESDE EL BOTON DEL USUARIO.
async function saveAttendanceMark({ employeeId, date, entryTime, exitTime, recordedBy, recordedById, observation }) {
  const pool = await getPool();
  const normalizedEmployeeId = Number(employeeId || 0);
  const normalizedDate = String(date || '').trim();
  const normalizedEntryTime = String(entryTime || '').trim();
  const normalizedExitTime = String(exitTime || '').trim();
  const normalizedRecordedBy = String(recordedBy || '').trim().slice(0, 30) || 'sistema';
  const normalizedRecordedById = Number(recordedById || 0);
  const normalizedObservation = String(observation || '').trim().slice(0, 255);

  if (!normalizedEmployeeId || normalizedEmployeeId <= 0) {
    throw new Error('Empleado requerido');
  }

  if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new Error('Fecha invalida');
  }

  if (!normalizedEntryTime && !normalizedExitTime) {
    throw new Error('Debes enviar una hora de entrada o salida');
  }

  if (normalizedEntryTime && !/^\d{2}:\d{2}$/.test(normalizedEntryTime)) {
    throw new Error('La hora de entrada debe estar en formato militar HH:mm');
  }

  if (normalizedExitTime && !/^\d{2}:\d{2}$/.test(normalizedExitTime)) {
    throw new Error('La hora de salida debe estar en formato militar HH:mm');
  }

  if (normalizedEntryTime && normalizedExitTime && normalizedEntryTime >= normalizedExitTime) {
    throw new Error('La hora de salida debe ser mayor que la hora de entrada');
  }

  const result = await pool
    .request()
    .input('employee_id', sql.Int, normalizedEmployeeId)
    .input('attendance_date', sql.Date, normalizedDate)
    .input('attendance_date_text', sql.VarChar(10), normalizedDate)
    .input('entry_time_text', sql.VarChar(5), normalizedEntryTime || null)
    .input('exit_time_text', sql.VarChar(5), normalizedExitTime || null)
    .input('attendance_status', sql.VarChar(20), 'PRESENTE')
    .input('observation', sql.VarChar(255), normalizedObservation || null)
    .input('recorded_by', sql.VarChar(30), normalizedRecordedBy)
    .query(`
      SET DATEFIRST 7;
      IF EXISTS (
        SELECT 1
        FROM dbo.ASISTENCIA
        WHERE ID_EMPLEADO = @employee_id
          AND FECHA = @attendance_date
      )
      BEGIN
        UPDATE dbo.ASISTENCIA
        SET HORA_ENTRADA = CASE
              WHEN @entry_time_text IS NULL THEN HORA_ENTRADA
              ELSE CONVERT(datetime, @attendance_date_text + 'T' + @entry_time_text + ':00', 126)
            END,
            HORA_SALIDA = CASE
              WHEN @exit_time_text IS NULL THEN HORA_SALIDA
              ELSE CONVERT(datetime, @attendance_date_text + 'T' + @exit_time_text + ':00', 126)
            END,
            num_semana = DATEPART(WEEK, @attendance_date),
            ESTADO = @attendance_status,
            OBSERVACION = @observation,
            USUARIO_REGISTRO = @recorded_by,
            FECHA_REGISTRO = GETDATE()
        WHERE ID_EMPLEADO = @employee_id
          AND FECHA = @attendance_date;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.ASISTENCIA (
          ID_EMPLEADO,
          FECHA,
          HORA_ENTRADA,
          HORA_SALIDA,
          num_semana,
          ESTADO,
          OBSERVACION,
          USUARIO_REGISTRO,
          FECHA_REGISTRO
        )
        VALUES (
          @employee_id,
          @attendance_date,
          CASE
            WHEN @entry_time_text IS NULL THEN NULL
            ELSE CONVERT(datetime, @attendance_date_text + 'T' + @entry_time_text + ':00', 126)
          END,
          CASE
            WHEN @exit_time_text IS NULL THEN NULL
            ELSE CONVERT(datetime, @attendance_date_text + 'T' + @exit_time_text + ':00', 126)
          END,
          DATEPART(WEEK, @attendance_date),
          @attendance_status,
          @observation,
          @recorded_by,
          GETDATE()
        );
      END;

      SELECT TOP 1
        ID_ASISTENCIA,
        ID_EMPLEADO,
        FECHA,
        CONVERT(varchar(5), TRY_CONVERT(time, HORA_ENTRADA), 108) AS HORA_ENTRADA,
        CONVERT(varchar(5), TRY_CONVERT(time, HORA_SALIDA), 108) AS HORA_SALIDA,
        ESTADO
      FROM dbo.ASISTENCIA
      WHERE ID_EMPLEADO = @employee_id
        AND FECHA = @attendance_date
      ORDER BY ID_ASISTENCIA DESC;
    `);

  const row = result.recordset[0];
  await insertAuditRecord(pool, {
    tableName: 'dbo.ASISTENCIA',
    action: 'ASISTENCIA',
    recordKey: `ID_ASISTENCIA=${row.ID_ASISTENCIA}`,
    userId: normalizedRecordedById || null,
    user: normalizedRecordedBy,
    previousData: '',
    newData: `empleado=${row.ID_EMPLEADO}; fecha=${normalizedDate}; entrada=${row.HORA_ENTRADA || ''}; salida=${row.HORA_SALIDA || ''}; estado=${row.ESTADO || 'PRESENTE'}`,
  });

  return {
    id: Number(row.ID_ASISTENCIA),
    employeeId: Number(row.ID_EMPLEADO),
    date: row.FECHA,
    entryTime: row.HORA_ENTRADA || '',
    exitTime: row.HORA_SALIDA || '',
    status: row.ESTADO || 'PRESENTE',
  };
}

function extractPayrollDateFromDay(day) {
  const match = String(day || '').match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function syncPayrollRowsToAttendance(transaction, {
  weekNumber,
  createdByUserId,
  rows,
}) {
  let synced = 0;
  const recordedBy = (await resolveUserName(transaction, createdByUserId)) || 'planilla';

  for (const row of rows) {
    const userId = Number(row.userId || 0);
    const attendanceDate = extractPayrollDateFromDay(row.day);

    if (!userId || userId <= 0 || !attendanceDate) {
      continue;
    }

    const dailyHours = Number((
      Number(row.normalHours || 0) +
      Number(row.extra1Hours || 0) +
      Number(row.extra2Hours || 0) +
      Number(row.extra3Hours || 0)
    ).toFixed(2));
    const workedMinutes = Math.max(0, Math.round(dailyHours * 60));
    const attendanceStatus = workedMinutes > 0 ? 'PRESENTE' : 'SIN REGISTRO';
    const observation = `Generado desde planilla semana ${weekNumber}. HN=${Number(row.normalHours || 0).toFixed(2)}, HH1=${Number(row.extra1Hours || 0).toFixed(2)}, HH2=${Number(row.extra2Hours || 0).toFixed(2)}, HH3=${Number(row.extra3Hours || 0).toFixed(2)}`.slice(0, 255);

    await new sql.Request(transaction)
      .input('employee_id', sql.Int, userId)
      .input('attendance_date', sql.Date, attendanceDate)
      .input('attendance_date_text', sql.VarChar(10), attendanceDate)
      .input('week_number', sql.Int, Number(weekNumber))
      .input('worked_minutes', sql.Int, workedMinutes)
      .input('attendance_status', sql.VarChar(20), attendanceStatus)
      .input('observation', sql.VarChar(255), observation)
      .input('recorded_by', sql.VarChar(30), String(recordedBy).slice(0, 30))
      .query(`
        DECLARE @entry datetime = CASE
          WHEN @worked_minutes > 0 THEN CONVERT(datetime, @attendance_date_text + 'T08:00:00', 126)
          ELSE NULL
        END;
        DECLARE @exit datetime = CASE
          WHEN @worked_minutes > 0 THEN DATEADD(minute, @worked_minutes, CONVERT(datetime, @attendance_date_text + 'T08:00:00', 126))
          ELSE NULL
        END;

        IF EXISTS (
          SELECT 1
          FROM dbo.ASISTENCIA
          WHERE ID_EMPLEADO = @employee_id
            AND FECHA = @attendance_date
        )
        BEGIN
          UPDATE dbo.ASISTENCIA
          SET
            HORA_ENTRADA = @entry,
            HORA_SALIDA = @exit,
            num_semana = @week_number,
            ESTADO = @attendance_status,
            OBSERVACION = @observation,
            USUARIO_REGISTRO = @recorded_by,
            FECHA_REGISTRO = GETDATE()
          WHERE ID_EMPLEADO = @employee_id
            AND FECHA = @attendance_date;
        END
        ELSE
        BEGIN
          INSERT INTO dbo.ASISTENCIA (
            ID_EMPLEADO,
            FECHA,
            HORA_ENTRADA,
            HORA_SALIDA,
            num_semana,
            ESTADO,
            OBSERVACION,
            USUARIO_REGISTRO,
            FECHA_REGISTRO
          )
          VALUES (
            @employee_id,
            @attendance_date,
            @entry,
            @exit,
            @week_number,
            @attendance_status,
            @observation,
            @recorded_by,
            GETDATE()
          );
        END;
      `);

    synced += 1;
  }

  return synced;
}

async function ensurePayrollTableSupportsDecimals(executor) {
  await new sql.Request(executor).query(`
    IF OBJECT_ID('dbo.PLANILLA', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.PLANILLA (
        ID_PLANILLA int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID_USER int NOT NULL,
        DIA varchar(30) NOT NULL,
        HN decimal(18, 2) NOT NULL,
        HH1 decimal(18, 2) NOT NULL,
        HH2 decimal(18, 2) NOT NULL,
        HH3 decimal(18, 2) NOT NULL,
        THN decimal(18, 2) NOT NULL,
        THH1 decimal(18, 2) NOT NULL,
        THH2 decimal(18, 2) NOT NULL,
        THH3 decimal(18, 2) NOT NULL,
        TOTAL_HORAS_ACUMULADAS decimal(18, 2) NOT NULL,
        SUBTOTAL_SALARIO decimal(18, 2) NOT NULL,
        BONIFICACION decimal(18, 2) NOT NULL,
        TOTAL_SALARIO_SEMANA decimal(18, 2) NOT NULL,
        FECHA_HORA varchar(50) NOT NULL,
        NUM_SEMANA int NOT NULL,
        ID_USER_CREATION int NOT NULL
      );
      RETURN;
    END;

    DECLARE @sql nvarchar(max) = N'';

    SELECT @sql = @sql + N'ALTER TABLE dbo.PLANILLA ALTER COLUMN ' + QUOTENAME(name) + N' decimal(18, 2) NOT NULL;'
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.PLANILLA', 'U')
      AND name IN (
        'HN', 'HH1', 'HH2', 'HH3', 'THN', 'THH1', 'THH2', 'THH3',
        'TOTAL_HORAS_ACUMULADAS', 'SUBTOTAL_SALARIO', 'BONIFICACION', 'TOTAL_SALARIO_SEMANA'
      )
      AND scale = 0;

    IF @sql <> N''
    BEGIN
      EXEC sp_executesql @sql;
    END;
  `);
}

async function savePayrollWeek({ weekNumber, createdByUserId, rows }) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const normalizedWeek = Number(weekNumber || 0);
    const normalizedCreatedBy = Number(createdByUserId || 0);
    const normalizedRows = Array.isArray(rows) ? rows : [];

    if (!normalizedWeek || normalizedWeek <= 0) {
      throw new Error('Semana requerida para registrar planilla');
    }

    if (!normalizedCreatedBy || normalizedCreatedBy <= 0) {
      throw new Error('Usuario requerido para registrar planilla');
    }

    await ensurePayrollTableSupportsDecimals(transaction);
    await setAuditContext(transaction, { userId: normalizedCreatedBy });

    const userIds = [...new Set(normalizedRows.map((row) => Number(row.userId || 0)).filter((userId) => userId > 0))];

    if (userIds.length === 0) {
      throw new Error('No hay empleados validos para registrar planilla');
    }

    const deleteRequest = new sql.Request(transaction).input('week_number', sql.Int, normalizedWeek);
    userIds.forEach((userId, index) => deleteRequest.input(`user_id_${index}`, sql.Int, userId));
    await deleteRequest.query(`
      DELETE FROM dbo.PLANILLA
      WHERE NUM_SEMANA = @week_number
        AND ID_USER IN (${userIds.map((_, index) => `@user_id_${index}`).join(', ')});
    `);

    let inserted = 0;
    const insertedRows = [];

    for (const row of normalizedRows) {
      const userId = Number(row.userId || 0);

      if (!userId || userId <= 0) {
        continue;
      }

      await new sql.Request(transaction)
        .input('user_id', sql.Int, userId)
        .input('day', sql.VarChar(30), String(row.day || '').slice(0, 30))
        .input('normal_hours', sql.Decimal(18, 2), Number(row.normalHours || 0))
        .input('extra1_hours', sql.Decimal(18, 2), Number(row.extra1Hours || 0))
        .input('extra2_hours', sql.Decimal(18, 2), Number(row.extra2Hours || 0))
        .input('extra3_hours', sql.Decimal(18, 2), Number(row.extra3Hours || 0))
        .input('normal_pay', sql.Decimal(18, 2), Number(row.normalPay || 0))
        .input('extra1_pay', sql.Decimal(18, 2), Number(row.extra1Pay || 0))
        .input('extra2_pay', sql.Decimal(18, 2), Number(row.extra2Pay || 0))
        .input('extra3_pay', sql.Decimal(18, 2), Number(row.extra3Pay || 0))
        .input('total_hours', sql.Decimal(18, 2), Number(row.totalHours || 0))
        .input('salary', sql.Decimal(18, 2), Number(row.salary || 0))
        .input('bonus', sql.Decimal(18, 2), Number(row.bonus || 0))
        .input('total', sql.Decimal(18, 2), Number(row.total || 0))
        .input('week_number', sql.Int, normalizedWeek)
        .input('created_by', sql.Int, normalizedCreatedBy)
        .query(`
          INSERT INTO dbo.PLANILLA (
            ID_USER, DIA, HN, HH1, HH2, HH3, THN, THH1, THH2, THH3,
            TOTAL_HORAS_ACUMULADAS, SUBTOTAL_SALARIO, BONIFICACION,
            TOTAL_SALARIO_SEMANA, FECHA_HORA, NUM_SEMANA, ID_USER_CREATION
          )
          VALUES (
            @user_id, @day, @normal_hours, @extra1_hours, @extra2_hours, @extra3_hours,
            @normal_pay, @extra1_pay, @extra2_pay, @extra3_pay, @total_hours,
            @salary, @bonus, @total, CONVERT(varchar(50), SYSDATETIME(), 126),
            @week_number, @created_by
          );
        `);
      inserted += 1;
      insertedRows.push(row);
    }

    const attendanceSynced = await syncPayrollRowsToAttendance(transaction, {
      weekNumber: normalizedWeek,
      createdByUserId: normalizedCreatedBy,
      rows: insertedRows,
    });

    await insertAuditRecord(transaction, {
      tableName: 'dbo.PLANILLA',
      action: 'PLANILLA',
      recordKey: `semana=${normalizedWeek}`,
      userId: normalizedCreatedBy,
      newData: `Registros guardados: ${inserted}; asistencias sincronizadas=${attendanceSynced}`,
    });

    await transaction.commit();
    return { inserted, attendanceSynced };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listPayrollRecords() {
  const pool = await getPool();
  await ensurePayrollTableSupportsDecimals(pool);

  const result = await pool.request().query(`
    SELECT
      p.ID_PLANILLA,
      p.ID_USER,
      u.nombre AS USER_NAME,
      u.usuario AS USER_LOGIN,
      u.rol AS USER_ROLE,
      p.DIA,
      p.HN,
      p.HH1,
      p.HH2,
      p.HH3,
      p.THN,
      p.THH1,
      p.THH2,
      p.THH3,
      p.TOTAL_HORAS_ACUMULADAS,
      p.SUBTOTAL_SALARIO,
      p.BONIFICACION,
      p.TOTAL_SALARIO_SEMANA,
      p.FECHA_HORA,
      p.NUM_SEMANA,
      p.ID_USER_CREATION
    FROM dbo.PLANILLA p
    INNER JOIN dbo.usuario u
      ON u.id_usuario = p.ID_USER
    ORDER BY p.NUM_SEMANA DESC, u.nombre ASC, p.ID_PLANILLA ASC;
  `);

  return result.recordset.map((row) => ({
    id: Number(row.ID_PLANILLA),
    userId: Number(row.ID_USER),
    userName: row.USER_NAME || row.USER_LOGIN || `Usuario ${row.ID_USER}`,
    userLogin: row.USER_LOGIN || '',
    userRole: row.USER_ROLE || '',
    day: row.DIA || '',
    normalHours: Number(row.HN || 0),
    extra1Hours: Number(row.HH1 || 0),
    extra2Hours: Number(row.HH2 || 0),
    extra3Hours: Number(row.HH3 || 0),
    normalPay: Number(row.THN || 0),
    extra1Pay: Number(row.THH1 || 0),
    extra2Pay: Number(row.THH2 || 0),
    extra3Pay: Number(row.THH3 || 0),
    totalHours: Number(row.TOTAL_HORAS_ACUMULADAS || 0),
    salary: Number(row.SUBTOTAL_SALARIO || 0),
    bonus: Number(row.BONIFICACION || 0),
    total: Number(row.TOTAL_SALARIO_SEMANA || 0),
    createdAt: row.FECHA_HORA || '',
    weekNumber: Number(row.NUM_SEMANA || 0),
    createdByUserId: Number(row.ID_USER_CREATION || 0),
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO OBTIENE LOS CLIENTES DESDE LA TABLA cliente
// PARA CARGAR EL MODAL DE SELECCION DE CLIENTES EN FACTURACION.
// TAMBIEN CALCULA EL SALDO DESDE dbo.VENTA_CREDITO PARA MOSTRAR
// EL MONTO PENDIENTE REAL DE CADA CLIENTE SEGUN SUS CREDITOS ACTIVOS.
async function listCustomers() {
  const pool = await getPool();
  await ensureCreditPaymentAllocationsTable(pool.request());
  const result = await pool.request().query(`
    WITH abonos_linea AS (
      SELECT ID_VENTA, SUM(MONTO) AS MONTO_ABONADO
      FROM dbo.CREDITO_ABONO_DETALLE
      GROUP BY ID_VENTA
    ),
    saldos_linea AS (
      SELECT
        vc.ID_CLIENTE,
        vc.ID_FACT,
        CASE
          WHEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0) > 0
          THEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0)
          ELSE 0
        END AS SALDO
      FROM dbo.VENTA_CREDITO vc
      LEFT JOIN abonos_linea al
        ON al.ID_VENTA = vc.ID_VENTA
    ),
    creditos AS (
      SELECT
        ID_CLIENTE,
        SUM(SALDO) AS SALDO_CREDITO,
        COUNT(DISTINCT CASE WHEN SALDO > 0.005 THEN ID_FACT END) AS CREDITOS_ABIERTOS
      FROM saldos_linea
      GROUP BY ID_CLIENTE
    )
    SELECT
      c.ID_CLIENTE,
      c.NOMBRE,
      c.APELLIDO,
      c.TELEFONO,
      c.DIRECCION,
      ISNULL(creditos.CREDITOS_ABIERTOS, c.CREDITOS_ABIERTOS) AS CREDITOS_ABIERTOS,
      c.FECHA_HORA,
      ISNULL(creditos.SALDO_CREDITO, 0) AS saldo
    FROM dbo.cliente c
    LEFT JOIN creditos
      ON creditos.ID_CLIENTE = c.ID_CLIENTE
    ORDER BY c.ID_CLIENTE ASC
  `);

  return result.recordset.map((customer) => ({
    id: Number(customer.ID_CLIENTE),
    nombre: customer.NOMBRE,
    apellido: customer.APELLIDO,
    telefono: customer.TELEFONO,
    direccion: customer.DIRECCION,
    creditosAbiertos: Number(customer.CREDITOS_ABIERTOS || 0),
    fechaHora: customer.FECHA_HORA,
    saldo: Number(customer.saldo || 0),
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO OBTIENE LOS PROVEEDORES DESDE LA TABLA proveedor
// PARA CARGAR EL MODAL DE SELECCION DE PROVEEDORES EN COMPRAS.
async function listSuppliers() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      ID_PROVEEDOR,
      NOMBRE,
      TELEFONO,
      DIRECCION,
      CREDITO_ABIERTO,
      COMPRAS_REALIZADAS,
      FECHA_HORA
    FROM dbo.proveedor
    ORDER BY ID_PROVEEDOR ASC
  `);

  return result.recordset.map((supplier) => ({
    id: Number(supplier.ID_PROVEEDOR),
    nombre: supplier.NOMBRE,
    telefono: supplier.TELEFONO,
    direccion: supplier.DIRECCION,
    creditoAbierto: Number(supplier.CREDITO_ABIERTO || 0),
    comprasRealizadas: Number(supplier.COMPRAS_REALIZADAS || 0),
    fechaHora: supplier.FECHA_HORA,
  }));
}

async function ensureProductBarcodeObjects(executor) {
  const request = executor.request ? executor.request() : new sql.Request(executor);
  await request.query(`
    IF OBJECT_ID('dbo.PRODUCTO_CODIGO_BARRA', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.PRODUCTO_CODIGO_BARRA (
        ID_CODIGO_BARRA int IDENTITY(1,1) NOT NULL,
        ID_PRODUCTO int NOT NULL,
        CODIGO_BARRA nvarchar(120) NOT NULL,
        ES_PRINCIPAL bit NOT NULL CONSTRAINT DF_PRODUCTO_CODIGO_BARRA_PRINCIPAL DEFAULT (0),
        ACTIVO bit NOT NULL CONSTRAINT DF_PRODUCTO_CODIGO_BARRA_ACTIVO DEFAULT (1),
        CREADO_POR nvarchar(100) NULL,
        CREADO_EN datetime2(0) NOT NULL CONSTRAINT DF_PRODUCTO_CODIGO_BARRA_CREADO_EN DEFAULT (SYSDATETIME()),
        ACTUALIZADO_POR nvarchar(100) NULL,
        ACTUALIZADO_EN datetime2(0) NULL,
        CONSTRAINT PK_PRODUCTO_CODIGO_BARRA PRIMARY KEY CLUSTERED (ID_CODIGO_BARRA),
        CONSTRAINT FK_PRODUCTO_CODIGO_BARRA_PRODUCTO FOREIGN KEY (ID_PRODUCTO)
          REFERENCES dbo.producto (id_producto)
      );
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'UX_PRODUCTO_CODIGO_BARRA_CODIGO'
        AND object_id = OBJECT_ID('dbo.PRODUCTO_CODIGO_BARRA')
    )
    BEGIN
      CREATE UNIQUE INDEX UX_PRODUCTO_CODIGO_BARRA_CODIGO
        ON dbo.PRODUCTO_CODIGO_BARRA (CODIGO_BARRA);
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'UX_PRODUCTO_CODIGO_BARRA_PRINCIPAL_ACTIVO'
        AND object_id = OBJECT_ID('dbo.PRODUCTO_CODIGO_BARRA')
    )
    BEGIN
      CREATE UNIQUE INDEX UX_PRODUCTO_CODIGO_BARRA_PRINCIPAL_ACTIVO
        ON dbo.PRODUCTO_CODIGO_BARRA (ID_PRODUCTO)
        WHERE ES_PRINCIPAL = 1 AND ACTIVO = 1;
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_PRODUCTO_CODIGO_BARRA_PRODUCTO'
        AND object_id = OBJECT_ID('dbo.PRODUCTO_CODIGO_BARRA')
    )
    BEGIN
      CREATE INDEX IX_PRODUCTO_CODIGO_BARRA_PRODUCTO
        ON dbo.PRODUCTO_CODIGO_BARRA (ID_PRODUCTO, ACTIVO, ES_PRINCIPAL);
    END;

    ;WITH codigos_existentes AS (
      SELECT
        p.id_producto,
        LTRIM(RTRIM(CONVERT(nvarchar(120), p.codigo))) AS codigo_barra,
        ROW_NUMBER() OVER (
          PARTITION BY LTRIM(RTRIM(CONVERT(nvarchar(120), p.codigo)))
          ORDER BY ISNULL(p.activo, 0) DESC, p.id_producto ASC
        ) AS rn
      FROM dbo.producto p
      WHERE NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(120), p.codigo))), '') IS NOT NULL
    )
    INSERT INTO dbo.PRODUCTO_CODIGO_BARRA (
      ID_PRODUCTO,
      CODIGO_BARRA,
      ES_PRINCIPAL,
      ACTIVO,
      CREADO_POR,
      CREADO_EN
    )
    SELECT
      ce.id_producto,
      ce.codigo_barra,
      1,
      1,
      N'Migracion Codex',
      SYSDATETIME()
    FROM codigos_existentes ce
    WHERE ce.rn = 1
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.PRODUCTO_CODIGO_BARRA pcb
        WHERE pcb.CODIGO_BARRA = ce.codigo_barra
      );
  `);
}

async function listProductBarcodesByProductIds(executor, productIds) {
  const uniqueProductIds = [...new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map((productId) => Number(productId || 0))
      .filter((productId) => Number.isInteger(productId) && productId > 0),
  )];

  if (uniqueProductIds.length === 0) {
    return new Map();
  }

  await ensureProductBarcodeObjects(executor);

  const request = executor.request ? executor.request() : new sql.Request(executor);
  const parameters = uniqueProductIds.map((productId, index) => {
    const inputName = `product_id_${index}`;
    request.input(inputName, sql.Int, productId);
    return `@${inputName}`;
  });

  const result = await request.query(`
    SELECT
      ID_CODIGO_BARRA,
      ID_PRODUCTO,
      CODIGO_BARRA,
      ES_PRINCIPAL,
      ACTIVO,
      CREADO_EN,
      ACTUALIZADO_EN
    FROM dbo.PRODUCTO_CODIGO_BARRA
    WHERE ID_PRODUCTO IN (${parameters.join(', ')})
    ORDER BY ES_PRINCIPAL DESC, ACTIVO DESC, CODIGO_BARRA ASC;
  `);

  const grouped = new Map();
  for (const row of result.recordset) {
    const productId = Number(row.ID_PRODUCTO);
    grouped.set(productId, [
      ...(grouped.get(productId) || []),
      {
        id: Number(row.ID_CODIGO_BARRA),
        productId,
        code: row.CODIGO_BARRA || '',
        isPrimary: Boolean(row.ES_PRINCIPAL),
        active: Boolean(row.ACTIVO),
        createdAt: row.CREADO_EN ? new Date(row.CREADO_EN).toISOString() : null,
        updatedAt: row.ACTUALIZADO_EN ? new Date(row.ACTUALIZADO_EN).toISOString() : null,
      },
    ]);
  }

  return grouped;
}

async function listProductBarcodes(productId) {
  if (!productId || Number(productId) <= 0) {
    throw new Error('Producto requerido para consultar codigos de barra');
  }

  const pool = await getPool();
  const grouped = await listProductBarcodesByProductIds(pool, [Number(productId)]);
  return grouped.get(Number(productId)) || [];
}

async function createProductBarcode({ productId, code, userId = null, user = null } = {}) {
  const resolvedProductId = Number(productId || 0);
  const resolvedCode = String(code || '').trim();
  const resolvedUser = (String(user || 'Sistema').trim() || 'Sistema').slice(0, 100);

  if (!resolvedProductId) {
    throw new Error('Producto requerido para agregar codigo de barra');
  }

  if (!resolvedCode) {
    throw new Error('Codigo de barra requerido');
  }

  if (resolvedCode.length > 120) {
    throw new Error('El codigo de barra no puede superar 120 caracteres');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId, user: resolvedUser });
    await ensureProductBarcodeObjects(transaction);

    const productResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .query(`
        SELECT TOP 1 id_producto, nombre
        FROM dbo.producto
        WHERE id_producto = @product_id;
      `);

    if (productResult.recordset.length === 0) {
      throw new Error('Producto no encontrado');
    }

    const duplicateResult = await new sql.Request(transaction)
      .input('code', sql.NVarChar(120), resolvedCode)
      .input('product_id', sql.Int, resolvedProductId)
      .query(`
        SELECT TOP 1
          pcb.ID_PRODUCTO,
          p.nombre
        FROM dbo.PRODUCTO_CODIGO_BARRA pcb
        INNER JOIN dbo.producto p
          ON p.id_producto = pcb.ID_PRODUCTO
        WHERE pcb.CODIGO_BARRA = @code;
      `);

    const duplicate = duplicateResult.recordset[0];
    if (duplicate && Number(duplicate.ID_PRODUCTO) !== resolvedProductId) {
      throw new Error(`El codigo ${resolvedCode} ya pertenece a otro producto: ${duplicate.nombre || 'Producto sin nombre'}`);
    }

    if (duplicate) {
      await new sql.Request(transaction)
        .input('code', sql.NVarChar(120), resolvedCode)
        .input('product_id', sql.Int, resolvedProductId)
        .input('updated_by', sql.NVarChar(100), resolvedUser)
        .query(`
          UPDATE dbo.PRODUCTO_CODIGO_BARRA
          SET
            ACTIVO = 1,
            ACTUALIZADO_POR = @updated_by,
            ACTUALIZADO_EN = SYSDATETIME()
          WHERE ID_PRODUCTO = @product_id
            AND CODIGO_BARRA = @code;
        `);
    } else {
      await new sql.Request(transaction)
        .input('product_id', sql.Int, resolvedProductId)
        .input('code', sql.NVarChar(120), resolvedCode)
        .input('created_by', sql.NVarChar(100), resolvedUser)
        .query(`
          INSERT INTO dbo.PRODUCTO_CODIGO_BARRA (
            ID_PRODUCTO,
            CODIGO_BARRA,
            ES_PRINCIPAL,
            ACTIVO,
            CREADO_POR,
            CREADO_EN
          )
          VALUES (
            @product_id,
            @code,
            0,
            1,
            @created_by,
            SYSDATETIME()
          );
        `);
    }

    await insertAuditRecord(transaction, {
      tableName: 'dbo.PRODUCTO_CODIGO_BARRA',
      action: 'CODIGO_BARRA_AGREGADO',
      recordKey: `id_producto=${resolvedProductId}`,
      userId,
      user: resolvedUser,
      previousData: '',
      newData: `codigo=${resolvedCode}`,
    });

    await transaction.commit();
    return { productId: resolvedProductId, barcodes: await listProductBarcodes(resolvedProductId) };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

async function updateProductBarcodeStatus({ productId, barcodeId, active, userId = null, user = null } = {}) {
  const resolvedProductId = Number(productId || 0);
  const resolvedBarcodeId = Number(barcodeId || 0);
  const nextActive = Boolean(active);
  const resolvedUser = (String(user || 'Sistema').trim() || 'Sistema').slice(0, 100);

  if (!resolvedProductId || !resolvedBarcodeId) {
    throw new Error('Producto y codigo de barra requeridos');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId, user: resolvedUser });
    await ensureProductBarcodeObjects(transaction);

    const barcodeResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .input('barcode_id', sql.Int, resolvedBarcodeId)
      .query(`
        SELECT TOP 1 ID_CODIGO_BARRA, CODIGO_BARRA, ES_PRINCIPAL, ACTIVO
        FROM dbo.PRODUCTO_CODIGO_BARRA WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_PRODUCTO = @product_id
          AND ID_CODIGO_BARRA = @barcode_id;
      `);

    const barcode = barcodeResult.recordset[0];
    if (!barcode) {
      throw new Error('Codigo de barra no encontrado');
    }

    if (!nextActive && Boolean(barcode.ES_PRINCIPAL)) {
      throw new Error('No se puede desactivar el codigo principal. Marque otro codigo como principal primero.');
    }

    await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .input('barcode_id', sql.Int, resolvedBarcodeId)
      .input('active', sql.Bit, nextActive)
      .input('updated_by', sql.NVarChar(100), resolvedUser)
      .query(`
        UPDATE dbo.PRODUCTO_CODIGO_BARRA
        SET
          ACTIVO = @active,
          ACTUALIZADO_POR = @updated_by,
          ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_PRODUCTO = @product_id
          AND ID_CODIGO_BARRA = @barcode_id;
      `);

    await insertAuditRecord(transaction, {
      tableName: 'dbo.PRODUCTO_CODIGO_BARRA',
      action: nextActive ? 'CODIGO_BARRA_ACTIVADO' : 'CODIGO_BARRA_DESACTIVADO',
      recordKey: `id_producto=${resolvedProductId}; id_codigo_barra=${resolvedBarcodeId}`,
      userId,
      user: resolvedUser,
      previousData: `activo=${Boolean(barcode.ACTIVO)}`,
      newData: `codigo=${barcode.CODIGO_BARRA}; activo=${nextActive}`,
    });

    await transaction.commit();
    return { productId: resolvedProductId, barcodes: await listProductBarcodes(resolvedProductId) };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

async function setPrimaryProductBarcode({ productId, barcodeId, userId = null, user = null } = {}) {
  const resolvedProductId = Number(productId || 0);
  const resolvedBarcodeId = Number(barcodeId || 0);
  const resolvedUser = (String(user || 'Sistema').trim() || 'Sistema').slice(0, 100);

  if (!resolvedProductId || !resolvedBarcodeId) {
    throw new Error('Producto y codigo de barra requeridos');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId, user: resolvedUser });
    await ensureProductBarcodeObjects(transaction);

    const barcodeResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .input('barcode_id', sql.Int, resolvedBarcodeId)
      .query(`
        SELECT TOP 1
          p.codigo AS CODIGO_ANTERIOR,
          pcb.CODIGO_BARRA
        FROM dbo.PRODUCTO_CODIGO_BARRA pcb WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.producto p WITH (UPDLOCK, HOLDLOCK)
          ON p.id_producto = pcb.ID_PRODUCTO
        WHERE pcb.ID_PRODUCTO = @product_id
          AND pcb.ID_CODIGO_BARRA = @barcode_id;
      `);

    const barcode = barcodeResult.recordset[0];
    if (!barcode) {
      throw new Error('Codigo de barra no encontrado');
    }

    if (String(barcode.CODIGO_BARRA || '').length > 50) {
      throw new Error('Este codigo no puede marcarse como principal porque supera 50 caracteres');
    }

    await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .input('barcode_id', sql.Int, resolvedBarcodeId)
      .input('updated_by', sql.NVarChar(100), resolvedUser)
      .query(`
        UPDATE dbo.PRODUCTO_CODIGO_BARRA
        SET
          ES_PRINCIPAL = 0,
          ACTUALIZADO_POR = @updated_by,
          ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_PRODUCTO = @product_id;

        UPDATE dbo.PRODUCTO_CODIGO_BARRA
        SET
          ES_PRINCIPAL = 1,
          ACTIVO = 1,
          ACTUALIZADO_POR = @updated_by,
          ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_PRODUCTO = @product_id
          AND ID_CODIGO_BARRA = @barcode_id;
      `);

    await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .input('code', sql.VarChar(50), String(barcode.CODIGO_BARRA || '').slice(0, 50))
      .input('previous_code', sql.VarChar(50), String(barcode.CODIGO_ANTERIOR || '').slice(0, 50))
      .input('updated_by', sql.VarChar(100), resolvedUser)
      .query(`
        UPDATE dbo.producto
        SET
          codigo = @code,
          actualizado_por = @updated_by,
          actualizado_en = GETDATE()
        WHERE id_producto = @product_id;

        UPDATE dbo.inventario
        SET
          codigo = @code,
          actualizado_por = @updated_by,
          actualizado_en = GETDATE()
        WHERE id_inventario = @product_id
           OR id_pd = @product_id
           OR codigo = @previous_code;
      `);

    await insertAuditRecord(transaction, {
      tableName: 'dbo.PRODUCTO_CODIGO_BARRA',
      action: 'CODIGO_BARRA_PRINCIPAL',
      recordKey: `id_producto=${resolvedProductId}; id_codigo_barra=${resolvedBarcodeId}`,
      userId,
      user: resolvedUser,
      previousData: `codigo=${barcode.CODIGO_ANTERIOR || ''}`,
      newData: `codigo=${barcode.CODIGO_BARRA || ''}`,
    });

    await transaction.commit();
    return { productId: resolvedProductId, sku: barcode.CODIGO_BARRA || '', barcodes: await listProductBarcodes(resolvedProductId) };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CREA LA TABLA AUXILIAR dbo.PRODUCTO_PROXIMO_VENCER
// Y EL PROCEDIMIENTO ALMACENADO dbo.sp_recalcular_productos_proximos_vencer SI NO EXISTEN.
// LA TABLA RESPALDA LOS PRODUCTOS QUE ESTAN A 30 DIAS O MENOS DE SU FECHA DE VENCIMIENTO.
async function ensureExpiringProductsObjects() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.PRODUCTO_PROXIMO_VENCER', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.PRODUCTO_PROXIMO_VENCER (
        ID_ALERTA INT IDENTITY(1,1) PRIMARY KEY,
        ID_PRODUCTO INT NOT NULL,
        CODIGO VARCHAR(120) NOT NULL,
        NOMBRE_PRODUCTO VARCHAR(255) NOT NULL,
        CATEGORIA VARCHAR(160) NULL,
        FECHA_INGRESO VARCHAR(60) NULL,
        STOCK DECIMAL(18, 2) NOT NULL,
        NUM_LOTE INT NULL,
        FECHA_VENCIMIENTO DATE NOT NULL,
        DIAS_PARA_VENCER INT NOT NULL,
        FECHA_RECALCULO DATETIME NOT NULL DEFAULT GETDATE()
      );

      CREATE INDEX IX_PRODUCTO_PROXIMO_VENCER_PRODUCTO
        ON dbo.PRODUCTO_PROXIMO_VENCER (ID_PRODUCTO, FECHA_VENCIMIENTO);
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.PRODUCTO_PROXIMO_VENCER', 'FECHA_INGRESO') IS NULL
    BEGIN
      ALTER TABLE dbo.PRODUCTO_PROXIMO_VENCER
      ADD FECHA_INGRESO VARCHAR(60) NULL;
    END;

    IF COL_LENGTH('dbo.PRODUCTO_PROXIMO_VENCER', 'NUM_LOTE') IS NULL
    BEGIN
      ALTER TABLE dbo.PRODUCTO_PROXIMO_VENCER
      ADD NUM_LOTE VARCHAR(80) NULL;
    END;

    IF COL_LENGTH('dbo.PRODUCTO_PROXIMO_VENCER', 'NUM_LOTE') IS NOT NULL
    BEGIN
      ALTER TABLE dbo.PRODUCTO_PROXIMO_VENCER
      ALTER COLUMN NUM_LOTE VARCHAR(80) NULL;
    END;
  `);

  await pool.request().query(`
    CREATE OR ALTER PROCEDURE dbo.sp_recalcular_productos_proximos_vencer
    AS
    BEGIN
      SET NOCOUNT ON;

      TRUNCATE TABLE dbo.PRODUCTO_PROXIMO_VENCER;

      IF OBJECT_ID('dbo.PRODUCTO_LOTE', 'U') IS NULL
      BEGIN
        RETURN;
      END;

      INSERT INTO dbo.PRODUCTO_PROXIMO_VENCER (
        ID_PRODUCTO,
        CODIGO,
        NOMBRE_PRODUCTO,
        CATEGORIA,
        FECHA_INGRESO,
        STOCK,
        NUM_LOTE,
        FECHA_VENCIMIENTO,
        DIAS_PARA_VENCER,
        FECHA_RECALCULO
      )
      SELECT
        p.id_producto,
        p.codigo,
        p.nombre,
        i.categoria,
        CONVERT(VARCHAR(30), l.FECHA_INGRESO, 120),
        CAST(ISNULL(l.CANTIDAD_DISPONIBLE, 0) AS DECIMAL(18, 2)),
        l.NUM_LOTE,
        l.FECHA_VENCIMIENTO,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), l.FECHA_VENCIMIENTO),
        GETDATE()
      FROM dbo.producto p
      INNER JOIN dbo.inventario i
        ON i.codigo = p.codigo
      INNER JOIN dbo.PRODUCTO_LOTE l
        ON l.ID_PRODUCTO = p.id_producto
      WHERE p.activo = 1
        AND l.ESTADO = 'ACTIVO'
        AND ISNULL(l.CANTIDAD_DISPONIBLE, 0) > 0
        AND l.FECHA_VENCIMIENTO IS NOT NULL
        AND DATEDIFF(DAY, CAST(GETDATE() AS DATE), l.FECHA_VENCIMIENTO) BETWEEN 0 AND 30
      ORDER BY DATEDIFF(DAY, CAST(GETDATE() AS DATE), l.FECHA_VENCIMIENTO) ASC, p.nombre ASC;
    END
  `);
}

async function ensureFefoLotObjects(executor) {
  await new sql.Request(executor).query(`
    IF OBJECT_ID('dbo.PRODUCTO_LOTE', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.PRODUCTO_LOTE (
        ID_LOTE INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID_PRODUCTO INT NOT NULL,
        CODIGO_PRODUCTO VARCHAR(120) NOT NULL,
        NUM_LOTE VARCHAR(80) NOT NULL,
        FECHA_INGRESO DATE NOT NULL,
        FECHA_VENCIMIENTO DATE NULL,
        CANTIDAD_INICIAL DECIMAL(18, 3) NOT NULL,
        CANTIDAD_DISPONIBLE DECIMAL(18, 3) NOT NULL,
        COSTO_UNITARIO DECIMAL(18, 4) NOT NULL,
        ID_COMPRA INT NULL,
        TABLA_COMPRA VARCHAR(80) NULL,
        NUM_FACT VARCHAR(80) NULL,
        ESTADO VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
        ORIGEN VARCHAR(40) NOT NULL DEFAULT 'COMPRA',
        CREADO_POR VARCHAR(120) NULL,
        CREADO_EN DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        ACTUALIZADO_EN DATETIME2 NULL
      );
    END;

    IF OBJECT_ID('dbo.VENTA_LOTE_DETALLE', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.VENTA_LOTE_DETALLE (
        ID_VENTA_LOTE INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID_FACT INT NOT NULL,
        TABLA_VENTA VARCHAR(80) NOT NULL,
        ID_VENTA INT NOT NULL,
        ID_PRODUCTO INT NOT NULL,
        ID_LOTE INT NOT NULL,
        CANTIDAD DECIMAL(18, 3) NOT NULL,
        ACCION VARCHAR(20) NOT NULL DEFAULT 'VENTA',
        FECHA_HORA DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        USUARIO VARCHAR(120) NULL
      );
    END;
  `);
}

async function ensureOfferObjects(executor) {
  await new sql.Request(executor).query(`
    IF OBJECT_ID('dbo.CODIGO_ARMADO_OFERTA', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.CODIGO_ARMADO_OFERTA (
        ID_OFERTA INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CODIGO NVARCHAR(80) NOT NULL,
        NOMBRE NVARCHAR(180) NOT NULL,
        DESCRIPCION NVARCHAR(500) NULL,
        IMAGEN_URL NVARCHAR(500) NULL,
        PRECIO_OFERTA DECIMAL(18,2) NOT NULL,
        FECHA_INICIO DATETIME2(0) NOT NULL,
        FECHA_FIN DATETIME2(0) NOT NULL,
        ACTIVO BIT NOT NULL CONSTRAINT DF_CODIGO_ARMADO_OFERTA_ACTIVO DEFAULT (1),
        CREADO_POR INT NULL,
        CREADO_EN DATETIME2(0) NOT NULL CONSTRAINT DF_CODIGO_ARMADO_OFERTA_CREADO_EN DEFAULT (SYSDATETIME()),
        ACTUALIZADO_EN DATETIME2(0) NULL
      );

      CREATE UNIQUE INDEX UX_CODIGO_ARMADO_OFERTA_CODIGO
        ON dbo.CODIGO_ARMADO_OFERTA (CODIGO);
    END;

    IF OBJECT_ID('dbo.CODIGO_ARMADO_OFERTA', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.CODIGO_ARMADO_OFERTA', 'IMAGEN_URL') IS NULL
    BEGIN
      ALTER TABLE dbo.CODIGO_ARMADO_OFERTA
        ADD IMAGEN_URL NVARCHAR(500) NULL;
    END;

    IF OBJECT_ID('dbo.CODIGO_ARMADO_OFERTA_DETALLE', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.CODIGO_ARMADO_OFERTA_DETALLE (
        ID_DETALLE INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID_OFERTA INT NOT NULL,
        ID_PRODUCTO INT NOT NULL,
        CANTIDAD DECIMAL(18,3) NOT NULL,
        ES_REGALIA BIT NOT NULL CONSTRAINT DF_CODIGO_ARMADO_OFERTA_DETALLE_REGALIA DEFAULT (0),
        PRECIO_REFERENCIA DECIMAL(18,2) NOT NULL CONSTRAINT DF_CODIGO_ARMADO_OFERTA_DETALLE_PRECIO DEFAULT (0),
        CREADO_EN DATETIME2(0) NOT NULL CONSTRAINT DF_CODIGO_ARMADO_OFERTA_DETALLE_CREADO_EN DEFAULT (SYSDATETIME())
      );

      CREATE INDEX IX_CODIGO_ARMADO_OFERTA_DETALLE_OFERTA
        ON dbo.CODIGO_ARMADO_OFERTA_DETALLE (ID_OFERTA);
    END;

    IF OBJECT_ID('dbo.VENTA_OFERTA_DETALLE', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.VENTA_OFERTA_DETALLE (
        ID_VENTA_OFERTA INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID_FACT INT NOT NULL,
        TABLA_VENTA NVARCHAR(80) NOT NULL,
        ID_VENTA INT NULL,
        ID_OFERTA INT NOT NULL,
        CODIGO_OFERTA NVARCHAR(80) NOT NULL,
        NOMBRE_OFERTA NVARCHAR(180) NOT NULL,
        ID_PRODUCTO INT NOT NULL,
        CODIGO_PRODUCTO NVARCHAR(80) NOT NULL,
        NOMBRE_PRODUCTO NVARCHAR(180) NOT NULL,
        CANTIDAD DECIMAL(18,3) NOT NULL,
        ES_REGALIA BIT NOT NULL,
        PRECIO_UNITARIO DECIMAL(18,2) NOT NULL,
        PRECIO_OFERTA DECIMAL(18,2) NOT NULL,
        FECHA_HORA DATETIME2(0) NOT NULL CONSTRAINT DF_VENTA_OFERTA_DETALLE_FECHA DEFAULT (SYSDATETIME()),
        ID_USUARIO INT NULL
      );

      CREATE INDEX IX_VENTA_OFERTA_DETALLE_FACTURA
        ON dbo.VENTA_OFERTA_DETALLE (ID_FACT, ID_OFERTA);
    END;
  `);
}

function normalizeLotText(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeNullableDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

const LOT_QUANTITY_EPSILON = 0.0005;

function roundLotQuantity(value) {
  return Number(Number(value || 0).toFixed(3));
}

async function ensureProductLotCoverage(executor, productId, userName = 'Sistema') {
  const result = await new sql.Request(executor)
    .input('product_id', sql.Int, Number(productId))
    .query(`
      SELECT
        p.id_producto,
        p.codigo,
        ISNULL(i.stock, 0) AS stock,
        ISNULL(i.precio_costo, 0) AS precio_costo,
        ISNULL(SUM(CASE WHEN l.ESTADO = 'ACTIVO' THEN l.CANTIDAD_DISPONIBLE ELSE 0 END), 0) AS stock_lotes
      FROM dbo.producto p
      LEFT JOIN dbo.inventario i
        ON i.codigo = p.codigo
      LEFT JOIN dbo.PRODUCTO_LOTE l
        ON l.ID_PRODUCTO = p.id_producto
      WHERE p.id_producto = @product_id
      GROUP BY p.id_producto, p.codigo, i.stock, i.precio_costo
    `);

  const product = result.recordset[0];

  if (!product) {
    throw new Error('Producto no encontrado para validar lote');
  }

  const stock = Number(product.stock || 0);
  const lotStock = Number(product.stock_lotes || 0);
  const missingQuantity = roundLotQuantity(stock - lotStock);

  if (missingQuantity <= LOT_QUANTITY_EPSILON) {
    return;
  }

  await new sql.Request(executor)
    .input('product_id', sql.Int, Number(product.id_producto))
    .input('sku', sql.VarChar(120), String(product.codigo || product.id_producto))
    .input('lot_number', sql.VarChar(80), `AJUSTE-FEFO-${product.id_producto}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`)
    .input('quantity', sql.Decimal(18, 3), missingQuantity)
    .input('unit_cost', sql.Decimal(18, 4), Number(product.precio_costo || 0))
    .input('user_name', sql.VarChar(120), userName)
    .query(`
      INSERT INTO dbo.PRODUCTO_LOTE (
        ID_PRODUCTO,
        CODIGO_PRODUCTO,
        NUM_LOTE,
        FECHA_INGRESO,
        FECHA_VENCIMIENTO,
        CANTIDAD_INICIAL,
        CANTIDAD_DISPONIBLE,
        COSTO_UNITARIO,
        ID_COMPRA,
        TABLA_COMPRA,
        NUM_FACT,
        ESTADO,
        ORIGEN,
        CREADO_POR
      )
      VALUES (
        @product_id,
        @sku,
        @lot_number,
        CAST(GETDATE() AS DATE),
        NULL,
        @quantity,
        @quantity,
        @unit_cost,
        NULL,
        NULL,
        NULL,
        'ACTIVO',
        'AJUSTE_STOCK_EXISTENTE',
        @user_name
      );
    `);
}

async function insertPurchaseLot(executor, {
  productId,
  purchaseId,
  purchaseTable,
  invoiceNumber,
  purchaseTimestamp,
  quantity,
  unitCost,
  lotNumber,
  expiryDate,
  userName,
}) {
  const productResult = await new sql.Request(executor)
    .input('product_id', sql.Int, Number(productId))
    .query(`
      SELECT TOP 1 codigo
      FROM dbo.producto
      WHERE id_producto = @product_id
    `);
  const productSku = productResult.recordset[0]?.codigo || String(productId);
  const fallbackLot = `FACT-${String(invoiceNumber || purchaseId).trim()}-${productSku}`;

  await new sql.Request(executor)
    .input('product_id', sql.Int, Number(productId))
    .input('sku', sql.VarChar(120), productSku)
    .input('lot_number', sql.VarChar(80), normalizeLotText(lotNumber, fallbackLot).slice(0, 80))
    .input('entry_date', sql.Date, String(purchaseTimestamp || new Date().toISOString()).slice(0, 10))
    .input('expiry_date', sql.Date, normalizeNullableDate(expiryDate))
    .input('quantity', sql.Decimal(18, 3), roundLotQuantity(quantity))
    .input('unit_cost', sql.Decimal(18, 4), Number(unitCost))
    .input('purchase_id', sql.Int, Number(purchaseId) || null)
    .input('purchase_table', sql.VarChar(80), purchaseTable)
    .input('invoice_number', sql.VarChar(80), String(invoiceNumber || '').trim())
    .input('user_name', sql.VarChar(120), String(userName || 'Sistema').trim())
    .query(`
      INSERT INTO dbo.PRODUCTO_LOTE (
        ID_PRODUCTO,
        CODIGO_PRODUCTO,
        NUM_LOTE,
        FECHA_INGRESO,
        FECHA_VENCIMIENTO,
        CANTIDAD_INICIAL,
        CANTIDAD_DISPONIBLE,
        COSTO_UNITARIO,
        ID_COMPRA,
        TABLA_COMPRA,
        NUM_FACT,
        ESTADO,
        ORIGEN,
        CREADO_POR
      )
      VALUES (
        @product_id,
        @sku,
        @lot_number,
        @entry_date,
        @expiry_date,
        @quantity,
        @quantity,
        @unit_cost,
        @purchase_id,
        @purchase_table,
        @invoice_number,
        'ACTIVO',
        'COMPRA',
        @user_name
      );
    `);
}

async function allocateSaleLotsFefo(executor, {
  invoiceId,
  saleTable,
  saleId,
  productId,
  quantity,
  userName,
}) {
  const requestedQuantity = roundLotQuantity(quantity);

  if (requestedQuantity <= 0) {
    throw new Error('Cantidad invalida para descontar lote');
  }

  await ensureProductLotCoverage(executor, productId, userName);

  const lotsResult = await new sql.Request(executor)
    .input('product_id', sql.Int, Number(productId))
    .query(`
      SELECT
        ID_LOTE,
        CANTIDAD_DISPONIBLE
      FROM dbo.PRODUCTO_LOTE WITH (UPDLOCK, ROWLOCK)
      WHERE ID_PRODUCTO = @product_id
        AND ESTADO = 'ACTIVO'
        AND CANTIDAD_DISPONIBLE > 0
      ORDER BY
        CASE WHEN FECHA_VENCIMIENTO IS NULL THEN 1 ELSE 0 END,
        FECHA_VENCIMIENTO ASC,
        FECHA_INGRESO ASC,
        ID_LOTE ASC
    `);

  let remaining = requestedQuantity;

  for (const lot of lotsResult.recordset) {
    if (remaining <= LOT_QUANTITY_EPSILON) {
      break;
    }

    const available = Number(lot.CANTIDAD_DISPONIBLE || 0);
    const deducted = roundLotQuantity(Math.min(remaining, available));

    if (deducted <= 0) {
      continue;
    }

    await new sql.Request(executor)
      .input('lot_id', sql.Int, Number(lot.ID_LOTE))
      .input('quantity', sql.Decimal(18, 3), deducted)
      .query(`
        UPDATE dbo.PRODUCTO_LOTE
        SET
          CANTIDAD_DISPONIBLE = CANTIDAD_DISPONIBLE - @quantity,
          ESTADO = CASE WHEN CANTIDAD_DISPONIBLE - @quantity <= 0.0005 THEN 'AGOTADO' ELSE 'ACTIVO' END,
          ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_LOTE = @lot_id;
      `);

    await new sql.Request(executor)
      .input('invoice_id', sql.Int, Number(invoiceId))
      .input('sale_table', sql.VarChar(80), saleTable)
      .input('sale_id', sql.Int, Number(saleId))
      .input('product_id', sql.Int, Number(productId))
      .input('lot_id', sql.Int, Number(lot.ID_LOTE))
      .input('quantity', sql.Decimal(18, 3), deducted)
      .input('user_name', sql.VarChar(120), String(userName || 'Sistema').trim())
      .query(`
        INSERT INTO dbo.VENTA_LOTE_DETALLE (
          ID_FACT,
          TABLA_VENTA,
          ID_VENTA,
          ID_PRODUCTO,
          ID_LOTE,
          CANTIDAD,
          ACCION,
          USUARIO
        )
        VALUES (
          @invoice_id,
          @sale_table,
          @sale_id,
          @product_id,
          @lot_id,
          @quantity,
          'VENTA',
          @user_name
        );
      `);

    remaining = roundLotQuantity(remaining - deducted);
  }

  if (remaining > LOT_QUANTITY_EPSILON) {
    const productResult = await new sql.Request(executor)
      .input('product_id', sql.Int, Number(productId))
      .query(`
        SELECT TOP 1
          p.nombre,
          ISNULL(i.stock, 0) AS stock,
          ISNULL((
            SELECT SUM(CASE WHEN l.ESTADO = 'ACTIVO' THEN ISNULL(l.CANTIDAD_DISPONIBLE, 0) ELSE 0 END)
            FROM dbo.PRODUCTO_LOTE l
            WHERE l.ID_PRODUCTO = p.id_producto
          ), 0) AS stock_lotes
        FROM dbo.producto p
        LEFT JOIN dbo.inventario i
          ON i.codigo = p.codigo
        WHERE p.id_producto = @product_id;
      `);

    const product = productResult.recordset[0] || {};
    const productName = String(product.nombre || productId).trim();
    const lotAvailable = roundLotQuantity(product.stock_lotes || 0);
    const stockAvailable = roundLotQuantity(product.stock || 0);
    throw new Error(`No hay stock por lote suficiente para facturar ${productName}. Solicitado: ${requestedQuantity}. Disponible por lote: ${lotAvailable}. Stock general: ${stockAvailable}.`);
  }
}

async function deductInventoryLotsFefo(executor, {
  productId,
  quantity,
  userName,
}) {
  const requestedQuantity = roundLotQuantity(quantity);

  if (requestedQuantity <= 0) {
    throw new Error('Cantidad invalida para rebajar lote');
  }

  await ensureProductLotCoverage(executor, productId, userName);

  const lotsResult = await new sql.Request(executor)
    .input('product_id', sql.Int, Number(productId))
    .query(`
      SELECT
        ID_LOTE,
        CANTIDAD_DISPONIBLE
      FROM dbo.PRODUCTO_LOTE WITH (UPDLOCK, ROWLOCK)
      WHERE ID_PRODUCTO = @product_id
        AND ESTADO = 'ACTIVO'
        AND CANTIDAD_DISPONIBLE > 0
      ORDER BY
        CASE WHEN FECHA_VENCIMIENTO IS NULL THEN 1 ELSE 0 END,
        FECHA_VENCIMIENTO ASC,
        FECHA_INGRESO ASC,
        ID_LOTE ASC
    `);

  let remaining = requestedQuantity;

  for (const lot of lotsResult.recordset) {
    if (remaining <= LOT_QUANTITY_EPSILON) {
      break;
    }

    const available = Number(lot.CANTIDAD_DISPONIBLE || 0);
    const deducted = roundLotQuantity(Math.min(remaining, available));

    if (deducted <= 0) {
      continue;
    }

    await new sql.Request(executor)
      .input('lot_id', sql.Int, Number(lot.ID_LOTE))
      .input('quantity', sql.Decimal(18, 3), deducted)
      .query(`
        UPDATE dbo.PRODUCTO_LOTE
        SET
          CANTIDAD_DISPONIBLE = CANTIDAD_DISPONIBLE - @quantity,
          ESTADO = CASE WHEN CANTIDAD_DISPONIBLE - @quantity <= 0.0005 THEN 'AGOTADO' ELSE 'ACTIVO' END,
          ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_LOTE = @lot_id;
      `);

    remaining = roundLotQuantity(remaining - deducted);
  }

  if (remaining > LOT_QUANTITY_EPSILON) {
    throw new Error('No hay stock por lote suficiente para rebajar inventario');
  }
}

async function restoreInvoiceLotsForAnnulment(executor, invoiceId) {
  const detailsResult = await new sql.Request(executor)
    .input('invoice_id', sql.Int, Number(invoiceId))
    .query(`
      SELECT
        ID_LOTE,
        SUM(CANTIDAD) AS CANTIDAD
      FROM dbo.VENTA_LOTE_DETALLE WITH (UPDLOCK)
      WHERE ID_FACT = @invoice_id
        AND ACCION = 'VENTA'
      GROUP BY ID_LOTE
    `);

  for (const detail of detailsResult.recordset) {
    await new sql.Request(executor)
      .input('lot_id', sql.Int, Number(detail.ID_LOTE))
      .input('quantity', sql.Decimal(18, 3), roundLotQuantity(detail.CANTIDAD || 0))
      .query(`
        UPDATE dbo.PRODUCTO_LOTE
        SET
          CANTIDAD_DISPONIBLE = CANTIDAD_DISPONIBLE + @quantity,
          ESTADO = 'ACTIVO',
          ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_LOTE = @lot_id;
      `);
  }

  await new sql.Request(executor)
    .input('invoice_id', sql.Int, Number(invoiceId))
    .query(`
      UPDATE dbo.VENTA_LOTE_DETALLE
      SET ACCION = 'ANULADO'
      WHERE ID_FACT = @invoice_id
        AND ACCION = 'VENTA';
    `);

  return detailsResult.recordset.length;
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO EJECUTA EL PROCEDIMIENTO ALMACENADO dbo.sp_recalcular_productos_proximos_vencer.
// SE USA AL INICIAR SESION PARA MANTENER ACTUALIZADA LA TABLA dbo.PRODUCTO_PROXIMO_VENCER.
async function refreshExpiringProducts() {
  await ensureExpiringProductsObjects();
  const pool = await getPool();
  await pool.request().execute('dbo.sp_recalcular_productos_proximos_vencer');
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA dbo.PRODUCTO_PROXIMO_VENCER PARA MOSTRAR
// EL MODAL DE ALERTAS DE PRODUCTOS PROXIMOS A VENCER EN FACTURACION.
async function listExpiringProducts() {
  await ensureExpiringProductsObjects();
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      ID_ALERTA,
      ID_PRODUCTO,
      CODIGO,
      NOMBRE_PRODUCTO,
      CATEGORIA,
      FECHA_INGRESO,
      STOCK,
      NUM_LOTE,
      FECHA_VENCIMIENTO,
      DIAS_PARA_VENCER,
      FECHA_RECALCULO
    FROM dbo.PRODUCTO_PROXIMO_VENCER
    ORDER BY DIAS_PARA_VENCER ASC, NOMBRE_PRODUCTO ASC
  `);

  return result.recordset.map((row) => ({
    id: Number(row.ID_ALERTA),
    productId: Number(row.ID_PRODUCTO),
    sku: row.CODIGO || '',
    productName: row.NOMBRE_PRODUCTO || 'Producto sin nombre',
    category: row.CATEGORIA || 'Sin categoria',
    entryDate: row.FECHA_INGRESO || null,
    stock: Number(row.STOCK || 0),
    lotNumber: row.NUM_LOTE || null,
    expiryDate: row.FECHA_VENCIMIENTO ? new Date(row.FECHA_VENCIMIENTO).toISOString() : null,
    daysRemaining: Number(row.DIAS_PARA_VENCER || 0),
    refreshedAt: row.FECHA_RECALCULO ? new Date(row.FECHA_RECALCULO).toISOString() : null,
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO OBTIENE EL HISTORICO REAL DE COMPRAS DESDE dbo.COMPRA_EFECTIVO
// Y dbo.COMPRA_CREDITO. HACE JOIN CON proveedor, producto, usuario Y ESTADO.
async function listPurchases() {
  const pool = await getPool();
  const result = await pool.request().query(`
    WITH compras AS (
      SELECT
        ID_CEFECT AS ID_COMPRA,
        CASE WHEN ID_TP = 3 THEN 'Transferencia' ELSE 'Efectivo' END AS TIPO_COMPRA,
        ID_PD,
        CANT_PD,
        PRECIO_COSTO,
        ID_USUARIO,
        FECHA_HORA,
        ID_TP,
        ID_PROVEEDOR,
        ID_ESTADO_COMPRA,
        NUM_FACT
      FROM dbo.COMPRA_EFECTIVO

      UNION ALL

      SELECT
        ID_CCD AS ID_COMPRA,
        'Credito' AS TIPO_COMPRA,
        ID_PD,
        CANT_PD,
        PRECIO_COSTO,
        ID_USUARIO,
        FECHA_HORA,
        ID_TP,
        ID_PROVEEDOR,
        ID_ESTADO_COMPRA,
        NUM_FACT
      FROM dbo.COMPRA_CREDITO
    )
    SELECT
      c.ID_COMPRA,
      c.TIPO_COMPRA,
      c.ID_PD,
      p.nombre AS PRODUCTO,
      c.CANT_PD,
      c.PRECIO_COSTO,
      c.CANT_PD * c.PRECIO_COSTO AS TOTAL,
      c.ID_USUARIO,
      u.nombre AS USUARIO,
      c.FECHA_HORA,
      c.ID_TP,
      c.ID_PROVEEDOR,
      pr.NOMBRE AS PROVEEDOR,
      pr.TELEFONO AS TELEFONO_PROVEEDOR,
      pr.DIRECCION AS DIRECCION_PROVEEDOR,
      c.ID_ESTADO_COMPRA,
      e.ESTADO AS ESTADO_COMPRA,
      c.NUM_FACT
    FROM compras c
    LEFT JOIN dbo.producto p
      ON p.id_producto = c.ID_PD
    LEFT JOIN dbo.proveedor pr
      ON pr.ID_PROVEEDOR = c.ID_PROVEEDOR
    LEFT JOIN dbo.usuario u
      ON u.id_usuario = c.ID_USUARIO
    LEFT JOIN dbo.ESTADO e
      ON e.ID_ESTADO = c.ID_ESTADO_COMPRA
    ORDER BY c.FECHA_HORA DESC, c.ID_COMPRA DESC
  `);

  return result.recordset.map((purchase) => ({
    id: Number(purchase.ID_COMPRA),
    purchaseType: purchase.TIPO_COMPRA,
    productId: Number(purchase.ID_PD || 0),
    productName: purchase.PRODUCTO || 'Producto sin nombre',
    quantity: Number(purchase.CANT_PD || 0),
    unitCost: Number(purchase.PRECIO_COSTO || 0),
    total: Number(purchase.TOTAL || 0),
    userId: Number(purchase.ID_USUARIO || 0),
    userName: purchase.USUARIO || 'Usuario',
    createdAt: purchase.FECHA_HORA,
    paymentTypeId: Number(purchase.ID_TP || 0),
    supplierId: Number(purchase.ID_PROVEEDOR || 0),
    supplierName: purchase.PROVEEDOR || 'Sin proveedor',
    supplierPhone: purchase.TELEFONO_PROVEEDOR,
    supplierAddress: purchase.DIRECCION_PROVEEDOR,
    statusId: purchase.ID_ESTADO_COMPRA === null ? null : Number(purchase.ID_ESTADO_COMPRA),
    statusName: purchase.ESTADO_COMPRA || 'Sin estado',
    invoiceNumber: purchase.NUM_FACT || '',
  }));
}

async function annulPurchase({ purchaseType, invoiceNumber, userId }) {
  const resolvedType = String(purchaseType || '').trim().toLowerCase();
  const resolvedInvoiceNumber = String(invoiceNumber || '').trim();
  const resolvedUserId = Number(userId || 1);
  const purchaseTable = resolvedType.includes('credito') ? 'dbo.COMPRA_CREDITO' : 'dbo.COMPRA_EFECTIVO';

  if (!resolvedInvoiceNumber) {
    throw new Error('Numero de factura requerido para anular compra');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId: resolvedUserId });

    const linesResult = await new sql.Request(transaction)
      .input('invoice_number', sql.VarChar(80), resolvedInvoiceNumber)
      .query(`
        SELECT
          ${purchaseTable === 'dbo.COMPRA_CREDITO' ? 'ID_CCD' : 'ID_CEFECT'} AS ID_COMPRA,
          ID_PD,
          CANT_PD,
          PRECIO_COSTO,
          ID_TP,
          ID_ESTADO_COMPRA
        FROM ${purchaseTable}
        WHERE NUM_FACT = @invoice_number;
      `);

    const activeLines = linesResult.recordset.filter((line) => Number(line.ID_ESTADO_COMPRA || 0) !== 3);

    if (activeLines.length === 0) {
      throw new Error('La factura de compra ya esta anulada o no tiene lineas activas');
    }

    for (const line of activeLines) {
      const stockResult = await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.ID_PD))
        .input('quantity', sql.Decimal(18, 3), roundLotQuantity(line.CANT_PD || 0))
        .query(`
          UPDATE i
          SET
            i.stock = i.stock - @quantity,
            i.actualizado_en = SYSDATETIME()
          OUTPUT
            deleted.stock AS STOCK_ANT,
            inserted.stock AS STOCK_ACT,
            inserted.precio_costo AS PRECIO_COSTO
          FROM dbo.inventario i
          INNER JOIN dbo.producto p
            ON p.codigo = i.codigo
          WHERE p.id_producto = @product_id
            AND ISNULL(i.stock, 0) >= @quantity;
        `);

      const stockRow = stockResult.recordset[0];

      if (!stockRow) {
        throw new Error(`Stock insuficiente para anular compra del producto ${line.ID_PD}`);
      }

      await insertInventoryLogRecord(transaction, {
        action: 'ANULACION_COMPRA',
        productId: Number(line.ID_PD),
        quantity: Number(line.CANT_PD || 0),
        previousStock: Number(stockRow.STOCK_ANT || 0),
        newStock: Number(stockRow.STOCK_ACT || 0),
        unitCost: Number(line.PRECIO_COSTO || stockRow.PRECIO_COSTO || 0),
        userId: resolvedUserId,
        date: new Date().toISOString(),
        customerId: null,
        paymentTypeId: Number(line.ID_TP || 0),
      });
    }

    await new sql.Request(transaction)
      .input('invoice_number', sql.VarChar(80), resolvedInvoiceNumber)
      .input('annulled_status_id', sql.Int, 3)
      .query(`
        UPDATE ${purchaseTable}
        SET ID_ESTADO_COMPRA = @annulled_status_id
        WHERE NUM_FACT = @invoice_number;
      `);

    await insertAuditRecord(transaction, {
      tableName: purchaseTable,
      action: 'ANULAR_COMPRA',
      recordKey: `NUM_FACT=${resolvedInvoiceNumber}`,
      userId: resolvedUserId,
      previousData: `estado=activo; lineas=${activeLines.length}`,
      newData: `estado=anulado; unidades_descontadas=${activeLines.reduce((total, line) => total + Number(line.CANT_PD || 0), 0)}`,
    });

    await transaction.commit();

    return {
      invoiceNumber: resolvedInvoiceNumber,
      purchaseTable,
      annulledLines: activeLines.length,
      discountedQuantity: activeLines.reduce((total, line) => total + Number(line.CANT_PD || 0), 0),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function ensureOperationalCostsTable(request) {
  await request.query(`
    IF OBJECT_ID('dbo.COSTO_OPERATIVO', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.COSTO_OPERATIVO (
        ID_COSTO_OPERATIVO INT IDENTITY(1,1) PRIMARY KEY,
        FECHA DATE NOT NULL,
        TIPO VARCHAR(80) NOT NULL,
        DESCRIPCION VARCHAR(250) NULL,
        MONTO DECIMAL(18,2) NOT NULL,
        ID_USUARIO INT NULL,
        ID_FACT INT NULL,
        NUM_FACT VARCHAR(80) NULL,
        ID_COMPRA INT NULL,
        TIPO_COMPRA VARCHAR(20) NULL,
        APLICA_A VARCHAR(40) NOT NULL CONSTRAINT DF_COSTO_OPERATIVO_APLICA_A DEFAULT ('MES'),
        REFERENCIA VARCHAR(120) NULL,
        FECHA_HORA DATETIME2 NOT NULL CONSTRAINT DF_COSTO_OPERATIVO_FECHA_HORA DEFAULT (SYSDATETIME())
      );
    END;

    IF COL_LENGTH('dbo.COSTO_OPERATIVO', 'ID_FACT') IS NULL
      ALTER TABLE dbo.COSTO_OPERATIVO ADD ID_FACT INT NULL;

    IF COL_LENGTH('dbo.COSTO_OPERATIVO', 'NUM_FACT') IS NULL
      ALTER TABLE dbo.COSTO_OPERATIVO ADD NUM_FACT VARCHAR(80) NULL;

    IF COL_LENGTH('dbo.COSTO_OPERATIVO', 'ID_COMPRA') IS NULL
      ALTER TABLE dbo.COSTO_OPERATIVO ADD ID_COMPRA INT NULL;

    IF COL_LENGTH('dbo.COSTO_OPERATIVO', 'TIPO_COMPRA') IS NULL
      ALTER TABLE dbo.COSTO_OPERATIVO ADD TIPO_COMPRA VARCHAR(20) NULL;
  `);
}

async function listOperationalCosts({ year, month } = {}) {
  const resolvedYear = Number(year || new Date().getFullYear());
  const resolvedMonth = Number(month || new Date().getMonth() + 1);

  if (!Number.isInteger(resolvedYear) || resolvedYear < 2000 || resolvedYear > 2100) {
    throw new Error('Ano invalido para consultar costos operativos');
  }

  if (!Number.isInteger(resolvedMonth) || resolvedMonth < 1 || resolvedMonth > 12) {
    throw new Error('Mes invalido para consultar costos operativos');
  }

  const pool = await getPool();
  const request = pool.request();
  await ensureOperationalCostsTable(request);

  const result = await pool.request()
    .input('year', sql.Int, resolvedYear)
    .input('month', sql.Int, resolvedMonth)
    .query(`
      SELECT
        co.ID_COSTO_OPERATIVO,
        co.FECHA,
        co.TIPO,
        co.DESCRIPCION,
        co.MONTO,
        co.ID_USUARIO,
        u.nombre AS USUARIO,
        co.ID_FACT,
        co.NUM_FACT,
        co.ID_COMPRA,
        co.TIPO_COMPRA,
        co.APLICA_A,
        co.REFERENCIA,
        co.FECHA_HORA
      FROM dbo.COSTO_OPERATIVO co
      LEFT JOIN dbo.usuario u
        ON u.id_usuario = co.ID_USUARIO
      WHERE YEAR(co.FECHA) = @year
        AND MONTH(co.FECHA) = @month
      ORDER BY co.FECHA DESC, co.ID_COSTO_OPERATIVO DESC
    `);

  const rows = result.recordset.map((row) => ({
    id: Number(row.ID_COSTO_OPERATIVO || 0),
    date: row.FECHA ? new Date(row.FECHA).toISOString().slice(0, 10) : null,
    type: row.TIPO || 'Otro',
    description: row.DESCRIPCION || '',
    amount: Number(row.MONTO || 0),
    userId: row.ID_USUARIO === null ? null : Number(row.ID_USUARIO),
    userName: row.USUARIO || 'Sistema',
    invoiceId: row.ID_FACT === null ? null : Number(row.ID_FACT),
    invoiceNumber: row.NUM_FACT || '',
    purchaseId: row.ID_COMPRA === null ? null : Number(row.ID_COMPRA),
    purchaseType: row.TIPO_COMPRA || '',
    appliesTo: row.APLICA_A || 'MES',
    reference: row.REFERENCIA || '',
    createdAt: row.FECHA_HORA ? new Date(row.FECHA_HORA).toISOString() : null,
  }));

  return {
    year: resolvedYear,
    month: resolvedMonth,
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    rows,
  };
}

async function createOperationalCost({
  date,
  type,
  description,
  amount,
  userId,
  invoiceId,
  invoiceNumber,
  purchaseId,
  purchaseType,
  appliesTo,
  reference,
}) {
  const resolvedDate = String(date || '').trim();
  const resolvedType = String(type || '').trim();
  const resolvedAmount = Number(amount || 0);
  const resolvedUserId = Number(userId || 0);
  const resolvedPurchaseId = Number(purchaseId || invoiceId || 0);
  const resolvedPurchaseType = String(purchaseType || '').trim();
  const resolvedInvoiceNumber = String(invoiceNumber || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
    throw new Error('Fecha requerida para registrar costo operativo');
  }

  if (!resolvedType) {
    throw new Error('Tipo de costo requerido');
  }

  if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
    throw new Error('Monto de costo operativo invalido');
  }

  if (!Number.isInteger(resolvedPurchaseId) || resolvedPurchaseId <= 0 || !resolvedPurchaseType || !resolvedInvoiceNumber) {
    throw new Error('Selecciona una factura de compra para registrar el costo operativo');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId: resolvedUserId || null });
    await ensureOperationalCostsTable(new sql.Request(transaction));

    const purchaseTable = resolvePurchaseTable(resolvedPurchaseType.toLowerCase() === 'credito' ? 2 : 1);
    const purchaseIdColumn = resolvedPurchaseType.toLowerCase() === 'credito' ? 'ID_CCD' : 'ID_CEFECT';
    const purchaseResult = await new sql.Request(transaction)
      .input('purchase_id', sql.Int, resolvedPurchaseId)
      .input('invoice_number', sql.VarChar(80), resolvedInvoiceNumber)
      .query(`
        SELECT TOP 1 ${purchaseIdColumn} AS ID_COMPRA, NUM_FACT
        FROM ${purchaseTable}
        WHERE ${purchaseIdColumn} = @purchase_id
          AND NUM_FACT = @invoice_number
      `);

    if (purchaseResult.recordset.length === 0) {
      throw new Error('La factura de compra seleccionada no existe');
    }

    const result = await new sql.Request(transaction)
      .input('date', sql.Date, resolvedDate)
      .input('type', sql.VarChar(80), resolvedType)
      .input('description', sql.VarChar(250), String(description || '').trim() || null)
      .input('amount', sql.Decimal(18, 2), resolvedAmount)
      .input('user_id', sql.Int, resolvedUserId || null)
      .input('invoice_id', sql.Int, null)
      .input('invoice_number', sql.VarChar(80), resolvedInvoiceNumber)
      .input('purchase_id', sql.Int, resolvedPurchaseId)
      .input('purchase_type', sql.VarChar(20), resolvedPurchaseType)
      .input('applies_to', sql.VarChar(40), String(appliesTo || 'MES').trim() || 'MES')
      .input('reference', sql.VarChar(120), String(reference || '').trim() || null)
      .query(`
        INSERT INTO dbo.COSTO_OPERATIVO (
          FECHA,
          TIPO,
          DESCRIPCION,
          MONTO,
          ID_USUARIO,
          ID_FACT,
          NUM_FACT,
          ID_COMPRA,
          TIPO_COMPRA,
          APLICA_A,
          REFERENCIA
        )
        VALUES (
          @date,
          @type,
          @description,
          @amount,
          @user_id,
          @invoice_id,
          @invoice_number,
          @purchase_id,
          @purchase_type,
          @applies_to,
          @reference
        );

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS inserted_cost_id;
      `);
    const insertedCostId = Number(result.recordset[0]?.inserted_cost_id || 0);

    await insertAuditRecord(transaction, {
      tableName: 'dbo.COSTO_OPERATIVO',
      action: 'COSTO_OPERATIVO',
      recordKey: `ID_COSTO_OPERATIVO=${insertedCostId}`,
      userId: resolvedUserId || null,
      previousData: '',
      newData: `tipo=${resolvedType}; monto=${resolvedAmount}; factura=${resolvedInvoiceNumber}; compra=${resolvedPurchaseType} ${resolvedPurchaseId}`,
    });

    await transaction.commit();

    return {
      id: insertedCostId,
      date: resolvedDate,
      type: resolvedType,
      amount: resolvedAmount,
      invoiceId: null,
      invoiceNumber: resolvedInvoiceNumber,
      purchaseId: resolvedPurchaseId,
      purchaseType: resolvedPurchaseType,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function ensureFinancialMovementsTable(executor) {
  await new sql.Request(executor).query(`
    IF OBJECT_ID('dbo.MOVIMIENTO_FINANCIERO', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.MOVIMIENTO_FINANCIERO (
        ID_MOVIMIENTO_FINANCIERO INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        FECHA DATETIME2 NOT NULL,
        TIPO_MOVIMIENTO VARCHAR(20) NOT NULL,
        METODO_PAGO VARCHAR(40) NOT NULL,
        APLICA_A VARCHAR(40) NOT NULL,
        CATEGORIA NVARCHAR(120) NULL,
        DESCRIPCION NVARCHAR(500) NULL,
        MONTO DECIMAL(18,2) NOT NULL,
        CUENTA_BANCARIA NVARCHAR(160) NULL,
        TARJETA_CREDITO NVARCHAR(160) NULL,
        ID_CORTE INT NULL,
        ID_CAJA_CHICA INT NULL,
        ESTADO VARCHAR(20) NOT NULL DEFAULT 'activo',
        ID_USUARIO INT NULL,
        FECHA_REGISTRO DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        FECHA_ANULACION DATETIME2 NULL,
        ID_USUARIO_ANULA INT NULL
      );
    END;

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
  `);
}

function normalizeFinancialMovementValue(value, allowedValues, fallback) {
  const normalizedValue = String(value || fallback || '').trim().toLowerCase();
  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
}

function mapFinancialMovement(row) {
  return {
    id: Number(row.ID_MOVIMIENTO_FINANCIERO || 0),
    date: formatSqlLocalDateTime(row.FECHA),
    movementType: row.TIPO_MOVIMIENTO || 'salida',
    paymentMethod: row.METODO_PAGO || 'efectivo',
    target: row.APLICA_A || 'caja_chica',
    category: row.CATEGORIA || '',
    description: row.DESCRIPCION || '',
    amount: Number(row.MONTO || 0),
    bankAccount: row.CUENTA_BANCARIA || '',
    creditCard: row.TARJETA_CREDITO || '',
    cutId: row.ID_CORTE === null || row.ID_CORTE === undefined ? null : Number(row.ID_CORTE),
    pettyCashId: row.ID_CAJA_CHICA === null || row.ID_CAJA_CHICA === undefined ? null : Number(row.ID_CAJA_CHICA),
    status: row.ESTADO || 'activo',
    userId: row.ID_USUARIO === null || row.ID_USUARIO === undefined ? null : Number(row.ID_USUARIO),
    userName: row.USUARIO || 'Sistema',
    createdAt: row.FECHA_REGISTRO,
    annulledAt: row.FECHA_ANULACION,
    annulledByUserId: row.ID_USUARIO_ANULA === null || row.ID_USUARIO_ANULA === undefined ? null : Number(row.ID_USUARIO_ANULA),
  };
}

function formatSqlLocalDateTime(value) {
  if (!value) {
    return buildCurrentCutTimestamp().replace(' ', 'T');
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-') + `T${[
      String(value.getHours()).padStart(2, '0'),
      String(value.getMinutes()).padStart(2, '0'),
      String(value.getSeconds()).padStart(2, '0'),
    ].join(':')}`;
  }

  const text = String(value).trim().replace(' ', 'T');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);

  if (match) {
    return `${match[1]}T${match[2]}:${match[3] || '00'}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? buildCurrentCutTimestamp().replace(' ', 'T') : formatSqlLocalDateTime(parsed);
}

function normalizeFinancialMovementDateTime(value) {
  const fallback = buildCurrentCutTimestamp();

  if (!value) {
    return fallback;
  }

  const text = String(value).trim();
  const dateTimeMatch = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);

  if (dateTimeMatch) {
    return `${dateTimeMatch[1]} ${dateTimeMatch[2]}:${dateTimeMatch[3]}:${dateTimeMatch[4] || '00'}`;
  }

  const dateMatch = text.match(/^(\d{4}-\d{2}-\d{2})$/);

  if (dateMatch) {
    return buildCutTimestampForDate(dateMatch[1]);
  }

  return formatSqlDateTime(text, fallback);
}

async function listFinancialMovements({ year, month } = {}) {
  const now = new Date();
  const resolvedYear = Number(year || now.getFullYear());
  const resolvedMonth = Number(month || now.getMonth() + 1);

  if (!Number.isInteger(resolvedYear) || resolvedYear < 2000 || resolvedYear > 2100) {
    throw new Error('Ano invalido para consultar movimientos financieros');
  }

  if (!Number.isInteger(resolvedMonth) || resolvedMonth < 1 || resolvedMonth > 12) {
    throw new Error('Mes invalido para consultar movimientos financieros');
  }

  const pool = await getPool();
  await ensureFinancialMovementsTable(pool);

  const result = await pool.request()
    .input('year', sql.Int, resolvedYear)
    .input('month', sql.Int, resolvedMonth)
    .query(`
      SELECT
        mf.*,
        u.nombre AS USUARIO
      FROM dbo.MOVIMIENTO_FINANCIERO mf
      LEFT JOIN dbo.usuario u
        ON u.id_usuario = mf.ID_USUARIO
      WHERE YEAR(mf.FECHA) = @year
        AND MONTH(mf.FECHA) = @month
      ORDER BY mf.FECHA DESC, mf.ID_MOVIMIENTO_FINANCIERO DESC;
    `);

  return {
    year: resolvedYear,
    month: resolvedMonth,
    movements: result.recordset.map(mapFinancialMovement),
  };
}

async function createFinancialMovement(payload = {}) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await ensureFinancialMovementsTable(transaction);

    const movementType = normalizeFinancialMovementValue(payload.movementType, ['entrada', 'salida'], 'salida');
    const paymentMethod = normalizeFinancialMovementValue(payload.paymentMethod, ['efectivo', 'transferencia', 'tarjeta_credito'], 'efectivo');
    const target = normalizeFinancialMovementValue(payload.target, ['corte_dia', 'caja_chica', 'cuenta_bancaria', 'tarjeta_credito'], 'caja_chica');
    const amount = Number(payload.amount || 0);
    const userId = payload.userId ? Number(payload.userId) : null;
    const date = normalizeFinancialMovementDateTime(payload.date);
    const category = truncateText(payload.category || 'Operacion', 120);
    const description = truncateText(payload.description || '', 500);
    const bankAccount = truncateText(payload.bankAccount || '', 160);
    const creditCard = truncateText(payload.creditCard || '', 160);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Monto invalido para el movimiento financiero');
    }

    if (movementType === 'salida' && !description) {
      throw new Error('La descripcion es requerida para registrar una salida');
    }

    if (paymentMethod === 'tarjeta_credito' && movementType !== 'salida') {
      throw new Error('Por ahora la tarjeta de credito solo se registra en salidas');
    }

    if (userId) {
      await setAuditContext(transaction, { userId });
    }

    const result = await new sql.Request(transaction)
      .input('fecha', sql.VarChar(19), date)
      .input('tipo_movimiento', sql.VarChar(20), movementType)
      .input('metodo_pago', sql.VarChar(40), paymentMethod)
      .input('aplica_a', sql.VarChar(40), target)
      .input('categoria', sql.NVarChar(120), category)
      .input('descripcion', sql.NVarChar(500), description)
      .input('monto', sql.Decimal(18, 2), amount)
      .input('cuenta_bancaria', sql.NVarChar(160), bankAccount)
      .input('tarjeta_credito', sql.NVarChar(160), creditCard)
      .input('id_corte', sql.Int, payload.cutId ? Number(payload.cutId) : null)
      .input('id_caja_chica', sql.Int, payload.pettyCashId ? Number(payload.pettyCashId) : null)
      .input('user_id', sql.Int, userId)
      .query(`
        INSERT INTO dbo.MOVIMIENTO_FINANCIERO (
          FECHA,
          TIPO_MOVIMIENTO,
          METODO_PAGO,
          APLICA_A,
          CATEGORIA,
          DESCRIPCION,
          MONTO,
          CUENTA_BANCARIA,
          TARJETA_CREDITO,
          ID_CORTE,
          ID_CAJA_CHICA,
          ID_USUARIO
        )
        VALUES (
          TRY_CONVERT(datetime2, @fecha),
          @tipo_movimiento,
          @metodo_pago,
          @aplica_a,
          @categoria,
          @descripcion,
          @monto,
          NULLIF(@cuenta_bancaria, ''),
          NULLIF(@tarjeta_credito, ''),
          @id_corte,
          @id_caja_chica,
          @user_id
        );

        SELECT
          mf.*,
          u.nombre AS USUARIO
        FROM dbo.MOVIMIENTO_FINANCIERO mf
        LEFT JOIN dbo.usuario u
          ON u.id_usuario = mf.ID_USUARIO
        WHERE mf.ID_MOVIMIENTO_FINANCIERO = CAST(SCOPE_IDENTITY() AS INT);
      `);

    const movement = mapFinancialMovement(result.recordset[0]);

    await insertAuditRecord(transaction, {
      tableName: 'dbo.MOVIMIENTO_FINANCIERO',
      action: 'MOVIMIENTO_FINANCIERO',
      recordKey: `ID_MOVIMIENTO_FINANCIERO=${movement.id}`,
      userId,
      newData: `tipo=${movementType}; metodo=${paymentMethod}; aplica=${target}; monto=${amount}; categoria=${category}`,
    });

    await transaction.commit();
    return movement;
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA LOS CREDITOS DESDE dbo.VENTA_CREDITO.
// HACE JOIN CON dbo.cliente Y dbo.producto PARA MOSTRAR NOMBRE DEL CLIENTE
// Y NOMBRE DEL PRODUCTO EN LA PAGINA DE CREDITOS.
// TAMBIEN HACE JOIN CON dbo.ESTADO PARA MOSTRAR EL NOMBRE DEL ESTADO
// SIN EXPONER SOLO EL ID_ESTADO_VENTA EN LA TABLA MASTER.
// INCLUYE ID_FACT PARA AGRUPAR LA TABLA MASTER POR NUMERO DE FACTURA.
async function listCredits() {
  const pool = await getPool();
  await ensureCreditPaymentAllocationsTable(pool.request());
  await ensureCreditPaymentMethodColumn(pool.request());
  await pool.request().query(`
    WITH saldos AS (
      SELECT
        vc.ID_CLIENTE,
        vc.ID_FACT,
        CASE
          WHEN ISNULL(vc.ID_ESTADO_VENTA, 0) = 3 THEN 0
          WHEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(SUM(cad.MONTO), 0) > 0
          THEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(SUM(cad.MONTO), 0)
          ELSE 0
        END AS SALDO
      FROM dbo.VENTA_CREDITO vc
      LEFT JOIN dbo.CREDITO_ABONO_DETALLE cad
        ON cad.ID_VENTA = vc.ID_VENTA
      GROUP BY vc.ID_VENTA, vc.ID_CLIENTE, vc.ID_FACT, vc.PRECIO_VENTA, vc.CANT_PD, vc.ID_ESTADO_VENTA
    ),
    saldos_cliente AS (
      SELECT
        ID_CLIENTE,
        SUM(SALDO) AS SALDO_CREDITO,
        COUNT(DISTINCT CASE WHEN SALDO > 0.005 THEN ID_FACT END) AS CREDITOS_ABIERTOS
      FROM saldos
      GROUP BY ID_CLIENTE
    )
    UPDATE c
    SET
      saldo = ISNULL(sc.SALDO_CREDITO, 0),
      CREDITOS_ABIERTOS = ISNULL(sc.CREDITOS_ABIERTOS, 0)
    FROM dbo.cliente c
    LEFT JOIN saldos_cliente sc
      ON sc.ID_CLIENTE = c.ID_CLIENTE;
  `);
  const result = await pool.request().query(`
    WITH abonos_linea AS (
      SELECT
        ID_VENTA,
        SUM(MONTO) AS MONTO_ABONADO
      FROM dbo.CREDITO_ABONO_DETALLE
      GROUP BY ID_VENTA
    ),
    saldos_linea AS (
      SELECT
        vc.ID_VENTA,
        vc.ID_FACT,
        vc.ID_CLIENTE,
        CASE
          WHEN ISNULL(vc.ID_ESTADO_VENTA, 0) = 3 THEN 0
          WHEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0) > 0
          THEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0)
          ELSE 0
        END AS SALDO
      FROM dbo.VENTA_CREDITO vc
      LEFT JOIN abonos_linea al
        ON al.ID_VENTA = vc.ID_VENTA
    ),
    saldos_cliente AS (
      SELECT
        ID_CLIENTE,
        SUM(SALDO) AS SALDO_CREDITO,
        COUNT(DISTINCT CASE WHEN SALDO > 0.005 THEN ID_FACT END) AS CREDITOS_ABIERTOS
      FROM saldos_linea
      GROUP BY ID_CLIENTE
    ),
    abonos_factura AS (
      SELECT
        ID_FACTURA,
        CASE
          WHEN COUNT(*) = 0 THEN 'Sin abono'
          WHEN COUNT(DISTINCT LOWER(ISNULL(FORMA_ABONO, 'efectivo'))) > 1 THEN 'Mixto'
          WHEN MAX(LOWER(ISNULL(FORMA_ABONO, 'efectivo'))) = 'transferencia' THEN 'Transferencia'
          ELSE 'Efectivo'
        END AS FORMA_ABONO_FACTURA
      FROM dbo.PAGOS_CREDITO
      WHERE ISNULL(MONTO, 0) > 0
      GROUP BY ID_FACTURA
    )
    SELECT
      vc.ID_VENTA,
      vc.ID_FACT,
      vc.ID_PD,
      p.nombre AS PRODUCTO,
      vc.CANT_PD,
      vc.PRECIO_COSTO,
      vc.PRECIO_VENTA,
      vc.UTILIDAD,
      vc.USUARIO,
      vc.ID_CLIENTE,
      c.NOMBRE,
      c.APELLIDO,
      c.TELEFONO,
      ISNULL(sc.CREDITOS_ABIERTOS, c.CREDITOS_ABIERTOS) AS CREDITOS_ABIERTOS,
      ISNULL(sc.SALDO_CREDITO, c.saldo) AS saldo,
      vc.ID_TP,
      vc.FECHA_HORA,
      vc.ID_ESTADO_VENTA,
      e.ESTADO AS ESTADO_VENTA,
      ISNULL(af.FORMA_ABONO_FACTURA, 'Sin abono') AS FORMA_ABONO_FACTURA,
      ISNULL(al.MONTO_ABONADO, 0) AS MONTO_ABONADO,
      ISNULL(sl.SALDO, 0) AS SALDO_LINEA
    FROM dbo.VENTA_CREDITO vc
    LEFT JOIN dbo.cliente c
      ON c.ID_CLIENTE = vc.ID_CLIENTE
    LEFT JOIN abonos_linea al
      ON al.ID_VENTA = vc.ID_VENTA
    LEFT JOIN saldos_cliente sc
      ON sc.ID_CLIENTE = vc.ID_CLIENTE
    LEFT JOIN saldos_linea sl
      ON sl.ID_VENTA = vc.ID_VENTA
    LEFT JOIN abonos_factura af
      ON af.ID_FACTURA = vc.ID_FACT
    LEFT JOIN dbo.producto p
      ON p.id_producto = vc.ID_PD
    INNER JOIN dbo.ESTADO e
      ON e.ID_ESTADO = vc.ID_ESTADO_VENTA
    ORDER BY vc.FECHA_HORA ASC, vc.ID_FACT ASC, vc.ID_VENTA ASC
  `);

  return result.recordset.map((credit) => ({
    id: Number(credit.ID_VENTA),
    invoiceId: credit.ID_FACT === null ? Number(credit.ID_VENTA) : Number(credit.ID_FACT),
    productId: Number(credit.ID_PD),
    productName: credit.PRODUCTO || 'Producto sin nombre',
    quantity: Number(credit.CANT_PD || 0),
    unitCost: Number(credit.PRECIO_COSTO || 0),
    salePrice: Number(credit.PRECIO_VENTA || 0),
    utility: Number(credit.UTILIDAD || 0),
    user: credit.USUARIO,
    customerId: Number(credit.ID_CLIENTE),
    customerName: `${credit.NOMBRE || ''} ${credit.APELLIDO || ''}`.trim() || 'Cliente sin nombre',
    customerPhone: credit.TELEFONO,
    openCredits: Number(credit.CREDITOS_ABIERTOS || 0),
    customerBalance: Number(credit.saldo || 0),
    paymentTypeId: Number(credit.ID_TP || 0),
    createdAt: credit.FECHA_HORA,
    saleStatusId: credit.ID_ESTADO_VENTA === null ? null : Number(credit.ID_ESTADO_VENTA),
    saleStatusName: credit.ESTADO_VENTA || 'Sin estado',
    invoicePaymentMethod: credit.FORMA_ABONO_FACTURA || 'Sin abono',
    total: Number(credit.PRECIO_VENTA || 0) * Number(credit.CANT_PD || 0),
    paidAmount: Number(credit.MONTO_ABONADO || 0),
    pendingAmount: Number(credit.SALDO_LINEA || 0),
  }));
}

async function ensureCreditPaymentAllocationsTable(request) {
  await request.query(`
    IF OBJECT_ID('dbo.CREDITO_ABONO_DETALLE', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.CREDITO_ABONO_DETALLE (
        ID_ABONO_DETALLE INT IDENTITY(1,1) PRIMARY KEY,
        ID_PAGO_CREDITO INT NULL,
        ID_VENTA INT NOT NULL,
        ID_FACT INT NOT NULL,
        ID_CLIENTE INT NOT NULL,
        MONTO DECIMAL(18,2) NOT NULL,
        ID_USUARIO INT NOT NULL,
        DESCRIPCION VARCHAR(250) NULL,
        FECHA_HORA VARCHAR(40) NOT NULL
      );

      CREATE INDEX IX_CREDITO_ABONO_DETALLE_VENTA
        ON dbo.CREDITO_ABONO_DETALLE (ID_VENTA);

      CREATE INDEX IX_CREDITO_ABONO_DETALLE_CLIENTE
        ON dbo.CREDITO_ABONO_DETALLE (ID_CLIENTE, ID_FACT);
    END;
  `);
}

async function ensureCreditPaymentMethodColumn(request) {
  await request.query(`
    IF COL_LENGTH('dbo.PAGOS_CREDITO', 'FORMA_ABONO') IS NULL
    BEGIN
      ALTER TABLE dbo.PAGOS_CREDITO
      ADD FORMA_ABONO VARCHAR(30) NOT NULL
        DEFAULT ('efectivo');
    END;
  `);
}

function normalizeCreditPaymentMethod(paymentMethod) {
  return String(paymentMethod || '').toLowerCase().trim() === 'efectivo' ? 'efectivo' : 'transferencia';
}

async function recalculateCustomerCreditBalance(executor, customerId) {
  const resolvedCustomerId = Number(customerId || 0);

  if (!resolvedCustomerId || resolvedCustomerId <= 0) {
    return;
  }

  await new sql.Request(executor)
    .input('customer_id', sql.Int, resolvedCustomerId)
    .query(`
      WITH saldos AS (
        SELECT
          vc.ID_FACT,
          CASE
            WHEN ISNULL(vc.ID_ESTADO_VENTA, 0) = 3 THEN 0
            WHEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(SUM(cad.MONTO), 0) > 0
            THEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(SUM(cad.MONTO), 0)
            ELSE 0
          END AS SALDO
        FROM dbo.VENTA_CREDITO vc
        LEFT JOIN dbo.CREDITO_ABONO_DETALLE cad
          ON cad.ID_VENTA = vc.ID_VENTA
        WHERE vc.ID_CLIENTE = @customer_id
        GROUP BY vc.ID_VENTA, vc.ID_FACT, vc.PRECIO_VENTA, vc.CANT_PD, vc.ID_ESTADO_VENTA
      )
      UPDATE c
      SET
        saldo = ISNULL((SELECT SUM(SALDO) FROM saldos), 0),
        CREDITOS_ABIERTOS = ISNULL((SELECT COUNT(DISTINCT ID_FACT) FROM saldos WHERE SALDO > 0.005), 0)
      FROM dbo.cliente c
      WHERE c.ID_CLIENTE = @customer_id;
    `);
}

async function registerCreditPayment({ customerId, amount, userId, description, paymentMethod }) {
  const resolvedCustomerId = Number(customerId || 0);
  const resolvedAmount = Number(amount || 0);
  const resolvedUserId = Number(userId || 0);
  const resolvedPaymentMethod = normalizeCreditPaymentMethod(paymentMethod);

  if (!resolvedCustomerId || resolvedCustomerId <= 0) {
    throw new Error('Cliente requerido para registrar abono');
  }

  if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
    throw new Error('Monto de abono invalido');
  }

  if (!resolvedUserId || resolvedUserId <= 0) {
    throw new Error('Usuario requerido para registrar abono');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId: resolvedUserId });
    await ensureCreditPaymentAllocationsTable(new sql.Request(transaction));
    await ensureCreditPaymentMethodColumn(new sql.Request(transaction));

    const creditRows = await new sql.Request(transaction)
      .input('customer_id', sql.Int, resolvedCustomerId)
      .query(`
        WITH abonos_linea AS (
          SELECT ID_VENTA, SUM(MONTO) AS MONTO_ABONADO
          FROM dbo.CREDITO_ABONO_DETALLE
          GROUP BY ID_VENTA
        )
        SELECT
          vc.ID_VENTA,
          vc.ID_FACT,
          vc.ID_CLIENTE,
          vc.FECHA_HORA,
          CAST(vc.PRECIO_VENTA * vc.CANT_PD AS DECIMAL(18,2)) AS TOTAL_LINEA,
          CAST(ISNULL(al.MONTO_ABONADO, 0) AS DECIMAL(18,2)) AS MONTO_ABONADO,
          CAST((vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0) AS DECIMAL(18,2)) AS SALDO_LINEA
        FROM dbo.VENTA_CREDITO vc
        LEFT JOIN abonos_linea al
          ON al.ID_VENTA = vc.ID_VENTA
        WHERE vc.ID_CLIENTE = @customer_id
          AND (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0) > 0.005
        ORDER BY TRY_CONVERT(datetime2, vc.FECHA_HORA) ASC, vc.ID_FACT ASC, vc.ID_VENTA ASC
      `);

    const totalPending = creditRows.recordset.reduce((total, row) => total + Number(row.SALDO_LINEA || 0), 0);

    if (totalPending <= 0) {
      throw new Error('El cliente no tiene saldo pendiente');
    }

    if (resolvedAmount - totalPending > 0.01) {
      throw new Error('El abono excede el saldo pendiente del cliente');
    }

    const paymentTimestamp = new Date().toISOString();
    const resolvedDescription = String(description || 'Abono automatico a credito').trim();
    let remaining = resolvedAmount;
    const allocations = [];

    for (const row of creditRows.recordset) {
      if (remaining <= 0.005) {
        break;
      }

      const pendingLineAmount = Number(row.SALDO_LINEA || 0);
      const appliedAmount = Number(Math.min(remaining, pendingLineAmount).toFixed(2));

      if (appliedAmount <= 0) {
        continue;
      }

      allocations.push({
        saleId: Number(row.ID_VENTA),
        invoiceId: Number(row.ID_FACT || row.ID_VENTA),
        customerId: Number(row.ID_CLIENTE),
        amount: appliedAmount,
      });
      remaining = Number((remaining - appliedAmount).toFixed(2));
    }

    const allocationsByInvoice = new Map();

    for (const allocation of allocations) {
      const current = allocationsByInvoice.get(allocation.invoiceId) || 0;
      allocationsByInvoice.set(allocation.invoiceId, Number((current + allocation.amount).toFixed(2)));
    }

    const paymentIdsByInvoice = new Map();

    for (const [invoiceId, invoiceAmount] of allocationsByInvoice.entries()) {
      const paymentResult = await new sql.Request(transaction)
        .input('description', sql.VarChar(250), resolvedDescription)
        .input('amount', sql.Decimal(18, 2), invoiceAmount)
        .input('customer_id', sql.Int, resolvedCustomerId)
        .input('invoice_id', sql.Int, Number(invoiceId))
        .input('user_id', sql.Int, resolvedUserId)
        .input('payment_method', sql.VarChar(30), resolvedPaymentMethod)
        .input('created_at', sql.VarChar(40), paymentTimestamp)
        .query(`
          INSERT INTO dbo.PAGOS_CREDITO (
            DESCRIPCION_PAGO,
            MONTO,
            ID_CLIENTE,
            ID_FACTURA,
            ID_USUARIO,
            FORMA_ABONO,
            FECHA_HORA
          )
          VALUES (
            @description,
            @amount,
            @customer_id,
            @invoice_id,
            @user_id,
            @payment_method,
            @created_at
          );

          SELECT CAST(SCOPE_IDENTITY() AS INT) AS payment_id;
        `);

      paymentIdsByInvoice.set(Number(invoiceId), Number(paymentResult.recordset[0]?.payment_id || 0));
    }

    for (const allocation of allocations) {
      await new sql.Request(transaction)
        .input('payment_id', sql.Int, paymentIdsByInvoice.get(allocation.invoiceId) || null)
        .input('sale_id', sql.Int, allocation.saleId)
        .input('invoice_id', sql.Int, allocation.invoiceId)
        .input('customer_id', sql.Int, allocation.customerId)
        .input('amount', sql.Decimal(18, 2), allocation.amount)
        .input('user_id', sql.Int, resolvedUserId)
        .input('description', sql.VarChar(250), resolvedDescription)
        .input('created_at', sql.VarChar(40), paymentTimestamp)
        .query(`
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
          VALUES (
            @payment_id,
            @sale_id,
            @invoice_id,
            @customer_id,
            @amount,
            @user_id,
            @description,
            @created_at
          );
        `);
    }

    await new sql.Request(transaction)
      .input('customer_id', sql.Int, resolvedCustomerId)
      .query(`
        WITH saldos AS (
          SELECT
            vc.ID_VENTA,
            CASE
              WHEN ISNULL(vc.ID_ESTADO_VENTA, 0) = 3 THEN 0
              ELSE (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(SUM(cad.MONTO), 0)
            END AS SALDO
          FROM dbo.VENTA_CREDITO vc
          LEFT JOIN dbo.CREDITO_ABONO_DETALLE cad
            ON cad.ID_VENTA = vc.ID_VENTA
          WHERE vc.ID_CLIENTE = @customer_id
          GROUP BY vc.ID_VENTA, vc.PRECIO_VENTA, vc.CANT_PD, vc.ID_ESTADO_VENTA
        )
        UPDATE vc
        SET ID_ESTADO_VENTA = CASE WHEN saldos.SALDO <= 0.005 THEN 4 ELSE 2 END
        FROM dbo.VENTA_CREDITO vc
        INNER JOIN saldos
          ON saldos.ID_VENTA = vc.ID_VENTA
        WHERE ISNULL(vc.ID_ESTADO_VENTA, 0) <> 3;
      `);

    await recalculateCustomerCreditBalance(transaction, resolvedCustomerId);

    await transaction.commit();

    return {
      customerId: resolvedCustomerId,
      amount: Number(resolvedAmount.toFixed(2)),
      paymentMethod: resolvedPaymentMethod,
      appliedAmount: Number((resolvedAmount - Math.max(remaining, 0)).toFixed(2)),
      remainingAmount: Math.max(remaining, 0),
      invoicesTouched: allocationsByInvoice.size,
      linesTouched: allocations.length,
      paymentsCreated: paymentIdsByInvoice.size,
      createdAt: paymentTimestamp,
      allocations,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO DEVUELVE LA TABLA CORRECTA DONDE SE INSERTA LA VENTA
// SEGUN EL ID_TP RECIBIDO DESDE src/app/app.ts, PROCEDIMIENTO persistSale().
// ID_TP 1 INSERTA EN dbo.VENTA_EFECTIVO.
// ID_TP 2 INSERTA EN dbo.VENTA_CREDITO.
// ID_TP 3 INSERTA EN dbo.VENTA_TRANSFERENCIA.
function resolveSalePaymentTable(paymentTypeId) {
  const paymentTables = {
    1: 'dbo.VENTA_EFECTIVO',
    2: 'dbo.VENTA_CREDITO',
    3: 'dbo.VENTA_TRANSFERENCIA',
  };

  return paymentTables[Number(paymentTypeId)] || null;
}

function resolvePurchaseTable(paymentTypeId) {
  const purchaseTables = {
    1: 'dbo.COMPRA_EFECTIVO',
    2: 'dbo.COMPRA_CREDITO',
    3: 'dbo.COMPRA_EFECTIVO',
  };

  return purchaseTables[Number(paymentTypeId)] || null;
}

function resolveSalePaymentTableAlias(paymentTypeId) {
  const paymentTables = {
    1: { table: 'dbo.VENTA_EFECTIVO', alias: 'Efectivo', idColumn: 'ID_VENTA' },
    2: { table: 'dbo.VENTA_CREDITO', alias: 'Credito', idColumn: 'ID_VENTA' },
    3: { table: 'dbo.VENTA_TRANSFERENCIA', alias: 'Transferencia', idColumn: 'ID_VTR' },
  };

  return paymentTables[Number(paymentTypeId)] || null;
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO DEVUELVE EL ID_ESTADO_VENTA QUE SE GUARDA CON LA VENTA.
// SI ID_TP ES 1 O 3 (EFECTIVO O TRANSFERENCIA), RETORNA 4 PORQUE LA VENTA QUEDA FINALIZADA.
// SI ID_TP ES 2 (CREDITO), RETORNA 2 PORQUE QUEDA ACTIVA/PENDIENTE.
function resolveSaleStatusId(paymentTypeId) {
  return Number(paymentTypeId) === 2 ? 2 : 4;
}

function offerVirtualProductId(offerId) {
  return -Number(offerId);
}

function realOfferIdFromProductId(productId) {
  const id = Number(productId || 0);
  return id < 0 ? Math.abs(id) : 0;
}

function offerStatusFromDates(startDate, endDate, active = true) {
  if (!active) {
    return 'INACTIVO';
  }

  const now = new Date();
  const startsAt = new Date(startDate);
  const endsAt = new Date(endDate);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return 'INACTIVO';
  }

  if (now < startsAt) {
    return 'PROGRAMADO';
  }

  if (now > endsAt) {
    return 'VENCIDO';
  }

  return 'ACTIVO';
}

function calculateOfferAvailableStock(components) {
  if (!Array.isArray(components) || components.length === 0) {
    return 0;
  }

  return Math.max(0, Math.floor(Math.min(
    ...components.map((component) => {
      const quantity = Number(component.quantity || 0);
      return quantity > 0 ? Number(component.stock || 0) / quantity : 0;
    }),
  )));
}

function offerVisibilityReason(offer) {
  if (!offer.active) {
    return 'Oferta desactivada';
  }

  if (offer.status === 'PROGRAMADO') {
    return 'Pendiente de inicio';
  }

  if (offer.status === 'VENCIDO') {
    return 'Vencida';
  }

  if (offer.components.some((component) => !component.productActive)) {
    return 'Producto componente inactivo';
  }

  if (Number(offer.stock || 0) <= 0) {
    return 'Sin stock';
  }

  return 'Disponible para facturar';
}

async function listAssembledOfferCodes({ includeInactive = true, resolveProductImageUrl } = {}) {
  const pool = await getPool();
  await ensureOfferObjects(pool);

  const result = await pool.request()
    .input('include_inactive', sql.Bit, includeInactive ? 1 : 0)
    .query(`
      SELECT
        o.ID_OFERTA,
        o.CODIGO,
        o.NOMBRE,
        o.DESCRIPCION,
        o.IMAGEN_URL,
        o.PRECIO_OFERTA,
        o.FECHA_INICIO,
        o.FECHA_FIN,
        o.ACTIVO,
        o.CREADO_EN,
        d.ID_DETALLE,
        d.ID_PRODUCTO,
        d.CANTIDAD,
        d.ES_REGALIA,
        d.PRECIO_REFERENCIA,
        p.codigo AS CODIGO_PRODUCTO,
        p.nombre AS NOMBRE_PRODUCTO,
        p.activo AS PRODUCTO_ACTIVO,
        ISNULL(i.stock, 0) AS STOCK_PRODUCTO,
        ISNULL(i.precio_costo, 0) AS PRECIO_COSTO,
        ISNULL(i.precio_venta, 0) AS PRECIO_VENTA
      FROM dbo.CODIGO_ARMADO_OFERTA o
      INNER JOIN dbo.CODIGO_ARMADO_OFERTA_DETALLE d
        ON d.ID_OFERTA = o.ID_OFERTA
      INNER JOIN dbo.producto p
        ON p.id_producto = d.ID_PRODUCTO
      INNER JOIN dbo.inventario i
        ON i.codigo = p.codigo
      WHERE @include_inactive = 1
        OR (o.ACTIVO = 1 AND SYSDATETIME() BETWEEN o.FECHA_INICIO AND o.FECHA_FIN)
      ORDER BY o.CREADO_EN DESC, o.ID_OFERTA DESC, d.ID_DETALLE ASC;
    `);

  const offers = new Map();

  for (const row of result.recordset) {
    const offerId = Number(row.ID_OFERTA);
    const offer = offers.get(offerId) || {
      id: offerId,
      virtualProductId: offerVirtualProductId(offerId),
      sku: row.CODIGO,
      name: row.NOMBRE,
      description: row.DESCRIPCION || '',
      imageUrl: resolveProductImageUrl
        ? resolveProductImageUrl(row.IMAGEN_URL)
        : row.IMAGEN_URL || null,
      salePrice: Number(row.PRECIO_OFERTA || 0),
      startsAt: row.FECHA_INICIO,
      endsAt: row.FECHA_FIN,
      active: Boolean(row.ACTIVO),
      status: offerStatusFromDates(row.FECHA_INICIO, row.FECHA_FIN, Boolean(row.ACTIVO)),
      createdAt: row.CREADO_EN,
      components: [],
    };

    offer.components.push({
      detailId: Number(row.ID_DETALLE),
      productId: Number(row.ID_PRODUCTO),
      sku: row.CODIGO_PRODUCTO,
      name: row.NOMBRE_PRODUCTO,
      quantity: Number(row.CANTIDAD || 0),
      isGift: Boolean(row.ES_REGALIA),
      referencePrice: Number(row.PRECIO_REFERENCIA || 0),
      productActive: Boolean(row.PRODUCTO_ACTIVO),
      stock: Number(row.STOCK_PRODUCTO || 0),
      unitCost: Number(row.PRECIO_COSTO || 0),
      salePrice: Number(row.PRECIO_VENTA || 0),
    });

    offers.set(offerId, offer);
  }

  return [...offers.values()].map((offer) => {
    const stock = calculateOfferAvailableStock(offer.components);
    const nextOffer = {
      ...offer,
      stock,
      status: offer.status === 'ACTIVO' && stock <= 0 ? 'SIN STOCK' : offer.status,
    };

    return {
      ...nextOffer,
      visibilityReason: offerVisibilityReason(nextOffer),
    };
  });
}

async function createAssembledOfferCode(payload = {}) {
  const code = String(payload.code || '').trim();
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  const imageUrl = normalizeProductImageUrlForStorage(payload.imageUrl);
  const salePrice = Number(payload.salePrice || 0);
  const startsAt = new Date(payload.startsAt || '');
  const endsAt = new Date(payload.endsAt || '');
  const userId = payload.userId ? Number(payload.userId) : null;
  const user = payload.user || null;
  const components = Array.isArray(payload.components) ? payload.components : [];

  if (!code) {
    throw new Error('Codigo especial requerido');
  }

  if (!name) {
    throw new Error('Nombre de oferta requerido');
  }

  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error('Precio especial final requerido');
  }

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    throw new Error('Rango de vigencia invalido');
  }

  if (components.length < 2) {
    throw new Error('Un codigo armado requiere 2 o mas productos');
  }

  const normalizedComponents = components.map((component) => ({
    productId: Number(component.productId || 0),
    quantity: roundLotQuantity(component.quantity || 0),
    isGift: Boolean(component.isGift),
  }));

  if (normalizedComponents.some((component) => component.productId <= 0 || component.quantity <= 0)) {
    throw new Error('Componentes de oferta invalidos');
  }

  if (new Set(normalizedComponents.map((component) => component.productId)).size < normalizedComponents.length) {
    throw new Error('No duplique productos dentro de la misma oferta');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId, user });
    await ensureOfferObjects(transaction);
    await ensureProductBarcodeObjects(transaction);

    const duplicateResult = await new sql.Request(transaction)
      .input('code', sql.NVarChar(80), code)
      .query(`
        SELECT
          CASE
            WHEN EXISTS (SELECT 1 FROM dbo.CODIGO_ARMADO_OFERTA WHERE CODIGO = @code) THEN 1
            WHEN EXISTS (SELECT 1 FROM dbo.producto WHERE codigo = @code) THEN 1
            WHEN EXISTS (SELECT 1 FROM dbo.PRODUCTO_CODIGO_BARRA WHERE CODIGO_BARRA = @code) THEN 1
            ELSE 0
          END AS exists_code;
      `);

    if (Number(duplicateResult.recordset[0]?.exists_code || 0) > 0) {
      throw new Error('El codigo especial ya existe');
    }

    const request = new sql.Request(transaction);
    const componentParams = normalizedComponents.map((component, index) => {
      const inputName = `product_id_${index}`;
      request.input(inputName, sql.Int, component.productId);
      return `@${inputName}`;
    });

    const productsResult = await request.query(`
      SELECT
        p.id_producto,
        p.codigo,
        p.nombre,
        p.activo,
        ISNULL(i.precio_venta, 0) AS precio_venta
      FROM dbo.producto p
      INNER JOIN dbo.inventario i
        ON i.codigo = p.codigo
      WHERE p.id_producto IN (${componentParams.join(', ')});
    `);

    if (productsResult.recordset.length !== normalizedComponents.length) {
      throw new Error('Todos los componentes deben existir en inventario');
    }

    if (productsResult.recordset.some((row) => !row.activo)) {
      throw new Error('Todos los componentes deben estar activos');
    }

    const offerResult = await new sql.Request(transaction)
      .input('code', sql.NVarChar(80), code)
      .input('name', sql.NVarChar(180), name)
      .input('description', sql.NVarChar(500), description || null)
      .input('image_url', sql.NVarChar(500), imageUrl || null)
      .input('sale_price', sql.Decimal(18, 2), Number(salePrice.toFixed(2)))
      .input('starts_at', sql.DateTime2, startsAt)
      .input('ends_at', sql.DateTime2, endsAt)
      .input('user_id', sql.Int, userId)
      .query(`
        INSERT INTO dbo.CODIGO_ARMADO_OFERTA (
          CODIGO, NOMBRE, DESCRIPCION, IMAGEN_URL, PRECIO_OFERTA, FECHA_INICIO, FECHA_FIN, CREADO_POR
        )
        VALUES (
          @code, @name, @description, @image_url, @sale_price, @starts_at, @ends_at, @user_id
        );

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS ID_OFERTA;
      `);

    const offerId = Number(offerResult.recordset[0]?.ID_OFERTA || 0);

    for (const component of normalizedComponents) {
      const product = productsResult.recordset.find((row) => Number(row.id_producto) === component.productId);
      await new sql.Request(transaction)
        .input('offer_id', sql.Int, offerId)
        .input('product_id', sql.Int, component.productId)
        .input('quantity', sql.Decimal(18, 3), component.quantity)
        .input('is_gift', sql.Bit, component.isGift ? 1 : 0)
        .input('reference_price', sql.Decimal(18, 2), Number(product?.precio_venta || 0))
        .query(`
          INSERT INTO dbo.CODIGO_ARMADO_OFERTA_DETALLE (
            ID_OFERTA, ID_PRODUCTO, CANTIDAD, ES_REGALIA, PRECIO_REFERENCIA
          )
          VALUES (
            @offer_id, @product_id, @quantity, @is_gift, @reference_price
          );
        `);
    }

    await insertAuditRecord(transaction, {
      tableName: 'dbo.CODIGO_ARMADO_OFERTA',
      action: 'CREAR_OFERTA',
      recordKey: `ID_OFERTA=${offerId}`,
      userId,
      user,
      previousData: '',
      newData: `codigo=${code}; productos=${normalizedComponents.length}; imagen=${imageUrl || ''}; precio=${salePrice}; inicio=${startsAt.toISOString()}; fin=${endsAt.toISOString()}`,
    });

    await transaction.commit();

    const offers = await listAssembledOfferCodes({ includeInactive: true });
    return offers.find((offer) => offer.id === offerId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateAssembledOfferCode(payload = {}) {
  const offerId = Number(payload.offerId || payload.id || 0);
  const name = String(payload.name || '').trim();
  const description = String(payload.description || '').trim();
  const imageUrl = normalizeProductImageUrlForStorage(payload.imageUrl);
  const salePrice = Number(payload.salePrice || 0);
  const startsAt = new Date(payload.startsAt || '');
  const endsAt = new Date(payload.endsAt || '');
  const active = payload.active === undefined ? true : Boolean(payload.active);
  const userId = payload.userId ? Number(payload.userId) : null;
  const user = payload.user || null;
  const components = Array.isArray(payload.components) ? payload.components : [];

  if (!offerId || offerId <= 0) {
    throw new Error('Codigo armado requerido');
  }

  if (!name) {
    throw new Error('Nombre de oferta requerido');
  }

  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error('Precio especial final requerido');
  }

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    throw new Error('Rango de vigencia invalido');
  }

  if (components.length < 2) {
    throw new Error('Un codigo armado requiere 2 o mas productos');
  }

  const normalizedComponents = components.map((component) => ({
    productId: Number(component.productId || 0),
    quantity: roundLotQuantity(component.quantity || 0),
    isGift: Boolean(component.isGift),
  }));

  if (normalizedComponents.some((component) => component.productId <= 0 || component.quantity <= 0)) {
    throw new Error('Componentes de oferta invalidos');
  }

  if (new Set(normalizedComponents.map((component) => component.productId)).size < normalizedComponents.length) {
    throw new Error('No duplique productos dentro de la misma oferta');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId, user });
    await ensureOfferObjects(transaction);

    const existingResult = await new sql.Request(transaction)
      .input('offer_id', sql.Int, offerId)
      .query(`
        SELECT TOP 1 CODIGO, NOMBRE, DESCRIPCION, IMAGEN_URL, PRECIO_OFERTA, FECHA_INICIO, FECHA_FIN, ACTIVO
        FROM dbo.CODIGO_ARMADO_OFERTA WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_OFERTA = @offer_id;
      `);

    const existing = existingResult.recordset[0];

    if (!existing) {
      throw new Error('Codigo armado no encontrado');
    }

    const request = new sql.Request(transaction);
    const componentParams = normalizedComponents.map((component, index) => {
      const inputName = `product_id_${index}`;
      request.input(inputName, sql.Int, component.productId);
      return `@${inputName}`;
    });

    const productsResult = await request.query(`
      SELECT
        p.id_producto,
        p.codigo,
        p.nombre,
        p.activo,
        ISNULL(i.precio_venta, 0) AS precio_venta
      FROM dbo.producto p
      INNER JOIN dbo.inventario i
        ON i.codigo = p.codigo
      WHERE p.id_producto IN (${componentParams.join(', ')});
    `);

    if (productsResult.recordset.length !== normalizedComponents.length) {
      throw new Error('Todos los componentes deben existir en inventario');
    }

    if (productsResult.recordset.some((row) => !row.activo)) {
      throw new Error('Todos los componentes deben estar activos');
    }

    await new sql.Request(transaction)
      .input('offer_id', sql.Int, offerId)
      .input('name', sql.NVarChar(180), name)
      .input('description', sql.NVarChar(500), description || null)
      .input('image_url', sql.NVarChar(500), imageUrl || null)
      .input('sale_price', sql.Decimal(18, 2), Number(salePrice.toFixed(2)))
      .input('starts_at', sql.DateTime2, startsAt)
      .input('ends_at', sql.DateTime2, endsAt)
      .input('active', sql.Bit, active ? 1 : 0)
      .query(`
        UPDATE dbo.CODIGO_ARMADO_OFERTA
        SET NOMBRE = @name,
            DESCRIPCION = @description,
            IMAGEN_URL = @image_url,
            PRECIO_OFERTA = @sale_price,
            FECHA_INICIO = @starts_at,
            FECHA_FIN = @ends_at,
            ACTIVO = @active,
            ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_OFERTA = @offer_id;

        DELETE FROM dbo.CODIGO_ARMADO_OFERTA_DETALLE
        WHERE ID_OFERTA = @offer_id;
      `);

    for (const component of normalizedComponents) {
      const product = productsResult.recordset.find((row) => Number(row.id_producto) === component.productId);
      await new sql.Request(transaction)
        .input('offer_id', sql.Int, offerId)
        .input('product_id', sql.Int, component.productId)
        .input('quantity', sql.Decimal(18, 3), component.quantity)
        .input('is_gift', sql.Bit, component.isGift ? 1 : 0)
        .input('reference_price', sql.Decimal(18, 2), Number(product?.precio_venta || 0))
        .query(`
          INSERT INTO dbo.CODIGO_ARMADO_OFERTA_DETALLE (
            ID_OFERTA, ID_PRODUCTO, CANTIDAD, ES_REGALIA, PRECIO_REFERENCIA
          )
          VALUES (
            @offer_id, @product_id, @quantity, @is_gift, @reference_price
          );
        `);
    }

    await insertAuditRecord(transaction, {
      tableName: 'dbo.CODIGO_ARMADO_OFERTA',
      action: 'EDITAR_OFERTA',
      recordKey: `ID_OFERTA=${offerId}`,
      userId,
      user,
      previousData: `nombre=${existing.NOMBRE}; imagen=${existing.IMAGEN_URL || ''}; precio=${existing.PRECIO_OFERTA}; activo=${existing.ACTIVO}`,
      newData: `nombre=${name}; productos=${normalizedComponents.length}; imagen=${imageUrl || ''}; precio=${salePrice}; activo=${active ? 1 : 0}; inicio=${startsAt.toISOString()}; fin=${endsAt.toISOString()}`,
    });

    await transaction.commit();

    const offers = await listAssembledOfferCodes({ includeInactive: true });
    return offers.find((offer) => offer.id === offerId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getActiveOfferForSale(executor, offerId) {
  await ensureOfferObjects(executor);

  const result = await new sql.Request(executor)
    .input('offer_id', sql.Int, Number(offerId))
    .query(`
      SELECT
        o.ID_OFERTA,
        o.CODIGO,
        o.NOMBRE,
        o.DESCRIPCION,
        o.PRECIO_OFERTA,
        o.FECHA_INICIO,
        o.FECHA_FIN,
        o.ACTIVO,
        d.ID_PRODUCTO,
        d.CANTIDAD,
        d.ES_REGALIA,
        d.PRECIO_REFERENCIA,
        p.codigo AS CODIGO_PRODUCTO,
        p.nombre AS NOMBRE_PRODUCTO,
        p.activo AS PRODUCTO_ACTIVO,
        ISNULL(i.stock, 0) AS STOCK_PRODUCTO,
        ISNULL(i.precio_costo, 0) AS PRECIO_COSTO,
        ISNULL(i.precio_venta, 0) AS PRECIO_VENTA
      FROM dbo.CODIGO_ARMADO_OFERTA o WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN dbo.CODIGO_ARMADO_OFERTA_DETALLE d
        ON d.ID_OFERTA = o.ID_OFERTA
      INNER JOIN dbo.producto p
        ON p.id_producto = d.ID_PRODUCTO
      INNER JOIN dbo.inventario i WITH (UPDLOCK, ROWLOCK)
        ON i.codigo = p.codigo
      WHERE o.ID_OFERTA = @offer_id;
    `);

  if (result.recordset.length === 0) {
    throw new Error('Oferta no encontrada');
  }

  const first = result.recordset[0];
  const status = offerStatusFromDates(first.FECHA_INICIO, first.FECHA_FIN, Boolean(first.ACTIVO));

  if (status !== 'ACTIVO') {
    throw new Error(`La oferta ${first.CODIGO} no esta activa. Estado actual: ${status}.`);
  }

  const components = result.recordset.map((row) => ({
    productId: Number(row.ID_PRODUCTO),
    sku: row.CODIGO_PRODUCTO,
    name: row.NOMBRE_PRODUCTO,
    quantity: Number(row.CANTIDAD || 0),
    isGift: Boolean(row.ES_REGALIA),
    referencePrice: Number(row.PRECIO_REFERENCIA || row.PRECIO_VENTA || 0),
    productActive: Boolean(row.PRODUCTO_ACTIVO),
    stock: Number(row.STOCK_PRODUCTO || 0),
    unitCost: Number(row.PRECIO_COSTO || 0),
    salePrice: Number(row.PRECIO_VENTA || 0),
  }));

  if (components.some((component) => !component.productActive)) {
    throw new Error(`La oferta ${first.CODIGO} contiene productos inactivos.`);
  }

  return {
    id: Number(first.ID_OFERTA),
    sku: first.CODIGO,
    name: first.NOMBRE,
    description: first.DESCRIPCION || '',
    salePrice: Number(first.PRECIO_OFERTA || 0),
    components,
  };
}

function allocateOfferComponentPrices(offer, offerQuantity) {
  const paidComponents = offer.components.filter((component) => !component.isGift);
  const referenceTotal = paidComponents.reduce(
    (total, component) => total + Number(component.referencePrice || component.salePrice || 0) * component.quantity,
    0,
  );
  const remainingOfferTotal = Number((offer.salePrice * offerQuantity).toFixed(2));

  if (paidComponents.length === 0) {
    throw new Error(`La oferta ${offer.sku} debe tener al menos un componente con precio.`);
  }

  let allocatedTotal = 0;

  return offer.components.map((component) => {
    const componentQuantity = roundLotQuantity(component.quantity * offerQuantity);
    let unitSalePrice = 0;

    if (!component.isGift) {
      const isLastPaid = paidComponents[paidComponents.length - 1].productId === component.productId;
      const weight = referenceTotal > 0
        ? (Number(component.referencePrice || component.salePrice || 0) * component.quantity * offerQuantity) / referenceTotal
        : 1 / paidComponents.length;
      const componentTotal = isLastPaid
        ? Number((remainingOfferTotal - allocatedTotal).toFixed(2))
        : Number((remainingOfferTotal * weight).toFixed(2));
      allocatedTotal = Number((allocatedTotal + componentTotal).toFixed(2));
      unitSalePrice = componentQuantity > 0 ? Number((componentTotal / componentQuantity).toFixed(2)) : 0;
    }

    return {
      ...component,
      quantity: componentQuantity,
      salePrice: unitSalePrice,
      offerId: offer.id,
      offerCode: offer.sku,
      offerName: offer.name,
      offerPrice: offer.salePrice,
    };
  });
}

async function normalizeSaleLinesForOffers(executor, lines) {
  const normalizedLines = [];
  const offerTraceLines = [];

  for (const line of lines) {
    const offerId = realOfferIdFromProductId(line.productId);

    if (!offerId) {
      normalizedLines.push({
        ...line,
        productId: Number(line.productId),
        quantity: roundLotQuantity(line.quantity),
        unitCost: Number(line.unitCost || 0),
        salePrice: Number(line.salePrice || 0),
      });
      continue;
    }

    const offer = await getActiveOfferForSale(executor, offerId);
    const offerQuantity = roundLotQuantity(line.quantity);

    if (offerQuantity <= 0) {
      throw new Error('Cantidad de oferta invalida');
    }

    for (const component of offer.components) {
      const required = roundLotQuantity(component.quantity * offerQuantity);

      if (required > Number(component.stock || 0)) {
        throw new Error(`Stock insuficiente para la oferta ${offer.sku}: falta ${component.name}.`);
      }
    }

    const expandedComponents = allocateOfferComponentPrices(offer, offerQuantity);

    for (const component of expandedComponents) {
      normalizedLines.push({
        productId: component.productId,
        quantity: component.quantity,
        unitCost: component.unitCost,
        salePrice: component.salePrice,
        assembledOffer: {
          id: component.offerId,
          code: component.offerCode,
          name: component.offerName,
          price: component.offerPrice,
          isGift: component.isGift,
          sku: component.sku,
          productName: component.name,
        },
      });
      offerTraceLines.push(component);
    }
  }

  return { normalizedLines, offerTraceLines };
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO RESUELVE EL ID_CLIENTE QUE SE GUARDA EN dbo.FACTURA Y TABLAS DE VENTA.
// SI LA VENTA ES CREDITO, OBLIGA A RECIBIR UN CLIENTE REAL SELECCIONADO.
// SI LA VENTA ES EFECTIVO O TRANSFERENCIA Y NO VIENE CLIENTE, USA O CREA dbo.cliente = CLIENTE FINAL.
async function resolveSaleCustomerId(transaction, paymentTypeId, customerId) {
  if (customerId && Number(customerId) > 0) {
    return Number(customerId);
  }

  if (Number(paymentTypeId) === 2) {
    throw new Error('Cliente requerido para registrar una venta al credito');
  }

  const existingCustomer = await new sql.Request(transaction)
    .query(`
      SELECT TOP 1 ID_CLIENTE
      FROM dbo.cliente
      WHERE UPPER(LTRIM(RTRIM(NOMBRE))) = 'CLIENTE FINAL'
      ORDER BY ID_CLIENTE ASC
    `);

  if (existingCustomer.recordset[0]?.ID_CLIENTE) {
    return Number(existingCustomer.recordset[0].ID_CLIENTE);
  }

  const insertedCustomer = await new sql.Request(transaction)
    .input('created_at', sql.VarChar(40), new Date().toISOString())
    .query(`
      INSERT INTO dbo.cliente (
        NOMBRE,
        APELLIDO,
        TELEFONO,
        DIRECCION,
        CREDITOS_ABIERTOS,
        FECHA_HORA,
        saldo
      )
      VALUES (
        'Cliente final',
        '',
        '00000000',
        'Venta de mostrador',
        0,
        @created_at,
        0
      );

      SELECT CAST(SCOPE_IDENTITY() AS INT) AS inserted_customer_id;
    `);

  return Number(insertedCustomer.recordset[0]?.inserted_customer_id || 0);
}

async function ensureInvoiceIdentityAheadOfSales(executor) {
  await new sql.Request(executor).query(`
    DECLARE @max_existing_invoice INT;

    SELECT @max_existing_invoice = MAX(id_fact)
    FROM (
      SELECT ISNULL(MAX(ID_FACT), 0) AS id_fact FROM dbo.FACTURA
      UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_EFECTIVO
      UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_CREDITO
      UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_TRANSFERENCIA
    ) ids;

    IF @max_existing_invoice IS NOT NULL
       AND IDENT_CURRENT('dbo.FACTURA') < @max_existing_invoice
    BEGIN
      DBCC CHECKIDENT ('dbo.FACTURA', RESEED, @max_existing_invoice) WITH NO_INFOMSGS;
    END;
  `);
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA EL SIGUIENTE NUMERO DE FACTURA DISPONIBLE.
// TOMA EL MAXIMO ENTRE FACTURA Y LAS TABLAS DE VENTA PARA NO CHOCAR CON HISTORICOS MIGRADOS.
// PARA MOSTRAR EL NUMERO EN EL FORMULARIO DE VENTA ANTES DE GUARDAR.
async function getNextInvoiceNumber() {
  const pool = await getPool();
  await ensureInvoiceIdentityAheadOfSales(pool);
  const result = await pool.request().query(`
    SELECT ISNULL(MAX(id_fact), 0) + 1 AS next_invoice_id
    FROM (
      SELECT ISNULL(MAX(ID_FACT), 0) AS id_fact FROM dbo.FACTURA
      UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_EFECTIVO
      UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_CREDITO
      UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_TRANSFERENCIA
    ) ids
  `);

  return Number(result.recordset[0]?.next_invoice_id || 1);
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA LOS TOTALES DE VENTAS Y COMPRAS PARA LAS TARJETAS DEL DASHBOARD.
// SUMA dbo.VENTA_EFECTIVO + dbo.VENTA_TRANSFERENCIA PARA VENTAS CERRADAS DE CONTADO.
// SUMA dbo.VENTA_CREDITO PARA MOSTRAR EL TOTAL DE VENTAS AL CREDITO.
// TAMBIEN CALCULA EL TOTAL DEL MES ACTUAL PARA EFECTIVO + TRANSFERENCIA Y PARA CREDITO.
// TAMBIEN CALCULA EL TOTAL DE VENTAS DEL MES ACTUAL Y EL TOTAL ACUMULADO DE VENTAS.
// ADEMAS CALCULA EL TOTAL DE COMPRAS DEL MES ACTUAL Y EL TOTAL ACUMULADO DE COMPRAS.
async function getDashboardSalesSummary() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      ISNULL((
        SELECT SUM(PRECIO_VENTA * CANT_PD)
        FROM dbo.VENTA_EFECTIVO
      ), 0) +
      ISNULL((
        SELECT SUM(PRECIO_VENTA * CANT_PD)
        FROM dbo.VENTA_TRANSFERENCIA
      ), 0) AS cash_transfer_total,
      ISNULL((
        SELECT SUM(total)
        FROM (
          SELECT
            CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
            TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
          FROM dbo.VENTA_EFECTIVO
          WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

          UNION ALL

          SELECT
            CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
            TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
          FROM dbo.VENTA_TRANSFERENCIA
          WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
        ) current_month_cash_transfer
        WHERE sale_date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
          AND sale_date < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) + 1, 0)
      ), 0) AS current_month_cash_transfer_total,
      ISNULL((
        SELECT SUM(PRECIO_VENTA * CANT_PD)
        FROM dbo.VENTA_CREDITO
      ), 0) AS credit_total,
      ISNULL((
        SELECT SUM(PRECIO_VENTA * CANT_PD)
        FROM dbo.VENTA_CREDITO
        WHERE TRY_CONVERT(datetime2, FECHA_HORA) >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
          AND TRY_CONVERT(datetime2, FECHA_HORA) < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) + 1, 0)
      ), 0) AS current_month_credit_total,
      ISNULL((
        SELECT SUM(total)
        FROM (
          SELECT
            CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
            TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
          FROM dbo.VENTA_EFECTIVO
          WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

          UNION ALL

          SELECT
            CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
            TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
          FROM dbo.VENTA_CREDITO
          WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

          UNION ALL

          SELECT
            CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
            TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
          FROM dbo.VENTA_TRANSFERENCIA
          WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
        ) current_month_sales
        WHERE sale_date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
          AND sale_date < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) + 1, 0)
      ), 0) AS current_month_sales_total,
      ISNULL((
        SELECT SUM(total)
        FROM (
          SELECT
            CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total
          FROM dbo.VENTA_EFECTIVO

          UNION ALL

          SELECT
            CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total
          FROM dbo.VENTA_CREDITO

          UNION ALL

          SELECT
            CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total
          FROM dbo.VENTA_TRANSFERENCIA
        ) accumulated_sales
      ), 0) AS accumulated_sales_total,
      ISNULL((
        SELECT SUM(total)
        FROM (
          SELECT
            CAST(PRECIO_COSTO * CANT_PD AS decimal(18, 2)) AS total,
            TRY_CONVERT(datetime2, FECHA_HORA) AS purchase_date
          FROM dbo.COMPRA_EFECTIVO
          WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

          UNION ALL

          SELECT
            CAST(PRECIO_COSTO * CANT_PD AS decimal(18, 2)) AS total,
            TRY_CONVERT(datetime2, FECHA_HORA) AS purchase_date
          FROM dbo.COMPRA_CREDITO
          WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
        ) current_month_purchases
        WHERE purchase_date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
          AND purchase_date < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) + 1, 0)
      ), 0) AS current_month_purchases_total,
      ISNULL((
        SELECT SUM(total)
        FROM (
          SELECT
            CAST(PRECIO_COSTO * CANT_PD AS decimal(18, 2)) AS total
          FROM dbo.COMPRA_EFECTIVO

          UNION ALL

          SELECT
            CAST(PRECIO_COSTO * CANT_PD AS decimal(18, 2)) AS total
          FROM dbo.COMPRA_CREDITO
        ) accumulated_purchases
      ), 0) AS accumulated_purchases_total
  `);

  const currentMonth = new Date();
  currentMonth.setDate(1);
  const currentMonthLabel = new Intl.DateTimeFormat('es-HN', {
    month: 'long',
    year: 'numeric',
  }).format(currentMonth);

  return {
    cashTransferTotal: Number(result.recordset[0]?.cash_transfer_total || 0),
    currentMonthCashTransferTotal: Number(result.recordset[0]?.current_month_cash_transfer_total || 0),
    creditTotal: Number(result.recordset[0]?.credit_total || 0),
    currentMonthCreditTotal: Number(result.recordset[0]?.current_month_credit_total || 0),
    lastMonthSalesTotal: Number(result.recordset[0]?.current_month_sales_total || 0),
    accumulatedSalesTotal: Number(result.recordset[0]?.accumulated_sales_total || 0),
    totalPurchases: Number(result.recordset[0]?.current_month_purchases_total || 0),
    accumulatedPurchasesTotal: Number(result.recordset[0]?.accumulated_purchases_total || 0),
    lastMonthLabel: currentMonthLabel,
    purchaseMonthLabel: currentMonthLabel,
  };
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA EL TOTAL DE VENTAS DE UN MES Y ANO ESPECIFICO.
// USA dbo.VENTA_EFECTIVO, dbo.VENTA_CREDITO Y dbo.VENTA_TRANSFERENCIA.
// SE UTILIZA EN LA HOJA COSTOS PARA CALCULAR EL MARGEN OPERATIVO DEL PERIODO SELECCIONADO.
async function getSalesTotalByPeriod(year, month) {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    throw new Error('Periodo invalido para consultar ventas');
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('period_year', sql.Int, numericYear)
    .input('period_month', sql.Int, numericMonth)
    .query(`
      SELECT ISNULL(SUM(total), 0) AS sales_total
      FROM (
        SELECT
          CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
          TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
        FROM dbo.VENTA_EFECTIVO
        WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

        UNION ALL

        SELECT
          CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
          TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
        FROM dbo.VENTA_CREDITO
        WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

        UNION ALL

        SELECT
          CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
          TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
        FROM dbo.VENTA_TRANSFERENCIA
        WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
      ) sales_by_period
      WHERE YEAR(sale_date) = @period_year
        AND MONTH(sale_date) = @period_month
    `);

  return {
    year: numericYear,
    month: numericMonth,
    total: Number(result.recordset[0]?.sales_total || 0),
  };
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA EL COSTO DE LOS PRODUCTOS VENDIDOS EN EL PERIODO
// Y LO AGRUPA POR CATEGORIA USANDO LA MISMA LOGICA DE PRODUCTO/CATEGORIA DE LA HOJA COSTOS.
// USA dbo.VENTA_EFECTIVO, dbo.VENTA_CREDITO, dbo.VENTA_TRANSFERENCIA, dbo.producto Y dbo.inventario.
async function getSalesByCategoryForPeriod(year, month) {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    throw new Error('Periodo invalido para consultar ventas por categoria');
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('period_year', sql.Int, numericYear)
    .input('period_month', sql.Int, numericMonth)
    .query(`
      WITH ventas AS (
        SELECT
          v.ID_PD,
          CAST(v.PRECIO_COSTO * v.CANT_PD AS decimal(18, 2)) AS total,
          TRY_CONVERT(datetime2, v.FECHA_HORA) AS sale_date
        FROM dbo.VENTA_EFECTIVO v
        WHERE TRY_CONVERT(datetime2, v.FECHA_HORA) IS NOT NULL

        UNION ALL

        SELECT
          v.ID_PD,
          CAST(v.PRECIO_COSTO * v.CANT_PD AS decimal(18, 2)) AS total,
          TRY_CONVERT(datetime2, v.FECHA_HORA) AS sale_date
        FROM dbo.VENTA_CREDITO v
        WHERE TRY_CONVERT(datetime2, v.FECHA_HORA) IS NOT NULL

        UNION ALL

        SELECT
          v.ID_PD,
          CAST(v.PRECIO_COSTO * v.CANT_PD AS decimal(18, 2)) AS total,
          TRY_CONVERT(datetime2, v.FECHA_HORA) AS sale_date
        FROM dbo.VENTA_TRANSFERENCIA v
        WHERE TRY_CONVERT(datetime2, v.FECHA_HORA) IS NOT NULL
      )
      SELECT
        ISNULL(i.categoria, 'Sin categoria') AS categoria,
        CAST(ISNULL(SUM(ventas.total), 0) AS decimal(18, 2)) AS total_costo_vendido
      FROM ventas
      INNER JOIN dbo.producto p
        ON p.id_producto = ventas.ID_PD
      INNER JOIN dbo.inventario i
        ON i.codigo = p.codigo
      WHERE YEAR(ventas.sale_date) = @period_year
        AND MONTH(ventas.sale_date) = @period_month
      GROUP BY ISNULL(i.categoria, 'Sin categoria')
      ORDER BY total_costo_vendido DESC, categoria ASC
    `);

  return {
    year: numericYear,
    month: numericMonth,
    categories: result.recordset.map((row) => ({
      category: row.categoria || 'Sin categoria',
      total: Number(row.total_costo_vendido || 0),
    })),
  };
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO EVALUA SI LAS VENTAS DE HOY HAN CAIDO RESPECTO A UNA REFERENCIA ANTERIOR
// TOMANDO AYER A LA MISMA HORA, O EL ULTIMO DIA CON AL MENOS L 1,000 SI AYER FUE CERO.
// CONSULTA dbo.VENTA_EFECTIVO, dbo.VENTA_CREDITO Y dbo.VENTA_TRANSFERENCIA.
// SOLO MARCA ALERTA ACTIVA SI LA EVALUACION OCURRE A PARTIR DE LAS 07:00 PM.
async function getSalesDropAlert() {
  const pool = await getPool();
  const result = await pool.request().query(`
    WITH ventas_origen AS (
      SELECT
        FECHA_HORA,
        PRECIO_VENTA,
        CANT_PD
      FROM dbo.VENTA_EFECTIVO

      UNION ALL

      SELECT
        FECHA_HORA,
        PRECIO_VENTA,
        CANT_PD
      FROM dbo.VENTA_CREDITO

      UNION ALL

      SELECT
        FECHA_HORA,
        PRECIO_VENTA,
        CANT_PD
      FROM dbo.VENTA_TRANSFERENCIA
    ),
    ventas AS (
      SELECT
        COALESCE(
          TRY_CONVERT(datetime2, FECHA_HORA),
          TRY_CONVERT(datetime2, FECHA_HORA, 103),
          TRY_CONVERT(datetime2, FECHA_HORA, 120),
          TRY_CONVERT(datetime2, FECHA_HORA, 126)
        ) AS sale_date,
        CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total
      FROM ventas_origen
      WHERE COALESCE(
          TRY_CONVERT(datetime2, FECHA_HORA),
          TRY_CONVERT(datetime2, FECHA_HORA, 103),
          TRY_CONVERT(datetime2, FECHA_HORA, 120),
          TRY_CONVERT(datetime2, FECHA_HORA, 126)
        ) IS NOT NULL
    ),
    limites AS (
      SELECT
        GETDATE() AS current_datetime,
        CAST(GETDATE() AS date) AS today_date
    ),
    ventas_por_dia AS (
      SELECT
        CAST(v.sale_date AS date) AS sale_day,
        SUM(v.total) AS total
      FROM ventas v
      CROSS JOIN limites l
      WHERE CAST(v.sale_date AS date) < l.today_date
      GROUP BY CAST(v.sale_date AS date)
      HAVING SUM(v.total) > 0
    ),
    referencia_ayer AS (
      SELECT vpd.sale_day, vpd.total
      FROM ventas_por_dia vpd
      CROSS JOIN limites l
      WHERE vpd.sale_day = DATEADD(DAY, -1, l.today_date)
    ),
    ultima_referencia AS (
      SELECT TOP 1 vpd.sale_day, vpd.total
      FROM ventas_por_dia vpd
      ORDER BY vpd.sale_day DESC
    )
    SELECT
      CAST(l.current_datetime AS datetime2) AS evaluated_at,
      CONVERT(varchar(8), CAST(l.current_datetime AS time), 108) AS cutoff_time,
      CASE
        WHEN CAST(l.current_datetime AS time) >= '19:00:00' THEN 1
        ELSE 0
      END AS is_active,
      ISNULL((
        SELECT SUM(v.total)
        FROM ventas v
        WHERE v.sale_date >= CAST(l.today_date AS datetime2)
          AND v.sale_date <= l.current_datetime
      ), 0) AS today_total,
      CASE
        WHEN ISNULL(ra.total, 0) = 0 THEN ISNULL(ur.total, 0)
        ELSE ISNULL(ra.total, 0)
      END AS reference_total,
      CASE
        WHEN ISNULL(ra.total, 0) = 0 THEN CONVERT(varchar(10), ur.sale_day, 23)
        ELSE CONVERT(varchar(10), DATEADD(DAY, -1, l.today_date), 23)
      END AS reference_date,
      CASE
        WHEN ISNULL(ra.total, 0) = 0 AND ur.sale_day IS NOT NULL THEN 1
        ELSE 0
      END AS is_reference_fallback
    FROM limites l
    LEFT JOIN referencia_ayer ra ON 1 = 1
    LEFT JOIN ultima_referencia ur ON 1 = 1
  `);

  const row = result.recordset[0] || {};
  const todayTotal = Number(row.today_total || 0);
  const yesterdayTotal = Number(row.reference_total || 0);
  const isActive = Boolean(row.is_active);
  const shortfallAmount = Math.max(yesterdayTotal - todayTotal, 0);
  const dropPercentage = yesterdayTotal > 0
    ? Number(((shortfallAmount / yesterdayTotal) * 100).toFixed(2))
    : 0;
  const shouldAlert = isActive && yesterdayTotal > 0 && todayTotal < yesterdayTotal;

  let severity = 'normal';
  if (shouldAlert && dropPercentage >= 20) {
    severity = 'critical';
  } else if (shouldAlert && dropPercentage >= 10) {
    severity = 'warning';
  } else if (shouldAlert) {
    severity = 'low';
  } else if (!isActive) {
    severity = 'pending';
  }

  return {
    isActive,
    shouldAlert,
    severity,
    evaluatedAt: row.evaluated_at instanceof Date ? row.evaluated_at.toISOString() : null,
    cutoffTime: row.cutoff_time || null,
    todayTotal,
    yesterdayTotal,
    referenceDate: row.reference_date || null,
    isReferenceFallback: Boolean(row.is_reference_fallback),
    shortfallAmount,
    dropPercentage,
  };
}

function resolveSalesTrendPeriod(period) {
  const allowedPeriods = {
    day: {
      label: 'dia',
      windowSize: 10,
      periodStartExpression: 'DATEADD(DAY, -9 + period_numbers.n, CAST(GETDATE() AS date))',
      dateExpression: 'CAST(sale_date AS date)',
    },
    week: {
      label: 'semana',
      windowSize: 10,
      periodStartExpression: 'DATEADD(WEEK, -9 + period_numbers.n, CAST(DATEADD(WEEK, DATEDIFF(WEEK, 0, GETDATE()), 0) AS date))',
      dateExpression: 'CAST(DATEADD(WEEK, DATEDIFF(WEEK, 0, sale_date), 0) AS date)',
    },
    month: {
      label: 'mes',
      windowSize: 12,
      periodStartExpression: 'DATEADD(MONTH, -11 + period_numbers.n, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))',
      dateExpression: 'DATEFROMPARTS(YEAR(sale_date), MONTH(sale_date), 1)',
    },
    year: {
      label: 'anio',
      dateExpression: 'DATEFROMPARTS(YEAR(sale_date), 1, 1)',
    },
  };

  return allowedPeriods[period] || allowedPeriods.month;
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA LA TENDENCIA DE VENTAS PARA EL GRAFICO DEL DASHBOARD.
// UNE dbo.VENTA_EFECTIVO, dbo.VENTA_CREDITO Y dbo.VENTA_TRANSFERENCIA.
// AGRUPA POR DIA, SEMANA, MES O ANIO SEGUN EL SELECTOR DE src/app/app.html.
async function getDashboardSalesTrend(period = 'month') {
  const pool = await getPool();
  const trendPeriod = resolveSalesTrendPeriod(period);
  const periodNumbers = Array.from({ length: trendPeriod.windowSize || 0 }, (_, index) => `(${index})`).join(',');
  const periodCte = trendPeriod.windowSize
    ? `,
    period_numbers(n) AS (
      SELECT n
      FROM (VALUES ${periodNumbers}) AS period_numbers(n)
    ),
    periods AS (
      SELECT ${trendPeriod.periodStartExpression} AS period_start
      FROM period_numbers
    )`
    : '';
  const trendSelect = trendPeriod.windowSize
    ? `
    SELECT
      periods.period_start,
      ISNULL(sales_totals.efectivo_total, 0) AS efectivo_total,
      ISNULL(sales_totals.credito_total, 0) AS credito_total,
      ISNULL(sales_totals.transferencia_total, 0) AS transferencia_total
    FROM periods
    LEFT JOIN (
      SELECT
        ${trendPeriod.dateExpression} AS period_start,
        SUM(CASE WHEN payment_type = 'efectivo' THEN total ELSE 0 END) AS efectivo_total,
        SUM(CASE WHEN payment_type = 'credito' THEN total ELSE 0 END) AS credito_total,
        SUM(CASE WHEN payment_type = 'transferencia' THEN total ELSE 0 END) AS transferencia_total
      FROM ventas
      GROUP BY ${trendPeriod.dateExpression}
    ) sales_totals
      ON sales_totals.period_start = periods.period_start
    ORDER BY periods.period_start ASC`
    : `
    SELECT
      ${trendPeriod.dateExpression} AS period_start,
      SUM(CASE WHEN payment_type = 'efectivo' THEN total ELSE 0 END) AS efectivo_total,
      SUM(CASE WHEN payment_type = 'credito' THEN total ELSE 0 END) AS credito_total,
      SUM(CASE WHEN payment_type = 'transferencia' THEN total ELSE 0 END) AS transferencia_total
    FROM ventas
    GROUP BY ${trendPeriod.dateExpression}
    ORDER BY period_start ASC`;
  const result = await pool.request().query(`
    WITH ventas AS (
      SELECT
        TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date,
        CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
        'efectivo' AS payment_type
      FROM dbo.VENTA_EFECTIVO
      WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

      UNION ALL

      SELECT
        TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date,
        CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
        'credito' AS payment_type
      FROM dbo.VENTA_CREDITO
      WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

      UNION ALL

      SELECT
        TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date,
        CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total,
        'transferencia' AS payment_type
      FROM dbo.VENTA_TRANSFERENCIA
      WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
    )${periodCte}
    ${trendSelect}
  `);

  return result.recordset.map((trend) => {
    const periodStart = trend.period_start instanceof Date
      ? trend.period_start.toISOString()
      : new Date(trend.period_start).toISOString();

    return {
      period: trendPeriod.label,
      periodStart,
      efectivo: Number(trend.efectivo_total || 0),
      credito: Number(trend.credito_total || 0),
      transferencia: Number(trend.transferencia_total || 0),
    };
  });
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA TODAS LAS FACTURAS GENERADAS Y SUS RESUMENES.
// UNE dbo.FACTURA CON cliente, usuario Y LAS TRES TABLAS DE VENTA PARA CALCULAR ESTADO.
async function listInvoices() {
  const pool = await getPool();
  const result = await pool.request().query(`
    WITH lineas AS (
      SELECT ID_FACT, ID_TP, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_EFECTIVO
      WHERE ID_FACT IS NOT NULL

      UNION ALL

      SELECT ID_FACT, ID_TP, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_CREDITO
      WHERE ID_FACT IS NOT NULL

      UNION ALL

      SELECT ID_FACT, ID_TP, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_TRANSFERENCIA
      WHERE ID_FACT IS NOT NULL
    )
    SELECT
      f.ID_FACT,
      f.ID_CLIENTE,
      CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')) AS CLIENTE,
      c.TELEFONO,
      f.CANT_ART,
      f.ID_USUARIO,
      u.nombre AS USUARIO,
      f.SUBTOTAL,
      f.FECHA_HORA,
      f.ID_TP,
      CASE f.ID_TP
        WHEN 1 THEN 'Efectivo'
        WHEN 2 THEN 'Credito'
        WHEN 3 THEN 'Transferencia'
        ELSE 'Sin tipo'
      END AS TIPO_PAGO,
      COUNT(lineas.ID_FACT) AS LINEAS,
      ISNULL(SUM(lineas.TOTAL), 0) AS TOTAL_LINEAS,
      ISNULL(SUM(lineas.UTILIDAD), 0) AS UTILIDAD_TOTAL,
      ISNULL(SUM(lineas.CANT_PD), 0) AS CANTIDAD_TOTAL,
      SUM(CASE WHEN lineas.ID_ESTADO_VENTA = 3 THEN 1 ELSE 0 END) AS LINEAS_ANULADAS,
      CASE
        WHEN COUNT(lineas.ID_FACT) > 0
          AND COUNT(lineas.ID_FACT) = SUM(CASE WHEN lineas.ID_ESTADO_VENTA = 3 THEN 1 ELSE 0 END)
          THEN 'Anulado'
        WHEN f.ID_TP = 2 THEN 'Activo'
        ELSE 'Cerrado'
      END AS ESTADO_FACTURA
    FROM dbo.FACTURA f
    LEFT JOIN dbo.cliente c
      ON c.ID_CLIENTE = f.ID_CLIENTE
    LEFT JOIN dbo.usuario u
      ON u.id_usuario = f.ID_USUARIO
    LEFT JOIN lineas
      ON lineas.ID_FACT = f.ID_FACT
      AND lineas.ID_TP = f.ID_TP
    GROUP BY
      f.ID_FACT,
      f.ID_CLIENTE,
      c.NOMBRE,
      c.APELLIDO,
      c.TELEFONO,
      f.CANT_ART,
      f.ID_USUARIO,
      u.nombre,
      f.SUBTOTAL,
      f.FECHA_HORA,
      f.ID_TP
    ORDER BY f.ID_FACT DESC
  `);

  return result.recordset.map((invoice) => ({
    invoiceId: Number(invoice.ID_FACT),
    customerId: invoice.ID_CLIENTE === null ? null : Number(invoice.ID_CLIENTE),
    customerName: String(invoice.CLIENTE || '').trim() || 'Cliente sin nombre',
    customerPhone: invoice.TELEFONO,
    itemCount: Number(invoice.CANT_ART || invoice.CANTIDAD_TOTAL || 0),
    userId: invoice.ID_USUARIO === null ? null : Number(invoice.ID_USUARIO),
    userName: invoice.USUARIO || 'Usuario sin nombre',
    subtotal: Number(invoice.SUBTOTAL || invoice.TOTAL_LINEAS || 0),
    total: Number(invoice.TOTAL_LINEAS || invoice.SUBTOTAL || 0),
    utility: Number(invoice.UTILIDAD_TOTAL || 0),
    createdAt: invoice.FECHA_HORA,
    paymentTypeId: Number(invoice.ID_TP || 0),
    paymentTypeName: invoice.TIPO_PAGO,
    statusName: invoice.ESTADO_FACTURA,
    linesCount: Number(invoice.LINEAS || 0),
    annulledLines: Number(invoice.LINEAS_ANULADAS || 0),
  }));
}

function mapInvoiceRecord(invoice) {
  return {
    invoiceId: Number(invoice.ID_FACT),
    customerId: invoice.ID_CLIENTE === null ? null : Number(invoice.ID_CLIENTE),
    customerName: String(invoice.CLIENTE || '').trim() || 'Cliente sin nombre',
    customerPhone: invoice.TELEFONO,
    itemCount: Number(invoice.CANT_ART || invoice.CANTIDAD_TOTAL || 0),
    userId: invoice.ID_USUARIO === null ? null : Number(invoice.ID_USUARIO),
    userName: invoice.USUARIO || 'Usuario sin nombre',
    subtotal: Number(invoice.SUBTOTAL || invoice.TOTAL_LINEAS || 0),
    total: Number(invoice.TOTAL_LINEAS || invoice.SUBTOTAL || 0),
    utility: Number(invoice.UTILIDAD_TOTAL || 0),
    createdAt: invoice.FECHA_HORA,
    paymentTypeId: Number(invoice.ID_TP || 0),
    paymentTypeName: invoice.TIPO_PAGO,
    statusName: invoice.ESTADO_FACTURA,
    linesCount: Number(invoice.LINEAS || 0),
    annulledLines: Number(invoice.LINEAS_ANULADAS || 0),
  };
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA LAS FACTURAS DEL DIA ACTUAL DESDE dbo.FACTURA.
// FILTRA POR FECHA ACTUAL EN SQL SERVER USANDO FECHA_HORA DE dbo.FACTURA.
async function listTodayInvoices() {
  const pool = await getPool();
  const result = await pool.request().query(`
    WITH rango_dia AS (
      SELECT
        DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), SYSUTCDATETIME()), CAST(CONVERT(date, GETDATE()) AS datetime2)) AS INICIO_UTC,
        DATEADD(DAY, 1, DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), SYSUTCDATETIME()), CAST(CONVERT(date, GETDATE()) AS datetime2))) AS FIN_UTC
    ),
    lineas AS (
      SELECT ID_FACT, ID_TP, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_EFECTIVO
      WHERE ID_FACT IS NOT NULL

      UNION ALL

      SELECT ID_FACT, ID_TP, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_CREDITO
      WHERE ID_FACT IS NOT NULL

      UNION ALL

      SELECT ID_FACT, ID_TP, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_TRANSFERENCIA
      WHERE ID_FACT IS NOT NULL
    )
    SELECT
      f.ID_FACT,
      f.ID_CLIENTE,
      CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')) AS CLIENTE,
      c.TELEFONO,
      f.CANT_ART,
      f.ID_USUARIO,
      u.nombre AS USUARIO,
      f.SUBTOTAL,
      f.FECHA_HORA,
      f.ID_TP,
      CASE f.ID_TP
        WHEN 1 THEN 'Efectivo'
        WHEN 2 THEN 'Credito'
        WHEN 3 THEN 'Transferencia'
        ELSE 'Sin tipo'
      END AS TIPO_PAGO,
      COUNT(lineas.ID_FACT) AS LINEAS,
      ISNULL(SUM(lineas.TOTAL), 0) AS TOTAL_LINEAS,
      ISNULL(SUM(lineas.UTILIDAD), 0) AS UTILIDAD_TOTAL,
      ISNULL(SUM(lineas.CANT_PD), 0) AS CANTIDAD_TOTAL,
      SUM(CASE WHEN lineas.ID_ESTADO_VENTA = 3 THEN 1 ELSE 0 END) AS LINEAS_ANULADAS,
      CASE
        WHEN COUNT(lineas.ID_FACT) > 0
          AND COUNT(lineas.ID_FACT) = SUM(CASE WHEN lineas.ID_ESTADO_VENTA = 3 THEN 1 ELSE 0 END)
          THEN 'Anulado'
        WHEN f.ID_TP = 2 THEN 'Activo'
        ELSE 'Cerrado'
      END AS ESTADO_FACTURA
    FROM dbo.FACTURA f
    LEFT JOIN dbo.cliente c
      ON c.ID_CLIENTE = f.ID_CLIENTE
    LEFT JOIN dbo.usuario u
      ON u.id_usuario = f.ID_USUARIO
    LEFT JOIN lineas
      ON lineas.ID_FACT = f.ID_FACT
      AND lineas.ID_TP = f.ID_TP
    CROSS JOIN rango_dia
    WHERE TRY_CONVERT(datetime2, f.FECHA_HORA) >= rango_dia.INICIO_UTC
      AND TRY_CONVERT(datetime2, f.FECHA_HORA) < rango_dia.FIN_UTC
    GROUP BY
      f.ID_FACT,
      f.ID_CLIENTE,
      c.NOMBRE,
      c.APELLIDO,
      c.TELEFONO,
      f.CANT_ART,
      f.ID_USUARIO,
      u.nombre,
      f.SUBTOTAL,
      f.FECHA_HORA,
      f.ID_TP
    ORDER BY f.ID_FACT DESC
  `);

  return result.recordset.map(mapInvoiceRecord);
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA EL DETALLE DE ARTICULOS DE UNA FACTURA.
// UNE LAS TRES TABLAS DE VENTA Y HACE JOIN CON producto PARA EXPORTAR PDF.
async function getInvoiceDetails(invoiceId) {
  if (!invoiceId || Number(invoiceId) <= 0) {
    throw new Error('Factura requerida');
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('invoice_id', sql.Int, Number(invoiceId))
    .query(`
      WITH lineas AS (
        SELECT
          ID_VENTA,
          ID_FACT,
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
          'Efectivo' AS TIPO_PAGO
        FROM dbo.VENTA_EFECTIVO
        WHERE ID_FACT = @invoice_id

      UNION ALL

      SELECT
          ID_VENTA,
          ID_FACT,
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
          'Credito' AS TIPO_PAGO
        FROM dbo.VENTA_CREDITO
        WHERE ID_FACT = @invoice_id

        UNION ALL

        SELECT
          ID_VTR AS ID_VENTA,
          ID_FACT,
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
          'Transferencia' AS TIPO_PAGO
        FROM dbo.VENTA_TRANSFERENCIA
        WHERE ID_FACT = @invoice_id
      )
      SELECT
        l.ID_VENTA,
        l.ID_FACT,
        l.ID_PD,
        p.nombre AS PRODUCTO,
        p.codigo AS CODIGO,
        l.CANT_PD,
        l.PRECIO_COSTO,
        l.PRECIO_VENTA,
        l.UTILIDAD,
        l.USUARIO,
        l.FECHA_HORA,
        l.ID_TP,
        l.TIPO_PAGO,
        l.ID_CLIENTE,
        l.ID_ESTADO_VENTA,
        e.ESTADO AS ESTADO
      FROM lineas l
      INNER JOIN dbo.FACTURA f
        ON f.ID_FACT = l.ID_FACT
        AND f.ID_TP = l.ID_TP
      LEFT JOIN dbo.producto p
        ON p.id_producto = l.ID_PD
      LEFT JOIN dbo.ESTADO e
        ON e.ID_ESTADO = l.ID_ESTADO_VENTA
      ORDER BY l.ID_VENTA ASC
    `);

  return result.recordset.map((line) => ({
    id: Number(line.ID_VENTA),
    invoiceId: Number(line.ID_FACT),
    productId: Number(line.ID_PD),
    productName: line.PRODUCTO || 'Producto sin nombre',
    sku: line.CODIGO || '',
    quantity: Number(line.CANT_PD || 0),
    unitCost: Number(line.PRECIO_COSTO || 0),
    salePrice: Number(line.PRECIO_VENTA || 0),
    utility: Number(line.UTILIDAD || 0),
    total: Number(line.PRECIO_VENTA || 0) * Number(line.CANT_PD || 0),
    user: line.USUARIO,
    createdAt: line.FECHA_HORA,
    paymentTypeId: Number(line.ID_TP || 0),
    paymentTypeName: line.TIPO_PAGO,
    customerId: line.ID_CLIENTE === null ? null : Number(line.ID_CLIENTE),
    statusId: line.ID_ESTADO_VENTA === null ? null : Number(line.ID_ESTADO_VENTA),
    statusName: line.ESTADO || 'Sin estado',
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO DEVUELVE EL RESUMEN DE FACTURAS PARA TARJETAS.
// CALCULA TOTAL DE FACTURAS, MONTO ACTIVO, FACTURAS ANULADAS Y CREDITO.
async function getInvoicesSummary() {
  const invoices = await listInvoices();
  const activeInvoices = invoices.filter((invoice) => invoice.statusName !== 'Anulado');

  return {
    invoiceCount: invoices.length,
    activeTotal: activeInvoices.reduce((total, invoice) => total + invoice.total, 0),
    annulledCount: invoices.filter((invoice) => invoice.statusName === 'Anulado').length,
    creditTotal: activeInvoices
      .filter((invoice) => invoice.paymentTypeId === 2)
      .reduce((total, invoice) => total + invoice.total, 0),
  };
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO ANULA UNA FACTURA Y DEVUELVE EL STOCK DE SUS PRODUCTOS.
// ACTUALIZA ID_ESTADO_VENTA = 3 EN LA TABLA DE VENTA CORRESPONDIENTE.
async function annulInvoice(invoiceId, userId) {
  if (!invoiceId || Number(invoiceId) <= 0) {
    throw new Error('Factura requerida para anular');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const resolvedUserId = Number(userId || 1);
    await setAuditContext(transaction, { userId: resolvedUserId });
    const invoiceResult = await new sql.Request(transaction)
      .input('invoice_id', sql.Int, Number(invoiceId))
      .query(`
        SELECT TOP 1 ID_FACT, ID_TP
        FROM dbo.FACTURA
        WHERE ID_FACT = @invoice_id
      `);

    const invoice = invoiceResult.recordset[0];

    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    const paymentInfo = resolveSalePaymentTableAlias(invoice.ID_TP);

    if (!paymentInfo) {
      throw new Error('Tipo de pago no valido para anular factura');
    }

    const linesResult = await new sql.Request(transaction)
      .input('invoice_id', sql.Int, Number(invoiceId))
      .query(`
        SELECT
          ID_PD,
          CANT_PD,
          ID_ESTADO_VENTA
        FROM ${paymentInfo.table}
        WHERE ID_FACT = @invoice_id
      `);

    const activeLines = linesResult.recordset.filter((line) => Number(line.ID_ESTADO_VENTA) !== 3);

    if (activeLines.length === 0) {
      throw new Error('La factura ya esta anulada o no tiene lineas activas');
    }

    for (const line of activeLines) {
      const stockResult = await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.ID_PD))
        .input('quantity', sql.Decimal(18, 3), roundLotQuantity(line.CANT_PD || 0))
        .query(`
          UPDATE i
          SET
            i.stock = i.stock + @quantity,
            i.actualizado_en = GETDATE()
          OUTPUT
            deleted.stock AS STOCK_ANT,
            inserted.stock AS STOCK_ACT,
            inserted.precio_costo AS PRECIO_COSTO
          FROM dbo.inventario i
          INNER JOIN dbo.producto p
            ON p.codigo = i.codigo
          WHERE p.id_producto = @product_id
        `);

      const stockRow = stockResult.recordset[0];
      await insertInventoryLogRecord(transaction, {
        action: 'ANULACION_VENTA',
        productId: Number(line.ID_PD),
        quantity: Number(line.CANT_PD || 0),
        previousStock: Number(stockRow?.STOCK_ANT || 0),
        newStock: Number(stockRow?.STOCK_ACT || 0),
        unitCost: Number(stockRow?.PRECIO_COSTO || 0),
        userId: resolvedUserId,
        customerId: null,
        paymentTypeId: Number(invoice.ID_TP || 0),
      });
    }

    await new sql.Request(transaction)
      .input('invoice_id', sql.Int, Number(invoiceId))
      .query(`
        UPDATE ${paymentInfo.table}
        SET ID_ESTADO_VENTA = 3
        WHERE ID_FACT = @invoice_id
          AND ID_ESTADO_VENTA <> 3
      `);

    await insertAuditRecord(transaction, {
      tableName: paymentInfo.table,
      action: 'ANULAR_FACTURA',
      recordKey: `ID_FACT=${Number(invoiceId)}`,
      userId: resolvedUserId,
      previousData: `estado=activo; lineas=${activeLines.length}`,
      newData: `estado=anulado; unidades_restauradas=${activeLines.reduce((total, line) => total + Number(line.CANT_PD || 0), 0)}`,
    });

    await transaction.commit();

    return {
      invoiceId: Number(invoiceId),
      restoredLines: activeLines.length,
      restoredQuantity: activeLines.reduce((total, line) => total + Number(line.CANT_PD || 0), 0),
      saleTable: paymentInfo.table,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO ACTIVA UNA FACTURA ANULADA Y DESCUENTA NUEVAMENTE EL STOCK.
// ACTUALIZA ID_ESTADO_VENTA A 2 PARA CREDITO Y A 4 PARA EFECTIVO O TRANSFERENCIA.
async function activateInvoice(invoiceId, userId) {
  if (!invoiceId || Number(invoiceId) <= 0) {
    throw new Error('Factura requerida para activar');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const resolvedUserId = Number(userId || 1);
    await setAuditContext(transaction, { userId: resolvedUserId });
    const invoiceResult = await new sql.Request(transaction)
      .input('invoice_id', sql.Int, Number(invoiceId))
      .query(`
        SELECT TOP 1 ID_FACT, ID_TP
        FROM dbo.FACTURA
        WHERE ID_FACT = @invoice_id
      `);

    const invoice = invoiceResult.recordset[0];

    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    const paymentInfo = resolveSalePaymentTableAlias(invoice.ID_TP);

    if (!paymentInfo) {
      throw new Error('Tipo de pago no valido para activar factura');
    }

    const linesResult = await new sql.Request(transaction)
      .input('invoice_id', sql.Int, Number(invoiceId))
      .query(`
        SELECT
          ${paymentInfo.idColumn} AS ID_VENTA,
          ID_PD,
          CANT_PD,
          ID_CLIENTE
        FROM ${paymentInfo.table}
        WHERE ID_FACT = @invoice_id
          AND ID_ESTADO_VENTA = 3
      `);

    const annulledLines = linesResult.recordset;

    if (annulledLines.length === 0) {
      throw new Error('La factura no esta anulada o no tiene lineas para activar');
    }

    for (const line of annulledLines) {
      const stockResult = await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.ID_PD))
        .input('quantity', sql.Decimal(18, 3), roundLotQuantity(line.CANT_PD || 0))
        .query(`
          UPDATE i
          SET
            i.stock = i.stock - @quantity,
            i.actualizado_en = GETDATE()
          OUTPUT
            deleted.stock AS STOCK_ANT,
            inserted.stock AS STOCK_ACT,
            inserted.precio_costo AS PRECIO_COSTO
          FROM dbo.inventario i
          INNER JOIN dbo.producto p
            ON p.codigo = i.codigo
          WHERE p.id_producto = @product_id
            AND i.stock >= @quantity;

          SELECT @@ROWCOUNT AS affected_rows;
        `);

      if (stockResult.recordset.length === 0) {
        throw new Error('No hay stock suficiente para activar la factura');
      }

      const stockRow = stockResult.recordset[0];
      await insertInventoryLogRecord(transaction, {
        action: 'REACTIVACION_VENTA',
        productId: Number(line.ID_PD),
        quantity: Number(line.CANT_PD || 0),
        previousStock: Number(stockRow?.STOCK_ANT || 0),
        newStock: Number(stockRow?.STOCK_ACT || 0),
        unitCost: Number(stockRow?.PRECIO_COSTO || 0),
        userId: resolvedUserId,
        customerId: null,
        paymentTypeId: Number(invoice.ID_TP || 0),
      });
    }

    const saleStatusId = resolveSaleStatusId(invoice.ID_TP);

    await new sql.Request(transaction)
      .input('invoice_id', sql.Int, Number(invoiceId))
      .input('sale_status_id', sql.Int, saleStatusId)
      .query(`
        UPDATE ${paymentInfo.table}
        SET ID_ESTADO_VENTA = @sale_status_id
        WHERE ID_FACT = @invoice_id
          AND ID_ESTADO_VENTA = 3
      `);

    await insertAuditRecord(transaction, {
      tableName: paymentInfo.table,
      action: 'ACTIVAR_FACTURA',
      recordKey: `ID_FACT=${Number(invoiceId)}`,
      userId: resolvedUserId,
      previousData: `estado=anulado; lineas=${annulledLines.length}`,
      newData: `estado=activo; unidades_descontadas=${annulledLines.reduce((total, line) => total + Number(line.CANT_PD || 0), 0)}`,
    });

    if (Number(invoice.ID_TP) === 2) {
      const customerIds = [...new Set(annulledLines.map((line) => Number(line.ID_CLIENTE || 0)).filter(Boolean))];
      for (const customerId of customerIds) {
        await recalculateCustomerCreditBalance(transaction, customerId);
      }
    }

    await transaction.commit();

    return {
      invoiceId: Number(invoiceId),
      activatedLines: annulledLines.length,
      deductedQuantity: annulledLines.reduce((total, line) => total + Number(line.CANT_PD || 0), 0),
      saleTable: paymentInfo.table,
      saleStatusId,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO REGISTRA UNA VENTA EN LA TABLA CORRESPONDIENTE A LA FORMA DE PAGO.
// VALIDA EL ID_TP Y SEGUN LA FORMA DE PAGO INSERTA EN LA TABLA CORRECTA.
// EFECTIVO INSERTA EN dbo.VENTA_EFECTIVO, CREDITO EN dbo.VENTA_CREDITO
// Y TRANSFERENCIA EN dbo.VENTA_TRANSFERENCIA.
// CONSULTA PRIMERO dbo.FACTURA PARA SABER EL SIGUIENTE ID_FACT ESPERADO.
// INSERTA PRIMERO LA FACTURA EN dbo.FACTURA Y LUEGO INSERTA LAS LINEAS CON ID_FACT.
// INSERTA LOS DETALLES, ID_TP, ID_CLIENTE E ID_ESTADO_VENTA. NO ACTUALIZA INVENTARIO.
async function registerSale({ user, userId, paymentTypeId, customerId, lines, quoteId = null }) {
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  if (!paymentTypeId || Number(paymentTypeId) <= 0) {
    throw new Error('Tipo de pago requerido para registrar la venta');
  }

  const saleTable = resolveSalePaymentTable(paymentTypeId);

  if (!saleTable) {
    throw new Error('Tipo de pago no valido para registrar la venta');
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('No hay productos para registrar en la venta');
  }

  if (!userId || Number(userId) <= 0) {
    throw new Error('Usuario requerido para registrar la factura');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId, user });
    await ensureOfferObjects(transaction);
    const { normalizedLines: saleLines, offerTraceLines } = await normalizeSaleLinesForOffers(transaction, lines);

    const saleTimestamp = new Date().toISOString();
    const saleStatusId = resolveSaleStatusId(paymentTypeId);
    const totalItems = saleLines.reduce((total, line) => total + Number(line.quantity || 0), 0);
    const subtotal = saleLines.reduce((total, line) => total + Number(line.salePrice || 0) * Number(line.quantity || 0), 0);
    const resolvedCustomerId = await resolveSaleCustomerId(transaction, paymentTypeId, customerId);
    const saleUserName = await resolveUserLogin(transaction, userId) || user;
    let firstInsertedSaleId = null;

    await ensureInvoiceIdentityAheadOfSales(transaction);

    const nextInvoiceResult = await new sql.Request(transaction)
      .query(`
        SELECT ISNULL(MAX(id_fact), 0) + 1 AS next_invoice_id
        FROM (
          SELECT ISNULL(MAX(ID_FACT), 0) AS id_fact FROM dbo.FACTURA WITH (UPDLOCK, HOLDLOCK)
          UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_EFECTIVO
          UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_CREDITO
          UNION ALL SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.VENTA_TRANSFERENCIA
        ) ids
      `);
    const expectedInvoiceId = Number(nextInvoiceResult.recordset[0]?.next_invoice_id || 1);

    const invoiceResult = await new sql.Request(transaction)
      .input('customer_id', sql.Int, resolvedCustomerId)
      .input('total_items', sql.Decimal(18, 2), Number(totalItems.toFixed(2)))
      .input('user_id', sql.Int, Number(userId))
      .input('subtotal', sql.Decimal(18, 2), Number(subtotal.toFixed(2)))
      .input('sale_timestamp', sql.VarChar(40), saleTimestamp)
      .input('payment_type_id', sql.Int, Number(paymentTypeId))
      .query(`
        INSERT INTO dbo.FACTURA (
          ID_CLIENTE,
          CANT_ART,
          ID_USUARIO,
          SUBTOTAL,
          FECHA_HORA,
          ID_TP
        )
        VALUES (
          @customer_id,
          @total_items,
          @user_id,
          @subtotal,
          @sale_timestamp,
          @payment_type_id
        );

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS inserted_invoice_id;
      `);

    const invoiceId = Number(invoiceResult.recordset[0]?.inserted_invoice_id || 0);

    if (invoiceId <= 0) {
      throw new Error('No se pudo generar el numero de factura');
    }

    for (const line of saleLines) {
      if (!line.productId || !line.quantity || line.quantity <= 0) {
        throw new Error('Linea de venta invalida');
      }

      await ensureProductLotCoverage(transaction, Number(line.productId), saleUserName);

      const utility = (Number(line.salePrice) - Number(line.unitCost)) * Number(line.quantity);

      const result = await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.productId))
        .input('quantity', sql.Decimal(18, 3), roundLotQuantity(line.quantity))
        .input('unit_cost', sql.Decimal(18, 2), Number(line.unitCost))
        .input('sale_price', sql.Decimal(18, 2), Number(line.salePrice))
        .input('utility', sql.Decimal(18, 2), Number(utility.toFixed(2)))
        .input('user_name', sql.VarChar(120), saleUserName)
        .input('sale_timestamp', sql.VarChar(40), saleTimestamp)
        .input('payment_type_id', sql.Int, Number(paymentTypeId))
        .input('customer_id', sql.Int, resolvedCustomerId)
        .input('sale_status_id', sql.Int, saleStatusId)
        .input('invoice_id', sql.Int, invoiceId)
        .query(`
          INSERT INTO ${saleTable} (
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
          VALUES (
            @product_id,
            @quantity,
            @unit_cost,
            @sale_price,
            @utility,
            @user_name,
            @sale_timestamp,
            @payment_type_id,
            @customer_id,
            @sale_status_id,
            @invoice_id
          );

          SELECT CAST(SCOPE_IDENTITY() AS INT) AS inserted_sale_id;
        `);

      if (firstInsertedSaleId === null) {
        firstInsertedSaleId = Number(result.recordset[0]?.inserted_sale_id || 0);
      }

      const insertedSaleId = Number(result.recordset[0]?.inserted_sale_id || 0);

      await allocateSaleLotsFefo(transaction, {
        invoiceId,
        saleTable,
        saleId: insertedSaleId,
        productId: Number(line.productId),
        quantity: Number(line.quantity),
        userName: saleUserName,
      });

      if (line.assembledOffer) {
        await new sql.Request(transaction)
          .input('invoice_id', sql.Int, invoiceId)
          .input('sale_table', sql.NVarChar(80), saleTable)
          .input('sale_id', sql.Int, insertedSaleId)
          .input('offer_id', sql.Int, line.assembledOffer.id)
          .input('offer_code', sql.NVarChar(80), line.assembledOffer.code)
          .input('offer_name', sql.NVarChar(180), line.assembledOffer.name)
          .input('product_id', sql.Int, Number(line.productId))
          .input('product_code', sql.NVarChar(80), line.assembledOffer.sku)
          .input('product_name', sql.NVarChar(180), line.assembledOffer.productName)
          .input('quantity', sql.Decimal(18, 3), roundLotQuantity(line.quantity))
          .input('is_gift', sql.Bit, line.assembledOffer.isGift ? 1 : 0)
          .input('sale_price', sql.Decimal(18, 2), Number(line.salePrice || 0))
          .input('offer_price', sql.Decimal(18, 2), Number(line.assembledOffer.price || 0))
          .input('user_id', sql.Int, Number(userId))
          .query(`
            INSERT INTO dbo.VENTA_OFERTA_DETALLE (
              ID_FACT,
              TABLA_VENTA,
              ID_VENTA,
              ID_OFERTA,
              CODIGO_OFERTA,
              NOMBRE_OFERTA,
              ID_PRODUCTO,
              CODIGO_PRODUCTO,
              NOMBRE_PRODUCTO,
              CANTIDAD,
              ES_REGALIA,
              PRECIO_UNITARIO,
              PRECIO_OFERTA,
              ID_USUARIO
            )
            VALUES (
              @invoice_id,
              @sale_table,
              @sale_id,
              @offer_id,
              @offer_code,
              @offer_name,
              @product_id,
              @product_code,
              @product_name,
              @quantity,
              @is_gift,
              @sale_price,
              @offer_price,
              @user_id
            );
          `);
      }
    }

    if (Number(paymentTypeId) === 2) {
      await recalculateCustomerCreditBalance(transaction, resolvedCustomerId);
    }

    await insertAuditRecord(transaction, {
      tableName: saleTable,
      action: 'VENTA',
      recordKey: `ID_FACT=${invoiceId}`,
      userId,
      user,
      previousData: '',
      newData: `factura=${invoiceId}; productos=${saleLines.length}; ofertas=${offerTraceLines.length}; unidades=${totalItems}; total=${Number(subtotal.toFixed(2))}; tipo_pago=${paymentTypeId}`,
    });

    if (quoteId && Number(quoteId) > 0) {
      await ensureQuoteObjects(transaction);
      await new sql.Request(transaction)
        .input('quote_id', sql.Int, Number(quoteId))
        .input('invoice_id', sql.Int, invoiceId)
        .query(`
          UPDATE dbo.COTIZACION
          SET
            ESTADO = 'FACTURADA',
            ID_FACT = @invoice_id,
            ACTUALIZADO_EN = SYSDATETIME()
          WHERE ID_COTIZACION = @quote_id;
        `);
    }

    const updatedProducts = await getUpdatedBillingProductStocks(
      transaction,
      saleLines.map((line) => line.productId),
    );
    const updatedOfferStocks = await getUpdatedOfferStocksForComponents(
      transaction,
      saleLines.map((line) => line.productId),
    );

    await transaction.commit();

    return {
      invoiceId,
      expectedInvoiceId,
      saleId: firstInsertedSaleId,
      saleTable,
      saleStatusId,
      savedLines: saleLines.length,
      savedAt: saleTimestamp,
      updatedProducts: [...updatedProducts, ...updatedOfferStocks],
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA EL CATALOGO DE PRODUCTOS Y LOS DATOS DE INVENTARIO
// HACIENDO JOIN ENTRE LAS TABLAS producto E inventario.
async function getProducts({ resolveProductImageUrl } = {}) {
  const pool = await getPool();
  await ensureProductBarcodeObjects(pool);
  const result = await pool.request().query(`
    WITH ventas_mes_anterior AS (
      SELECT
        ID_PD,
        SUM(CANT_PD) AS CANTIDAD_VENDIDA_MES_ANTERIOR
      FROM (
        SELECT
          ID_PD,
          CANT_PD,
          TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
        FROM dbo.VENTA_EFECTIVO
        WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

        UNION ALL

        SELECT
          ID_PD,
          CANT_PD,
          TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
        FROM dbo.VENTA_CREDITO
        WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

        UNION ALL

        SELECT
          ID_PD,
          CANT_PD,
          TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date
        FROM dbo.VENTA_TRANSFERENCIA
        WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
      ) ventas
      WHERE sale_date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) - 1, 0)
        AND sale_date < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
      GROUP BY ID_PD
    )
    SELECT
      p.id_producto,
      p.codigo,
      p.nombre,
      p.descripcion,
      p.imagen_url,
      i.precio_costo,
      i.precio_venta,
      i.precio_mayoreo,
      i.unidad_medida,
      ISNULL(i.permite_decimal, 0) AS permite_decimal,
      i.stock,
      i.stock_minimo,
      i.stock_maximo,
      i.categoria,
      i.proveedor,
      i.creado_por,
      i.creado_en,
      i.actualizado_por,
      i.actualizado_en,
      lote_principal.NUM_LOTE AS LOTE_PRINCIPAL,
      lote_principal.FECHA_VENCIMIENTO AS LOTE_PRINCIPAL_VENCIMIENTO,
      ISNULL(lotes_resumen.CANTIDAD_LOTES, 0) AS CANTIDAD_LOTES,
      lotes_resumen.LOTES_ACTIVOS,
      ISNULL(vma.CANTIDAD_VENDIDA_MES_ANTERIOR, 0) AS CANTIDAD_VENDIDA_MES_ANTERIOR
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    LEFT JOIN ventas_mes_anterior vma
      ON vma.ID_PD = p.id_producto
    OUTER APPLY (
      SELECT TOP 1
        l.NUM_LOTE,
        l.FECHA_VENCIMIENTO
      FROM dbo.PRODUCTO_LOTE l
      WHERE l.ID_PRODUCTO = p.id_producto
        AND l.ESTADO = 'ACTIVO'
        AND ISNULL(l.CANTIDAD_DISPONIBLE, 0) > 0
      ORDER BY
        CASE WHEN l.FECHA_VENCIMIENTO IS NULL THEN 1 ELSE 0 END,
        l.FECHA_VENCIMIENTO ASC,
        l.FECHA_INGRESO ASC,
        l.ID_LOTE ASC
    ) lote_principal
    OUTER APPLY (
      SELECT
        (
          SELECT COUNT(*)
          FROM dbo.PRODUCTO_LOTE l3
          WHERE l3.ID_PRODUCTO = p.id_producto
            AND l3.ESTADO = 'ACTIVO'
            AND ISNULL(l3.CANTIDAD_DISPONIBLE, 0) > 0
        ) AS CANTIDAD_LOTES,
        STUFF((
          SELECT ', ' + lote_texto.NUM_LOTE
          FROM (
            SELECT TOP 4
              l2.NUM_LOTE,
              l2.FECHA_VENCIMIENTO,
              l2.FECHA_INGRESO,
              l2.ID_LOTE
            FROM dbo.PRODUCTO_LOTE l2
            WHERE l2.ID_PRODUCTO = p.id_producto
              AND l2.ESTADO = 'ACTIVO'
              AND ISNULL(l2.CANTIDAD_DISPONIBLE, 0) > 0
            ORDER BY
              CASE WHEN l2.FECHA_VENCIMIENTO IS NULL THEN 1 ELSE 0 END,
              l2.FECHA_VENCIMIENTO ASC,
              l2.FECHA_INGRESO ASC,
              l2.ID_LOTE ASC
          ) lote_texto
          FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, '') AS LOTES_ACTIVOS
    ) lotes_resumen
    WHERE p.activo = 1
    ORDER BY p.nombre ASC
  `);

  const barcodeMap = await listProductBarcodesByProductIds(pool, result.recordset.map((product) => product.id_producto));

  return result.recordset.map((product) => ({
    id: product.id_producto,
    sku: product.codigo,
    barcodes: barcodeMap.get(Number(product.id_producto)) || [],
    name: product.nombre,
    description: product.descripcion,
    imageUrl: resolveProductImageUrl
      ? resolveProductImageUrl(product.imagen_url)
      : product.imagen_url,
    category: product.categoria || 'Sin categoria',
    stock: Number(product.stock || 0),
    minStock: Number(product.stock_minimo || 0),
    maxStock: product.stock_maximo === null ? null : Number(product.stock_maximo),
    unitCost: Number(product.precio_costo || 0),
    salePrice: Number(product.precio_venta || 0),
    wholesalePrice: product.precio_mayoreo === null ? null : Number(product.precio_mayoreo),
    unitMeasure: product.unidad_medida,
    allowsDecimalQuantity: Boolean(product.permite_decimal),
    supplier: product.proveedor,
    previousMonthSales: Number(product.CANTIDAD_VENDIDA_MES_ANTERIOR || 0),
    createdBy: product.creado_por,
    updatedBy: product.actualizado_por,
    createdAt: product.creado_en ? new Date(product.creado_en).toISOString() : null,
    updatedAt: product.actualizado_en ? new Date(product.actualizado_en).toISOString() : null,
    primaryLotNumber: product.LOTE_PRINCIPAL || null,
    primaryLotExpiryDate: product.LOTE_PRINCIPAL_VENCIMIENTO ? new Date(product.LOTE_PRINCIPAL_VENCIMIENTO).toISOString() : null,
    activeLotCount: Number(product.CANTIDAD_LOTES || 0),
    activeLotNumbers: product.LOTES_ACTIVOS ? String(product.LOTES_ACTIVOS).split(', ').filter(Boolean) : [],
  }));
}

async function getInactiveProducts({ search = '', resolveProductImageUrl } = {}) {
  const resolvedSearch = String(search || '').trim();
  const pool = await getPool();
  const request = pool.request()
    .input('search', sql.NVarChar(255), `%${resolvedSearch}%`);

  await ensureProductBarcodeObjects(pool);
  const result = await request.query(`
    SELECT
      p.id_producto,
      p.codigo,
      p.nombre,
      p.descripcion,
      p.imagen_url,
      p.activo,
      p.actualizado_en AS fecha_inactivacion,
      i.precio_costo,
      i.precio_venta,
      i.precio_mayoreo,
      i.unidad_medida,
      ISNULL(i.permite_decimal, 0) AS permite_decimal,
      i.stock,
      i.stock_minimo,
      i.stock_maximo,
      i.categoria,
      i.proveedor,
      i.creado_por,
      i.creado_en,
      i.actualizado_por,
      i.actualizado_en
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    WHERE p.activo = 0
      AND (
        @search = '%%'
        OR p.codigo LIKE @search
        OR p.nombre LIKE @search
        OR i.categoria LIKE @search
        OR EXISTS (
          SELECT 1
          FROM dbo.PRODUCTO_CODIGO_BARRA pcb
          WHERE pcb.ID_PRODUCTO = p.id_producto
            AND pcb.CODIGO_BARRA LIKE @search
        )
      )
    ORDER BY p.actualizado_en DESC, p.nombre ASC;
  `);

  const barcodeMap = await listProductBarcodesByProductIds(pool, result.recordset.map((product) => product.id_producto));

  return result.recordset.map((product) => ({
    id: Number(product.id_producto),
    sku: product.codigo || '',
    barcodes: barcodeMap.get(Number(product.id_producto)) || [],
    name: product.nombre || 'Producto sin nombre',
    description: product.descripcion || null,
    imageUrl: resolveProductImageUrl
      ? resolveProductImageUrl(product.imagen_url)
      : product.imagen_url || null,
    category: product.categoria || 'Sin categoria',
    stock: Number(product.stock || 0),
    minStock: Number(product.stock_minimo || 0),
    maxStock: product.stock_maximo === null ? null : Number(product.stock_maximo),
    unitCost: Number(product.precio_costo || 0),
    salePrice: Number(product.precio_venta || 0),
    wholesalePrice: product.precio_mayoreo === null ? null : Number(product.precio_mayoreo),
    unitMeasure: product.unidad_medida || null,
    allowsDecimalQuantity: Boolean(product.permite_decimal),
    supplier: product.proveedor || null,
    previousMonthSales: 0,
    createdBy: product.creado_por || null,
    updatedBy: product.actualizado_por || null,
    createdAt: product.creado_en ? new Date(product.creado_en).toISOString() : null,
    updatedAt: product.actualizado_en ? new Date(product.actualizado_en).toISOString() : null,
    deactivatedAt: product.fecha_inactivacion ? new Date(product.fecha_inactivacion).toISOString() : null,
    primaryLotNumber: null,
    primaryLotExpiryDate: null,
    activeLotCount: 0,
    activeLotNumbers: [],
  }));
}

async function getBillingProducts({ resolveProductImageUrl } = {}) {
  const pool = await getPool();
  await ensureOfferObjects(pool);
  await ensureProductBarcodeObjects(pool);
  const result = await pool.request().query(`
    SELECT
      p.id_producto,
      p.codigo,
      p.nombre,
      p.descripcion,
      p.imagen_url,
      i.precio_costo,
      i.precio_venta,
      i.precio_mayoreo,
      i.unidad_medida,
      ISNULL(i.permite_decimal, 0) AS permite_decimal,
      i.stock,
      i.stock_minimo,
      i.stock_maximo,
      i.categoria,
      i.creado_por,
      i.creado_en,
      i.actualizado_por,
      i.actualizado_en
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    WHERE p.activo = 1
    ORDER BY p.nombre ASC
  `);

  const barcodeMap = await listProductBarcodesByProductIds(pool, result.recordset.map((product) => product.id_producto));

  const products = result.recordset.map((product) => ({
    id: product.id_producto,
    sku: product.codigo,
    barcodes: barcodeMap.get(Number(product.id_producto)) || [],
    name: product.nombre,
    description: product.descripcion || null,
    imageUrl: resolveProductImageUrl
      ? resolveProductImageUrl(product.imagen_url)
      : product.imagen_url,
    category: product.categoria || 'Sin categoria',
    stock: Number(product.stock || 0),
    minStock: Number(product.stock_minimo || 0),
    maxStock: product.stock_maximo === null ? null : Number(product.stock_maximo),
    unitCost: Number(product.precio_costo || 0),
    salePrice: Number(product.precio_venta || 0),
    wholesalePrice: product.precio_mayoreo === null ? null : Number(product.precio_mayoreo),
    unitMeasure: product.unidad_medida,
    allowsDecimalQuantity: Boolean(product.permite_decimal),
    createdBy: product.creado_por,
    updatedBy: product.actualizado_por,
    createdAt: product.creado_en ? new Date(product.creado_en).toISOString() : null,
    updatedAt: product.actualizado_en ? new Date(product.actualizado_en).toISOString() : null,
  }));

  const activeOffers = (await listAssembledOfferCodes({ includeInactive: true }))
    .filter((offer) =>
      offer.active &&
      offer.status === 'ACTIVO' &&
      Number(offer.stock || 0) > 0 &&
      !offer.components.some((component) => !component.productActive)
    )
    .map((offer) => ({
      id: offer.virtualProductId,
      sku: offer.sku,
      name: offer.name,
      description: offer.description,
      imageUrl: resolveProductImageUrl
        ? resolveProductImageUrl(offer.imageUrl)
        : offer.imageUrl,
      category: 'Ofertas',
      stock: offer.stock,
      minStock: 0,
      maxStock: null,
      unitCost: offer.components.reduce(
        (total, component) => total + Number(component.unitCost || 0) * Number(component.quantity || 0),
        0,
      ),
      salePrice: offer.salePrice,
      wholesalePrice: null,
      unitMeasure: 'Oferta',
      allowsDecimalQuantity: false,
      isAssembledOffer: true,
      offerId: offer.id,
      offerStatus: offer.status,
      offerStartsAt: offer.startsAt,
      offerEndsAt: offer.endsAt,
      offerComponents: offer.components,
    }));

  return [...activeOffers, ...products];
}

async function getUpdatedBillingProductStocks(executor, productIds) {
  const uniqueProductIds = [...new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map((productId) => Number(productId || 0))
      .filter((productId) => Number.isInteger(productId) && productId > 0),
  )];

  if (uniqueProductIds.length === 0) {
    return [];
  }

  const request = new sql.Request(executor);
  const parameters = uniqueProductIds.map((productId, index) => {
    const inputName = `product_id_${index}`;
    request.input(inputName, sql.Int, productId);
    return `@${inputName}`;
  });

  const result = await request.query(`
    SELECT
      p.id_producto,
      i.stock
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    WHERE p.id_producto IN (${parameters.join(', ')})
  `);

  return result.recordset.map((product) => ({
    productId: Number(product.id_producto),
    stock: Number(product.stock || 0),
  }));
}

async function getAvailableBillingProductStocks(executor, productIds) {
  const uniqueProductIds = [...new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map((productId) => Number(productId || 0))
      .filter((productId) => Number.isInteger(productId) && productId > 0),
  )];

  if (uniqueProductIds.length === 0) {
    return [];
  }

  const request = new sql.Request(executor);
  const parameters = uniqueProductIds.map((productId, index) => {
    const inputName = `available_product_id_${index}`;
    request.input(inputName, sql.Int, productId);
    return `@${inputName}`;
  });

  const result = await request.query(`
    SELECT
      p.id_producto,
      i.stock
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    WHERE p.activo = 1
      AND p.id_producto IN (${parameters.join(', ')})
  `);

  return result.recordset.map((product) => ({
    productId: Number(product.id_producto),
    stock: Number(product.stock || 0),
  }));
}

async function getBillingProductAvailability(productIds) {
  const pool = await getPool();
  const requestedProductIds = [...new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map((productId) => Number(productId || 0))
      .filter((productId) => Number.isInteger(productId) && productId !== 0),
  )];
  const stocks = await getAvailableBillingProductStocks(pool, requestedProductIds);
  const requestedOfferProductIds = requestedProductIds.filter((productId) => productId < 0);
  let offerStocks = [];

  if (requestedOfferProductIds.length > 0) {
    const requestedOfferIds = new Set(requestedOfferProductIds.map((productId) => Math.abs(productId)));
    offerStocks = (await listAssembledOfferCodes({ includeInactive: true }))
      .filter((offer) => requestedOfferIds.has(Number(offer.id)))
      .map((offer) => ({
        productId: Number(offer.virtualProductId),
        stock: offer.active &&
          offer.status === 'ACTIVO' &&
          !offer.components.some((component) => !component.productActive)
          ? Number(offer.stock || 0)
          : 0,
      }));
  }

  const stockByProductId = new Map(
    [...stocks, ...offerStocks].map((product) => [Number(product.productId), Number(product.stock || 0)]),
  );

  return requestedProductIds.map((productId) => ({
    productId,
    stock: stockByProductId.get(productId) ?? 0,
    available: stockByProductId.has(productId) && Number(stockByProductId.get(productId) || 0) > 0,
  }));
}

async function getUpdatedOfferStocksForComponents(executor, productIds) {
  const uniqueProductIds = [...new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map((productId) => Number(productId || 0))
      .filter((productId) => Number.isInteger(productId) && productId > 0),
  )];

  if (uniqueProductIds.length === 0) {
    return [];
  }

  await ensureOfferObjects(executor);

  const request = new sql.Request(executor);
  const parameters = uniqueProductIds.map((productId, index) => {
    const inputName = `product_id_${index}`;
    request.input(inputName, sql.Int, productId);
    return `@${inputName}`;
  });

  const result = await request.query(`
    SELECT
      o.ID_OFERTA,
      d.ID_PRODUCTO,
      d.CANTIDAD,
      ISNULL(i.stock, 0) AS STOCK_PRODUCTO
    FROM dbo.CODIGO_ARMADO_OFERTA o
    INNER JOIN dbo.CODIGO_ARMADO_OFERTA_DETALLE d
      ON d.ID_OFERTA = o.ID_OFERTA
    INNER JOIN dbo.producto p
      ON p.id_producto = d.ID_PRODUCTO
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    WHERE o.ACTIVO = 1
      AND SYSDATETIME() BETWEEN o.FECHA_INICIO AND o.FECHA_FIN
      AND EXISTS (
        SELECT 1
        FROM dbo.CODIGO_ARMADO_OFERTA_DETALLE affected
        WHERE affected.ID_OFERTA = o.ID_OFERTA
          AND affected.ID_PRODUCTO IN (${parameters.join(', ')})
      )
    ORDER BY o.ID_OFERTA;
  `);

  const grouped = new Map();

  for (const row of result.recordset) {
    const offerId = Number(row.ID_OFERTA);
    grouped.set(offerId, [
      ...(grouped.get(offerId) || []),
      {
        quantity: Number(row.CANTIDAD || 0),
        stock: Number(row.STOCK_PRODUCTO || 0),
      },
    ]);
  }

  return [...grouped.entries()].map(([offerId, components]) => ({
    productId: offerVirtualProductId(offerId),
    stock: calculateOfferAvailableStock(components),
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO DEVUELVE EL DETALLE PROFESIONAL DE INVENTARIO DE UN PRODUCTO.
// INCLUYE LOTES FEFO ACTIVOS/AGOTADOS Y TODO EL HISTORICO DE VENTAS Y COMPRAS.
async function getProductInventoryDetail(productId, { resolveProductImageUrl } = {}) {
  if (!productId || Number(productId) <= 0) {
    throw new Error('Producto requerido para consultar detalle de inventario');
  }

  const pool = await getPool();

  const request = pool.request().input('product_id', sql.Int, Number(productId));

  const result = await request.query(`
    SELECT TOP 1
      p.id_producto,
      p.codigo,
      p.nombre,
      p.descripcion,
      p.imagen_url,
      i.precio_costo,
      i.precio_venta,
      i.precio_mayoreo,
      i.unidad_medida,
      ISNULL(i.permite_decimal, 0) AS permite_decimal,
      i.stock,
      i.stock_minimo,
      i.stock_maximo,
      i.categoria,
      i.proveedor,
      i.creado_por,
      i.creado_en,
      i.actualizado_por,
      i.actualizado_en
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    WHERE p.id_producto = @product_id;

    SELECT
      ID_LOTE,
      NUM_LOTE,
      CANTIDAD_INICIAL,
      CANTIDAD_DISPONIBLE,
      COSTO_UNITARIO,
      FECHA_INGRESO,
      FECHA_VENCIMIENTO,
      ESTADO,
      COALESCE(NUM_FACT, CONCAT(TABLA_COMPRA, '-', ID_COMPRA), ORIGEN) AS DOCUMENTO_ORIGEN,
      CREADO_EN
    FROM dbo.PRODUCTO_LOTE
    WHERE ID_PRODUCTO = @product_id
    ORDER BY
      CASE WHEN ESTADO = 'ACTIVO' AND ISNULL(CANTIDAD_DISPONIBLE, 0) > 0 THEN 0 ELSE 1 END,
      CASE WHEN FECHA_VENCIMIENTO IS NULL THEN 1 ELSE 0 END,
      FECHA_VENCIMIENTO ASC,
      FECHA_INGRESO ASC,
      ID_LOTE ASC;

    SELECT
      movimiento.fecha,
      movimiento.documento,
      movimiento.tipo_movimiento,
      movimiento.entrada,
      movimiento.salida,
      movimiento.costo_unitario,
      movimiento.usuario_responsable
    FROM (
      SELECT
        TRY_CONVERT(datetime2, c.FECHA_HORA) AS fecha,
        CONCAT('COMPRA-', c.TIPO_COMPRA, '-', c.ID_COMPRA) AS documento,
        CONCAT('Entrada ', c.TIPO_COMPRA) AS tipo_movimiento,
        CAST(c.CANT_PD AS decimal(18, 2)) AS entrada,
        CAST(0 AS decimal(18, 2)) AS salida,
        CAST(c.PRECIO_COSTO AS decimal(18, 4)) AS costo_unitario,
        COALESCE(u.nombre, u.usuario, 'Sistema') AS usuario_responsable
      FROM (
        SELECT ID_CEFECT AS ID_COMPRA, 'Efectivo' AS TIPO_COMPRA, ID_PD, CANT_PD, PRECIO_COSTO, ID_USUARIO, FECHA_HORA
        FROM dbo.COMPRA_EFECTIVO
        UNION ALL
        SELECT ID_CCD AS ID_COMPRA, 'Credito' AS TIPO_COMPRA, ID_PD, CANT_PD, PRECIO_COSTO, ID_USUARIO, FECHA_HORA
        FROM dbo.COMPRA_CREDITO
      ) c
      LEFT JOIN dbo.usuario u
        ON u.id_usuario = c.ID_USUARIO
      WHERE c.ID_PD = @product_id
        AND TRY_CONVERT(datetime2, c.FECHA_HORA) IS NOT NULL

      UNION ALL

      SELECT
        TRY_CONVERT(datetime2, v.FECHA_HORA) AS fecha,
        CONCAT('FACT-', v.ID_FACT) AS documento,
        CONCAT('Salida ', v.TIPO_VENTA) AS tipo_movimiento,
        CAST(0 AS decimal(18, 2)) AS entrada,
        CAST(v.CANT_PD AS decimal(18, 2)) AS salida,
        CAST(v.PRECIO_COSTO AS decimal(18, 4)) AS costo_unitario,
        COALESCE(NULLIF(v.USUARIO, ''), 'Sistema') AS usuario_responsable
      FROM (
        SELECT ID_VENTA, 'Efectivo' AS TIPO_VENTA, ID_FACT, ID_PD, CANT_PD, PRECIO_COSTO, USUARIO, FECHA_HORA
        FROM dbo.VENTA_EFECTIVO
        UNION ALL
        SELECT ID_VENTA, 'Credito' AS TIPO_VENTA, ID_FACT, ID_PD, CANT_PD, PRECIO_COSTO, USUARIO, FECHA_HORA
        FROM dbo.VENTA_CREDITO
        UNION ALL
        SELECT ID_VTR AS ID_VENTA, 'Transferencia' AS TIPO_VENTA, ID_FACT, ID_PD, CANT_PD, PRECIO_COSTO, USUARIO, FECHA_HORA
        FROM dbo.VENTA_TRANSFERENCIA
      ) v
      WHERE v.ID_PD = @product_id
        AND TRY_CONVERT(datetime2, v.FECHA_HORA) IS NOT NULL

      UNION ALL

      SELECT
        TRY_CONVERT(datetime2, l.FECHA_HORA) AS fecha,
        CONCAT('AJUSTE-', CONVERT(varchar(19), TRY_CONVERT(datetime2, l.FECHA_HORA), 126)) AS documento,
        REPLACE(l.ACCION_REALIZADA, '_', ' ') AS tipo_movimiento,
        CAST(CASE WHEN l.ACCION_REALIZADA IN ('REACTIVACION_PRODUCTO', 'ALTA_PRODUCTO') THEN l.CANT_PD ELSE 0 END AS decimal(18, 2)) AS entrada,
        CAST(CASE WHEN l.ACCION_REALIZADA IN ('REACTIVACION_PRODUCTO', 'ALTA_PRODUCTO') THEN 0 ELSE l.CANT_PD END AS decimal(18, 2)) AS salida,
        CAST(l.PRECIO_COSTO AS decimal(18, 4)) AS costo_unitario,
        COALESCE(u.nombre, u.usuario, 'Sistema') AS usuario_responsable
      FROM dbo.INVENTARIO_LOG l
      LEFT JOIN dbo.usuario u
        ON u.id_usuario = l.ID_USER
      WHERE l.ID_PD = @product_id
        AND (
          l.ACCION_REALIZADA LIKE 'REBAJA_%'
          OR l.ACCION_REALIZADA IN ('REACTIVACION_PRODUCTO', 'ALTA_PRODUCTO')
        )
        AND TRY_CONVERT(datetime2, l.FECHA_HORA) IS NOT NULL
    ) movimiento
    ORDER BY movimiento.fecha DESC;
  `);

  const product = result.recordsets[0]?.[0];

  if (!product) {
    throw new Error('Producto no encontrado');
  }

  return {
    product: {
      id: Number(product.id_producto),
      sku: product.codigo || '',
      name: product.nombre || 'Producto sin nombre',
      description: product.descripcion || null,
      imageUrl: resolveProductImageUrl
        ? resolveProductImageUrl(product.imagen_url)
        : product.imagen_url || null,
      category: product.categoria || 'Sin categoria',
      stock: Number(product.stock || 0),
      minStock: Number(product.stock_minimo || 0),
      maxStock: product.stock_maximo === null ? null : Number(product.stock_maximo),
      unitCost: Number(product.precio_costo || 0),
      salePrice: Number(product.precio_venta || 0),
      wholesalePrice: product.precio_mayoreo === null ? null : Number(product.precio_mayoreo),
      unitMeasure: product.unidad_medida || null,
      allowsDecimalQuantity: Boolean(product.permite_decimal),
      supplier: product.proveedor || null,
      createdBy: product.creado_por || null,
      updatedBy: product.actualizado_por || null,
      createdAt: product.creado_en ? new Date(product.creado_en).toISOString() : null,
      updatedAt: product.actualizado_en ? new Date(product.actualizado_en).toISOString() : null,
    },
    lots: (result.recordsets[1] || []).map((lot) => ({
      id: Number(lot.ID_LOTE),
      lotNumber: lot.NUM_LOTE || '',
      initialQuantity: Number(lot.CANTIDAD_INICIAL || 0),
      availableQuantity: Number(lot.CANTIDAD_DISPONIBLE || 0),
      unitCost: Number(lot.COSTO_UNITARIO || 0),
      entryDate: lot.FECHA_INGRESO ? new Date(lot.FECHA_INGRESO).toISOString() : null,
      expiryDate: lot.FECHA_VENCIMIENTO ? new Date(lot.FECHA_VENCIMIENTO).toISOString() : null,
      status: lot.ESTADO || 'SIN ESTADO',
      sourceDocument: lot.DOCUMENTO_ORIGEN || null,
      createdAt: lot.CREADO_EN ? new Date(lot.CREADO_EN).toISOString() : null,
    })),
    movements: (result.recordsets[2] || []).map((movement, index) => ({
      id: index + 1,
      date: movement.fecha ? new Date(movement.fecha).toISOString() : null,
      document: movement.documento || 'Sin documento',
      movementType: movement.tipo_movimiento || 'Movimiento',
      entry: Number(movement.entrada || 0),
      exit: Number(movement.salida || 0),
      unitCost: Number(movement.costo_unitario || 0),
      userName: movement.usuario_responsable || 'Sistema',
    })),
  };
}

async function createInventoryProduct({
  sku,
  name,
  imageUrl,
  category,
  primaryLotExpiryDate,
  stock,
  minStock,
  maxStock,
  unitCost,
  salePrice,
  unitMeasure,
  allowsDecimalQuantity,
  userId,
  user,
} = {}) {
  const resolvedSku = String(sku || '').trim();
  const resolvedName = String(name || '').trim();

  if (!resolvedSku || !resolvedName) {
    throw new Error('Codigo y nombre son requeridos para crear el producto');
  }

  if (resolvedSku.length > 50) {
    throw new Error('El codigo del producto no puede superar 50 caracteres');
  }

  if (resolvedName.length > 255) {
    throw new Error('El nombre del producto no puede superar 255 caracteres');
  }

  const resolvedCategory = (String(category || 'General').trim() || 'General').slice(0, 100);
  const resolvedStock = roundLotQuantity(stock || 0);
  const resolvedMinStock = Number(minStock || 0);
  const resolvedMaxStock = maxStock === null || maxStock === undefined ? null : Number(maxStock || 0);
  const resolvedUnitCost = Number(unitCost || 0);
  const resolvedSalePrice = Number(salePrice || 0);
  const resolvedUnitMeasure = String(unitMeasure || 'Unidad').trim() || 'Unidad';
  const resolvedUserId = Number(userId || 1) || 1;
  const resolvedUser = (String(user || 'Sistema').trim() || 'Sistema').slice(0, 100);
  const resolvedImageUrl = normalizeProductImageUrlForStorage(imageUrl);
  const resolvedPrimaryLotExpiryDate = normalizeNullableDate(primaryLotExpiryDate);

  const numericFields = [
    ['stock', resolvedStock],
    ['stock minimo', resolvedMinStock],
    ['stock maximo', resolvedMaxStock],
    ['costo', resolvedUnitCost],
    ['precio venta', resolvedSalePrice],
  ].filter(([, value]) => value !== null);

  const invalidField = numericFields.find(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0);
  if (invalidField) {
    throw new Error(`El campo ${invalidField[0]} debe ser un numero valido mayor o igual a cero`);
  }

  if (resolvedMaxStock !== null && resolvedMaxStock > 0 && resolvedMaxStock < resolvedMinStock) {
    throw new Error('El stock maximo no puede ser menor que el stock minimo');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId: resolvedUserId, user: resolvedUser });
    await ensureFefoLotObjects(transaction);
    await ensureProductBarcodeObjects(transaction);

    const duplicateResult = await new sql.Request(transaction)
      .input('sku', sql.VarChar(50), resolvedSku)
      .query(`
        SELECT TOP 1 p.id_producto, p.nombre, p.activo
        FROM dbo.producto p
        WHERE p.codigo = @sku
           OR EXISTS (
             SELECT 1
             FROM dbo.PRODUCTO_CODIGO_BARRA pcb
             WHERE pcb.ID_PRODUCTO = p.id_producto
               AND pcb.CODIGO_BARRA = @sku
           );
      `);

    if (duplicateResult.recordset.length > 0) {
      const duplicate = duplicateResult.recordset[0];
      if (Boolean(duplicate.activo)) {
        throw new Error(`No se puede crear. Ya existe un producto activo con el codigo ${resolvedSku}.`);
      }

      throw new Error(`El codigo ${resolvedSku} pertenece a un producto inactivo: ${duplicate.nombre || 'Producto sin nombre'}. Use la opcion Reactivar producto.`);
    }

    const productResult = await new sql.Request(transaction)
      .input('sku', sql.VarChar(50), resolvedSku)
      .input('name', sql.VarChar(255), resolvedName)
      .input('description', sql.VarChar(500), `Ubicacion: ; CategoriaId: ${resolvedCategory}`)
      .input('image_url', sql.VarChar(500), resolvedImageUrl)
      .input('created_by', sql.VarChar(100), resolvedUser.slice(0, 100))
      .query(`
        INSERT INTO dbo.producto (
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
        VALUES (
          @sku,
          @name,
          @description,
          @image_url,
          1,
          @created_by,
          GETDATE(),
          @created_by,
          GETDATE()
        );

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS product_id;
      `);

    const productId = Number(productResult.recordset[0]?.product_id || 0);

    if (!productId) {
      throw new Error('No se pudo crear el producto');
    }

    await new sql.Request(transaction)
      .input('product_id', sql.Int, productId)
      .input('sku', sql.VarChar(50), resolvedSku)
      .input('unit_cost', sql.Decimal(18, 4), resolvedUnitCost)
      .input('sale_price', sql.Decimal(18, 4), resolvedSalePrice)
      .input('unit_measure', sql.VarChar(50), resolvedUnitMeasure)
      .input('stock', sql.Decimal(18, 3), resolvedStock)
      .input('min_stock', sql.Decimal(18, 3), resolvedMinStock)
      .input('max_stock', sql.Decimal(18, 3), resolvedMaxStock)
      .input('category', sql.VarChar(100), resolvedCategory.slice(0, 100))
      .input('created_by', sql.VarChar(100), resolvedUser.slice(0, 100))
      .input('allows_decimal_quantity', sql.Bit, Boolean(allowsDecimalQuantity))
      .query(`
        BEGIN TRY
          SET IDENTITY_INSERT dbo.inventario ON;

          INSERT INTO dbo.inventario (
            id_inventario,
            id_pd,
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
            NUM_LOTE,
            permite_decimal
          )
          VALUES (
            @product_id,
            @product_id,
            @sku,
            @unit_cost,
            @sale_price,
            NULL,
            @unit_measure,
            @stock,
            @min_stock,
            @max_stock,
            @category,
            NULL,
            @created_by,
            GETDATE(),
            @created_by,
            GETDATE(),
            NULL,
            @allows_decimal_quantity
          );

          SET IDENTITY_INSERT dbo.inventario OFF;
        END TRY
        BEGIN CATCH
          SET IDENTITY_INSERT dbo.inventario OFF;
          THROW;
        END CATCH;
      `);

    await insertInventoryLogRecord(transaction, {
      action: 'ALTA_PRODUCTO',
      productId,
      quantity: resolvedStock,
      previousStock: 0,
      newStock: resolvedStock,
      unitCost: resolvedUnitCost,
      userId: resolvedUserId,
    });

    await new sql.Request(transaction)
      .input('product_id', sql.Int, productId)
      .input('sku', sql.NVarChar(120), resolvedSku)
      .input('created_by', sql.NVarChar(100), resolvedUser.slice(0, 100))
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM dbo.PRODUCTO_CODIGO_BARRA
          WHERE CODIGO_BARRA = @sku
        )
        BEGIN
          INSERT INTO dbo.PRODUCTO_CODIGO_BARRA (
            ID_PRODUCTO,
            CODIGO_BARRA,
            ES_PRINCIPAL,
            ACTIVO,
            CREADO_POR,
            CREADO_EN
          )
          VALUES (
            @product_id,
            @sku,
            1,
            1,
            @created_by,
            SYSDATETIME()
          );
        END;
      `);

    if (resolvedStock > LOT_QUANTITY_EPSILON) {
      await insertPurchaseLot(transaction, {
        productId,
        purchaseId: null,
        purchaseTable: 'ALTA_PRODUCTO',
        invoiceNumber: `ALTA-${productId}`,
        purchaseTimestamp: new Date().toISOString(),
        quantity: resolvedStock,
        unitCost: resolvedUnitCost,
        lotNumber: `ALTA-${resolvedSku}`.slice(0, 80),
        expiryDate: resolvedPrimaryLotExpiryDate,
        userName: resolvedUser,
      });
    }

    await insertAuditRecord(transaction, {
      tableName: 'dbo.producto',
      action: 'ALTA_PRODUCTO',
      recordKey: `id_producto=${productId}`,
      userId: resolvedUserId,
      user: resolvedUser,
      previousData: '',
      newData: `codigo=${resolvedSku}; nombre=${resolvedName}; stock=${resolvedStock}; costo=${resolvedUnitCost}; venta=${resolvedSalePrice}; categoria=${resolvedCategory}; unidad=${resolvedUnitMeasure}`,
    });

    await transaction.commit();

    return {
      product: {
        id: productId,
        sku: resolvedSku,
        barcodes: [{
          id: 0,
          productId,
          code: resolvedSku,
          isPrimary: true,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        }],
        name: resolvedName,
        description: `Ubicacion: ; CategoriaId: ${resolvedCategory}`,
        imageUrl: resolvedImageUrl,
        category: resolvedCategory,
        stock: resolvedStock,
        minStock: resolvedMinStock,
        maxStock: resolvedMaxStock,
        unitCost: resolvedUnitCost,
        salePrice: resolvedSalePrice,
        wholesalePrice: null,
        unitMeasure: resolvedUnitMeasure,
        allowsDecimalQuantity: Boolean(allowsDecimalQuantity),
        supplier: null,
        previousMonthSales: 0,
        createdBy: resolvedUser,
        updatedBy: resolvedUser,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        primaryLotNumber: null,
        primaryLotExpiryDate: resolvedPrimaryLotExpiryDate,
        activeLotCount: resolvedStock > LOT_QUANTITY_EPSILON ? 1 : 0,
        activeLotNumbers: resolvedStock > LOT_QUANTITY_EPSILON ? [`ALTA-${resolvedSku}`.slice(0, 80)] : [],
      },
    };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO ACTUALIZA LOS CAMPOS DE STOCK DE UN PRODUCTO EN dbo.inventario.
// RECIBE EL ID DEL PRODUCTO DESDE EL MODAL DE INVENTARIO EN src/app/app.ts.
// SOLO ACTUALIZA stock, stock_minimo Y stock_maximo; NO MODIFICA PRECIO, COSTO, SKU NI NOMBRE.
async function updateInventoryStockLevels({
  productId,
  sku,
  name,
  imageUrl,
  category,
  primaryLotExpiryDate,
  stock,
  minStock,
  maxStock,
  unitCost,
  salePrice,
  unitMeasure,
  allowsDecimalQuantity,
  userId,
  user,
}) {
  if (!productId || Number(productId) <= 0) {
    throw new Error('Producto requerido para actualizar inventario');
  }

  const resolvedSku = String(sku || '').trim();
  const resolvedName = String(name || '').trim();
  const resolvedCategory = String(category || 'General').trim() || 'General';
  const resolvedImageUrl = normalizeProductImageUrlForStorage(imageUrl);
  const resolvedPrimaryLotExpiryDate = normalizeNullableDate(primaryLotExpiryDate);

  if (!resolvedSku || !resolvedName) {
    throw new Error('Codigo y nombre son requeridos para actualizar el producto');
  }

  if (resolvedSku.length > 50) {
    throw new Error('El codigo del producto no puede superar 50 caracteres');
  }

  if (resolvedName.length > 255) {
    throw new Error('El nombre del producto no puede superar 255 caracteres');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId, user });
    await ensureFefoLotObjects(transaction);
    await ensureProductBarcodeObjects(transaction);

    const previousResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, Number(productId))
      .query(`
        SELECT TOP 1
          p.id_producto,
          p.nombre,
          p.codigo,
          p.descripcion,
          p.imagen_url,
          i.id_inventario,
          i.id_pd,
          i.stock,
          i.stock_minimo,
          i.stock_maximo,
          i.precio_costo,
          i.precio_venta,
          i.unidad_medida,
          ISNULL(i.permite_decimal, 0) AS permite_decimal,
          lote_principal.ID_LOTE AS LOTE_PRINCIPAL_ID,
          lote_principal.FECHA_VENCIMIENTO AS LOTE_PRINCIPAL_VENCIMIENTO
        FROM dbo.inventario i
        INNER JOIN dbo.producto p
          ON p.codigo = i.codigo
        OUTER APPLY (
          SELECT TOP 1
            l.ID_LOTE,
            l.FECHA_VENCIMIENTO
          FROM dbo.PRODUCTO_LOTE l
          WHERE l.ID_PRODUCTO = p.id_producto
            AND l.ESTADO = 'ACTIVO'
            AND ISNULL(l.CANTIDAD_DISPONIBLE, 0) > 0
          ORDER BY
            CASE WHEN l.FECHA_VENCIMIENTO IS NULL THEN 1 ELSE 0 END,
            l.FECHA_VENCIMIENTO ASC,
            l.FECHA_INGRESO ASC,
            l.ID_LOTE ASC
        ) lote_principal
        WHERE p.id_producto = @product_id;
      `);

    const previous = previousResult.recordset[0];

    if (!previous) {
      throw new Error('No se encontro el producto para actualizar inventario');
    }

    const duplicateResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, Number(productId))
      .input('sku', sql.VarChar(50), resolvedSku)
      .query(`
        SELECT TOP 1 p.id_producto
        FROM dbo.producto p
        WHERE p.id_producto <> @product_id
          AND (
            p.codigo = @sku
            OR EXISTS (
              SELECT 1
              FROM dbo.PRODUCTO_CODIGO_BARRA pcb
              WHERE pcb.ID_PRODUCTO = p.id_producto
                AND pcb.CODIGO_BARRA = @sku
            )
          );
      `);

    if (duplicateResult.recordset.length > 0) {
      throw new Error(`Ya existe otro producto con el codigo ${resolvedSku}`);
    }

    await new sql.Request(transaction)
      .input('product_id', sql.Int, Number(productId))
      .input('previous_sku', sql.NVarChar(120), previous.codigo)
      .input('sku', sql.NVarChar(120), resolvedSku)
      .input('updated_by', sql.NVarChar(100), truncateText(user || 'Sistema', 100))
      .query(`
        UPDATE dbo.PRODUCTO_CODIGO_BARRA
        SET
          ES_PRINCIPAL = 0,
          ACTUALIZADO_POR = @updated_by,
          ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_PRODUCTO = @product_id
          AND ES_PRINCIPAL = 1;

        IF EXISTS (
          SELECT 1
          FROM dbo.PRODUCTO_CODIGO_BARRA
          WHERE ID_PRODUCTO = @product_id
            AND CODIGO_BARRA = @sku
        )
        BEGIN
          UPDATE dbo.PRODUCTO_CODIGO_BARRA
          SET
            ES_PRINCIPAL = 1,
            ACTIVO = 1,
            ACTUALIZADO_POR = @updated_by,
            ACTUALIZADO_EN = SYSDATETIME()
          WHERE ID_PRODUCTO = @product_id
            AND CODIGO_BARRA = @sku;
        END
        ELSE IF EXISTS (
          SELECT 1
          FROM dbo.PRODUCTO_CODIGO_BARRA
          WHERE ID_PRODUCTO = @product_id
            AND CODIGO_BARRA = @previous_sku
        )
        BEGIN
          UPDATE dbo.PRODUCTO_CODIGO_BARRA
          SET
            CODIGO_BARRA = @sku,
            ES_PRINCIPAL = 1,
            ACTIVO = 1,
            ACTUALIZADO_POR = @updated_by,
            ACTUALIZADO_EN = SYSDATETIME()
          WHERE ID_PRODUCTO = @product_id
            AND CODIGO_BARRA = @previous_sku;
        END
        ELSE
        BEGIN
          INSERT INTO dbo.PRODUCTO_CODIGO_BARRA (
            ID_PRODUCTO,
            CODIGO_BARRA,
            ES_PRINCIPAL,
            ACTIVO,
            CREADO_POR,
            CREADO_EN
          )
          VALUES (
            @product_id,
            @sku,
            1,
            1,
            @updated_by,
            SYSDATETIME()
          );
        END;
      `);

    await new sql.Request(transaction)
      .input('product_id', sql.Int, Number(productId))
      .input('sku', sql.VarChar(50), resolvedSku)
      .input('name', sql.VarChar(255), resolvedName)
      .input('description', sql.VarChar(500), `Ubicacion: ; CategoriaId: ${truncateText(resolvedCategory, 100)}`)
      .input('image_url', sql.VarChar(500), resolvedImageUrl)
      .input('updated_by', sql.VarChar(100), truncateText(user || 'Sistema', 100))
      .query(`
        UPDATE dbo.producto
        SET
          codigo = @sku,
          nombre = @name,
          descripcion = @description,
          imagen_url = @image_url,
          actualizado_por = @updated_by,
          actualizado_en = GETDATE()
        WHERE id_producto = @product_id;
      `);

    const result = await new sql.Request(transaction)
      .input('product_id', sql.Int, Number(productId))
      .input('inventory_id', sql.Int, Number(previous.id_inventario || 0))
      .input('previous_sku', sql.VarChar(50), previous.codigo)
      .input('sku', sql.VarChar(50), resolvedSku)
      .input('stock', sql.Decimal(18, 2), Number(stock || 0))
      .input('min_stock', sql.Decimal(18, 2), Number(minStock || 0))
      .input('max_stock', sql.Decimal(18, 2), maxStock === null || maxStock === undefined ? null : Number(maxStock || 0))
      .input('unit_cost', sql.Decimal(18, 4), Number(unitCost || 0))
      .input('sale_price', sql.Decimal(18, 4), Number(salePrice || 0))
      .input('unit_measure', sql.VarChar(50), String(unitMeasure || 'Unidad').trim() || 'Unidad')
      .input('category', sql.VarChar(100), truncateText(resolvedCategory, 100))
      .input('allows_decimal_quantity', sql.Bit, Boolean(allowsDecimalQuantity))
      .query(`
        UPDATE i
        SET
          i.codigo = @sku,
          i.stock = @stock,
          i.stock_minimo = @min_stock,
          i.stock_maximo = @max_stock,
          i.precio_costo = @unit_cost,
          i.precio_venta = @sale_price,
          i.unidad_medida = @unit_measure,
          i.categoria = @category,
          i.permite_decimal = @allows_decimal_quantity,
          i.actualizado_en = GETDATE()
        FROM dbo.inventario i
        WHERE i.id_inventario = @inventory_id
           OR (
             @inventory_id <= 0
             AND (
               i.id_inventario = @product_id
               OR i.id_pd = @product_id
               OR i.codigo = @previous_sku
             )
           );

        SELECT @@ROWCOUNT AS affected_rows;
      `);

    const affectedRows = Number(result.recordset[0]?.affected_rows || 0);

    if (affectedRows === 0) {
      throw new Error('No se encontro el producto para actualizar inventario');
    }

    await ensureProductLotCoverage(transaction, Number(productId), String(user || 'Sistema').trim() || 'Sistema');

    const lotUpdateResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, Number(productId))
      .input('expiry_date', sql.Date, resolvedPrimaryLotExpiryDate)
      .query(`
        WITH lote_principal AS (
          SELECT TOP 1
            l.ID_LOTE
          FROM dbo.PRODUCTO_LOTE l
          WHERE l.ID_PRODUCTO = @product_id
            AND l.ESTADO = 'ACTIVO'
            AND ISNULL(l.CANTIDAD_DISPONIBLE, 0) > 0
          ORDER BY
            CASE WHEN l.FECHA_VENCIMIENTO IS NULL THEN 1 ELSE 0 END,
            l.FECHA_VENCIMIENTO ASC,
            l.FECHA_INGRESO ASC,
            l.ID_LOTE ASC
        )
        UPDATE l
        SET
          FECHA_VENCIMIENTO = @expiry_date,
          ACTUALIZADO_EN = SYSDATETIME()
        FROM dbo.PRODUCTO_LOTE l
        INNER JOIN lote_principal lp
          ON lp.ID_LOTE = l.ID_LOTE;

        SELECT @@ROWCOUNT AS affected_lot_rows;
      `);

    const affectedLotRows = Number(lotUpdateResult.recordset[0]?.affected_lot_rows || 0);

    await insertAuditRecord(transaction, {
      tableName: 'dbo.inventario',
      action: 'INVENTARIO',
      recordKey: `id_producto=${Number(productId)}`,
      userId: userId || null,
      user,
      previousData: previous
        ? `codigo=${previous.codigo}; producto=${previous.nombre}; imagen=${previous.imagen_url || ''}; vencimiento=${previous.LOTE_PRINCIPAL_VENCIMIENTO ? new Date(previous.LOTE_PRINCIPAL_VENCIMIENTO).toISOString().slice(0, 10) : ''}; stock=${previous.stock}; minimo=${previous.stock_minimo}; maximo=${previous.stock_maximo}; costo=${previous.precio_costo}; venta=${previous.precio_venta}; unidad=${previous.unidad_medida}; decimal=${Boolean(previous.permite_decimal)}`
        : '',
      newData: `codigo=${resolvedSku}; producto=${resolvedName}; imagen=${resolvedImageUrl || ''}; vencimiento=${resolvedPrimaryLotExpiryDate || ''}; categoria=${resolvedCategory}; stock=${Number(stock || 0)}; minimo=${Number(minStock || 0)}; maximo=${maxStock === null || maxStock === undefined ? 'NULL' : Number(maxStock || 0)}; costo=${Number(unitCost || 0)}; venta=${Number(salePrice || 0)}; unidad=${String(unitMeasure || 'Unidad').trim() || 'Unidad'}; decimal=${Boolean(allowsDecimalQuantity)}; lotes_actualizados=${affectedLotRows}`,
    });

    await insertInventoryLogRecord(transaction, {
      action: 'AJUSTE_INVENTARIO',
      productId: Number(productId),
      quantity: Math.abs(Number(stock || 0) - Number(previous?.stock || 0)),
      previousStock: Number(previous?.stock || 0),
      newStock: Number(stock || 0),
      unitCost: Number(unitCost || 0),
      userId: userId || 1,
    });

    await transaction.commit();

    return {
      productId: Number(productId),
      sku: resolvedSku,
      name: resolvedName,
      imageUrl: resolvedImageUrl,
      category: resolvedCategory,
      stock: Number(stock || 0),
      minStock: Number(minStock || 0),
      maxStock: maxStock === null || maxStock === undefined ? null : Number(maxStock || 0),
      primaryLotExpiryDate: affectedLotRows > 0 ? resolvedPrimaryLotExpiryDate : null,
      unitCost: Number(unitCost || 0),
      salePrice: Number(salePrice || 0),
      unitMeasure: String(unitMeasure || 'Unidad').trim() || 'Unidad',
      allowsDecimalQuantity: Boolean(allowsDecimalQuantity),
      affectedRows,
      affectedLotRows,
    };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

async function updateProductActiveStatus({ productId, active, userId = null, user = null } = {}) {
  const resolvedProductId = Number(productId || 0);

  if (!resolvedProductId || resolvedProductId <= 0) {
    throw new Error('Producto requerido para actualizar estado');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId, user });

    const previousResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .query(`
        SELECT TOP 1 id_producto, codigo, nombre, activo
        FROM dbo.producto
        WHERE id_producto = @product_id;
      `);

    const previous = previousResult.recordset[0];

    if (!previous) {
      throw new Error('Producto no encontrado');
    }

    const nextActive = Boolean(active);

    await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .input('active', sql.Bit, nextActive)
      .input('updated_by', sql.VarChar(100), truncateText(user || 'Sistema', 100))
      .query(`
        UPDATE dbo.producto
        SET
          activo = @active,
          actualizado_por = @updated_by,
          actualizado_en = GETDATE()
        WHERE id_producto = @product_id;
      `);

    await insertAuditRecord(transaction, {
      tableName: 'dbo.producto',
      action: nextActive ? 'ACTIVAR_PRODUCTO' : 'INACTIVAR_PRODUCTO',
      recordKey: `id_producto=${resolvedProductId}`,
      userId,
      user,
      previousData: `codigo=${previous.codigo}; nombre=${previous.nombre}; activo=${Boolean(previous.activo)}`,
      newData: `codigo=${previous.codigo}; nombre=${previous.nombre}; activo=${nextActive}`,
    });

    await transaction.commit();

    return {
      productId: resolvedProductId,
      active: nextActive,
    };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

async function assertInventoryAdminPermission(executor, { userId = null, user = null } = {}) {
  const resolvedUserId = Number(userId || 0);

  if (!resolvedUserId || resolvedUserId <= 0) {
    throw new Error('Usuario requerido para reactivar productos');
  }

  const result = await new sql.Request(executor)
    .input('user_id', sql.Int, resolvedUserId)
    .query(`
      SELECT TOP 1 usuario, nombre, rol
      FROM dbo.usuario
      WHERE id_usuario = @user_id
        AND activo = 1;
    `);

  const row = result.recordset[0];

  if (!row) {
    throw new Error('Usuario no autorizado para reactivar productos');
  }

  const roleText = String(row.rol || '').toLowerCase();
  const canManageInventory =
    roleText.includes('admin') ||
    roleText.includes('administrador') ||
    roleText.includes('inventario');

  if (!canManageInventory) {
    throw new Error('No tiene permisos de administracion de Inventario para reactivar productos');
  }

  return {
    userId: resolvedUserId,
    user: String(user || row.nombre || row.usuario || 'Sistema').trim() || 'Sistema',
  };
}

async function reactivateInventoryProduct({
  productId,
  nuevoCosto,
  nuevoPrecioVenta,
  stockReingreso,
  userId = null,
  user = null,
  resolveProductImageUrl,
} = {}) {
  const resolvedProductId = Number(productId || 0);
  const resolvedCost = Number(nuevoCosto);
  const resolvedSalePrice = Number(nuevoPrecioVenta);
  const resolvedStock = roundLotQuantity(stockReingreso);

  if (!resolvedProductId || resolvedProductId <= 0) {
    throw new Error('Producto requerido para reactivar');
  }

  if (!Number.isFinite(resolvedCost) || resolvedCost <= 0) {
    throw new Error('Nuevo costo requerido y debe ser mayor que 0');
  }

  if (!Number.isFinite(resolvedSalePrice) || resolvedSalePrice <= 0) {
    throw new Error('Nuevo precio de venta requerido y debe ser mayor que 0');
  }

  if (!Number.isFinite(resolvedStock) || resolvedStock <= LOT_QUANTITY_EPSILON) {
    throw new Error('Stock de reingreso requerido y debe ser mayor que 0');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const authorizedUser = await assertInventoryAdminPermission(transaction, { userId, user });
    await setAuditContext(transaction, authorizedUser);
    await ensureFefoLotObjects(transaction);

    const previousResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .query(`
        SELECT TOP 1
          p.id_producto,
          p.codigo,
          p.nombre,
          p.descripcion,
          p.imagen_url,
          p.activo,
          i.id_inventario,
          i.stock,
          i.stock_minimo,
          i.stock_maximo,
          i.precio_costo,
          i.precio_venta,
          i.precio_mayoreo,
          i.unidad_medida,
          ISNULL(i.permite_decimal, 0) AS permite_decimal,
          i.categoria,
          i.proveedor,
          i.creado_por,
          i.creado_en
        FROM dbo.producto p WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.inventario i WITH (UPDLOCK, ROWLOCK)
          ON i.codigo = p.codigo
        WHERE p.id_producto = @product_id;
      `);

    const previous = previousResult.recordset[0];

    if (!previous) {
      throw new Error('Producto no encontrado para reactivar');
    }

    if (Boolean(previous.activo)) {
      throw new Error('El producto ya esta activo');
    }

    await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .input('updated_by', sql.VarChar(100), truncateText(authorizedUser.user, 100))
      .query(`
        UPDATE dbo.producto
        SET
          activo = 1,
          actualizado_por = @updated_by,
          actualizado_en = GETDATE()
        WHERE id_producto = @product_id;
      `);

    await new sql.Request(transaction)
      .input('inventory_id', sql.Int, Number(previous.id_inventario || 0))
      .input('stock', sql.Decimal(18, 3), resolvedStock)
      .input('unit_cost', sql.Decimal(18, 4), resolvedCost)
      .input('sale_price', sql.Decimal(18, 4), resolvedSalePrice)
      .input('updated_by', sql.VarChar(100), truncateText(authorizedUser.user, 100))
      .query(`
        UPDATE dbo.inventario
        SET
          stock = @stock,
          precio_costo = @unit_cost,
          precio_venta = @sale_price,
          actualizado_por = @updated_by,
          actualizado_en = GETDATE()
        WHERE id_inventario = @inventory_id;
      `);

    await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .query(`
        UPDATE dbo.PRODUCTO_LOTE
        SET
          ESTADO = CASE WHEN ESTADO = 'ACTIVO' THEN 'AGOTADO' ELSE ESTADO END,
          CANTIDAD_DISPONIBLE = CASE WHEN ESTADO = 'ACTIVO' THEN 0 ELSE CANTIDAD_DISPONIBLE END,
          ACTUALIZADO_EN = SYSDATETIME()
        WHERE ID_PRODUCTO = @product_id
          AND ESTADO = 'ACTIVO';
      `);

    await insertPurchaseLot(transaction, {
      productId: resolvedProductId,
      purchaseId: null,
      purchaseTable: 'REACTIVACION_PRODUCTO',
      invoiceNumber: `REACT-${previous.codigo}`,
      purchaseTimestamp: new Date().toISOString(),
      quantity: resolvedStock,
      unitCost: resolvedCost,
      lotNumber: `REACT-${previous.codigo}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      expiryDate: null,
      userName: authorizedUser.user,
    });

    await insertInventoryLogRecord(transaction, {
      action: 'REACTIVACION_PRODUCTO',
      productId: resolvedProductId,
      quantity: resolvedStock,
      previousStock: Number(previous.stock || 0),
      newStock: resolvedStock,
      unitCost: resolvedCost,
      userId: authorizedUser.userId,
    });

    await insertAuditRecord(transaction, {
      tableName: 'dbo.producto',
      action: 'REACTIVACION_PRODUCTO',
      recordKey: `id_producto=${resolvedProductId}`,
      userId: authorizedUser.userId,
      user: authorizedUser.user,
      previousData: `codigo=${previous.codigo}; nombre=${previous.nombre}; activo=${Boolean(previous.activo)}; stock=${Number(previous.stock || 0)}; costo=${Number(previous.precio_costo || 0)}; venta=${Number(previous.precio_venta || 0)}`,
      newData: `codigo=${previous.codigo}; nombre=${previous.nombre}; activo=true; stock=${resolvedStock}; costo=${resolvedCost}; venta=${resolvedSalePrice}`,
    });

    await transaction.commit();

    return {
      productId: resolvedProductId,
      previousCost: Number(previous.precio_costo || 0),
      newCost: resolvedCost,
      previousSalePrice: Number(previous.precio_venta || 0),
      newSalePrice: resolvedSalePrice,
      previousStock: Number(previous.stock || 0),
      newStock: resolvedStock,
      movementType: 'REACTIVACION_PRODUCTO',
      product: {
        id: resolvedProductId,
        sku: previous.codigo || '',
        name: previous.nombre || 'Producto sin nombre',
        description: previous.descripcion || null,
        imageUrl: resolveProductImageUrl
          ? resolveProductImageUrl(previous.imagen_url)
          : previous.imagen_url || null,
        category: previous.categoria || 'Sin categoria',
        stock: resolvedStock,
        minStock: Number(previous.stock_minimo || 0),
        maxStock: previous.stock_maximo === null ? null : Number(previous.stock_maximo),
        unitCost: resolvedCost,
        salePrice: resolvedSalePrice,
        wholesalePrice: previous.precio_mayoreo === null ? null : Number(previous.precio_mayoreo),
        unitMeasure: previous.unidad_medida || null,
        allowsDecimalQuantity: Boolean(previous.permite_decimal),
        supplier: previous.proveedor || null,
        previousMonthSales: 0,
        createdBy: previous.creado_por || null,
        updatedBy: authorizedUser.user,
        createdAt: previous.creado_en ? new Date(previous.creado_en).toISOString() : null,
        updatedAt: new Date().toISOString(),
        primaryLotNumber: `REACT-${previous.codigo}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`.slice(0, 80),
        primaryLotExpiryDate: null,
        activeLotCount: 1,
        activeLotNumbers: [`REACT-${previous.codigo}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`.slice(0, 80)],
      },
    };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

function normalizeCutDate(date) {
  if (!date) {
    return new Date().toISOString().slice(0, 10);
  }

  const value = String(date).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

function formatSqlDateKey(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoMatch) {
    return isoMatch[1];
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function formatSqlDateTime(value, fallback = buildCurrentCutTimestamp()) {
  if (!value) {
    return fallback;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  const text = String(value).trim().replace('T', ' ');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);

  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toISOString().slice(0, 19).replace('T', ' ');
}

function buildCurrentCutTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function buildCutTimestampForDate(cutDate) {
  const now = new Date();
  const date = normalizeCutDate(cutDate);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${date} ${hours}:${minutes}:${seconds}`;
}

async function ensureDailyCutShiftColumns(executor) {
  await new sql.Request(executor).query(`
    IF COL_LENGTH('dbo.CORTE_DIARIO', 'FECHA_APERTURA') IS NULL
    BEGIN
      ALTER TABLE dbo.CORTE_DIARIO ADD FECHA_APERTURA DATETIME2 NULL;
    END;

    IF COL_LENGTH('dbo.CORTE_DIARIO', 'FECHA_CIERRE') IS NULL
    BEGIN
      ALTER TABLE dbo.CORTE_DIARIO ADD FECHA_CIERRE DATETIME2 NULL;
    END;
  `);

  await new sql.Request(executor).query(`
    UPDATE dbo.CORTE_DIARIO
    SET FECHA_APERTURA = TRY_CONVERT(datetime2, FECHA_CORTE)
    WHERE FECHA_APERTURA IS NULL
      AND TRY_CONVERT(datetime2, FECHA_CORTE) IS NOT NULL;
  `);
}

async function getLatestOpenCut(transaction, userId) {
  const result = await new sql.Request(transaction)
    .input('user_id', sql.Int, Number(userId || 0))
    .query(`
      SELECT TOP 1 *
      FROM dbo.CORTE_DIARIO
      WHERE ID_USUARIO = @user_id
        AND ESTADO_CORTE = 1
      ORDER BY ID_CORTE DESC;
    `);

  return result.recordset[0] || null;
}

function mapCutStatus(statusId) {
  const statuses = {
    1: 'Abierto',
    2: 'Cerrado',
    3: 'Anulado',
    4: 'Cerrado',
  };

  return statuses[Number(statusId)] || 'Sin estado';
}

async function getLatestOpenInitialCash(transaction, cutDate, userId) {
  const result = await new sql.Request(transaction)
    .input('cut_date', sql.VarChar(10), cutDate)
    .input('user_id', sql.Int, Number(userId))
    .query(`
      SELECT TOP 1 DINERO_INICIA_CAJA
      FROM dbo.CORTE_DIARIO
      WHERE TRY_CONVERT(date, FECHA_CORTE) = TRY_CONVERT(date, @cut_date)
        AND ID_USUARIO = @user_id
        AND ESTADO_CORTE = 1
      ORDER BY ID_CORTE DESC
    `);

  return Number(result.recordset[0]?.DINERO_INICIA_CAJA || 0);
}

async function getOpenInitialCash(transaction, cutDate, userId) {
  const resolvedUserId = Number(userId || 0);

  if (resolvedUserId > 0) {
    return getLatestOpenInitialCash(transaction, cutDate, resolvedUserId);
  }

  const result = await new sql.Request(transaction)
    .input('cut_date', sql.VarChar(10), cutDate)
    .query(`
      WITH aperturas AS (
        SELECT
          ID_USUARIO,
          DINERO_INICIA_CAJA,
          ROW_NUMBER() OVER (PARTITION BY ID_USUARIO ORDER BY ID_CORTE DESC) AS row_number
        FROM dbo.CORTE_DIARIO
        WHERE TRY_CONVERT(date, FECHA_CORTE) = TRY_CONVERT(date, @cut_date)
          AND ESTADO_CORTE = 1
      )
      SELECT ISNULL(SUM(DINERO_INICIA_CAJA), 0) AS DINERO_INICIA_CAJA
      FROM aperturas
      WHERE row_number = 1
    `);

  return Number(result.recordset[0]?.DINERO_INICIA_CAJA || 0);
}

function mapDailyCut(cut) {
  return {
    id: Number(cut.ID_CORTE),
    date: formatSqlDateKey(cut.FECHA_CORTE),
    userId: cut.ID_USUARIO === null || cut.ID_USUARIO === undefined ? null : Number(cut.ID_USUARIO),
    userName: cut.USUARIO || 'Usuario sin nombre',
    totalSales: Number(cut.VENTA_TOTAL_DIA || 0),
    initialCash: Number(cut.DINERO_INICIA_CAJA || 0),
    cashSales: Number(cut.VENTA_EFECTIVO || 0),
    transferSales: Number(cut.VENTA_TRANSFERENCIA || 0),
    creditSales: Number(cut.VENTA_CREDITO || 0),
    creditPayments: Number(cut.ABONOS_CREDITO || 0),
    cashIn: Number(cut.ENTRADA_DE_DINERO || 0),
    cashOut: Number(cut.SALIDA_DE_DINERO || 0),
    cashTotal: Number(cut.TOTAL_EN_CAJA || 0),
    statusId: Number(cut.ESTADO_CORTE || 0),
    statusName: mapCutStatus(cut.ESTADO_CORTE),
    profit: Number(cut.GANANCIA_DEL_DIA || 0),
  };
}

async function ensurePettyCashTable(executor) {
  await new sql.Request(executor).query(`
    IF OBJECT_ID('dbo.CAJA_CHICA_DIARIA', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.CAJA_CHICA_DIARIA (
        ID_CAJA_CHICA INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        FECHA DATE NOT NULL,
        MONTO_INICIAL DECIMAL(18,2) NOT NULL DEFAULT 0,
        MONTO_FINAL DECIMAL(18,2) NOT NULL DEFAULT 0,
        FACTURACION_TURNO DECIMAL(18,2) NOT NULL DEFAULT 0,
        PASA_CAJA_CHICA DECIMAL(18,2) NOT NULL DEFAULT 0,
        QUEDA_CAJA_REGISTRADORA DECIMAL(18,2) NOT NULL DEFAULT 0,
        BILLETERA_CAMBIO DECIMAL(18,2) NOT NULL DEFAULT 0,
        TOTAL_CAJA_CHICA DECIMAL(18,2) NOT NULL DEFAULT 0,
        SALIDA_CAJA DECIMAL(18,2) NOT NULL DEFAULT 0,
        MOTIVO NVARCHAR(500) NULL,
        TOTAL_REAL_CAJA DECIMAL(18,2) NOT NULL DEFAULT 0,
        COMENTARIOS NVARCHAR(500) NULL,
        BENEFICIO_DIVIDENDO DECIMAL(18,2) NOT NULL DEFAULT 0,
        CATORCEAVO_AGUINALDO DECIMAL(18,2) NOT NULL DEFAULT 0,
        ID_USUARIO INT NULL,
        FECHA_REGISTRO DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    END;
  `);
}

function mapPettyCashManualRecord(row) {
  return {
    id: Number(row.ID_CAJA_CHICA || 0),
    date: formatSqlDateKey(row.FECHA),
    initialAmount: Number(row.MONTO_INICIAL || 0),
    finalAmount: Number(row.MONTO_FINAL || 0),
    turnBilling: Number(row.FACTURACION_TURNO || 0),
    cashToPetty: Number(row.PASA_CAJA_CHICA || 0),
    registerBalance: Number(row.QUEDA_CAJA_REGISTRADORA || 0),
    changeWallet: Number(row.BILLETERA_CAMBIO || 0),
    pettyCashTotal: Number(row.TOTAL_CAJA_CHICA || 0),
    cashOut: Number(row.SALIDA_CAJA || 0),
    reason: row.MOTIVO || '',
    realCashTotal: Number(row.TOTAL_REAL_CAJA || 0),
    comments: row.COMENTARIOS || '',
    dividendBenefit: Number(row.BENEFICIO_DIVIDENDO || 0),
    fourteenthBonus: Number(row.CATORCEAVO_AGUINALDO || 0),
    userId: row.ID_USUARIO === null || row.ID_USUARIO === undefined ? null : Number(row.ID_USUARIO),
    userName: row.USUARIO || 'Registro manual',
    createdAt: row.FECHA_REGISTRO,
  };
}

async function listPettyCashRecords() {
  const pool = await getPool();
  await ensurePettyCashTable(pool);

  const result = await pool.request().query(`
    SELECT
      cc.*,
      u.nombre AS USUARIO
    FROM dbo.CAJA_CHICA_DIARIA cc
    LEFT JOIN dbo.usuario u
      ON u.id_usuario = cc.ID_USUARIO
    ORDER BY cc.FECHA DESC, cc.ID_CAJA_CHICA DESC;
  `);

  return result.recordset.map(mapPettyCashManualRecord);
}

async function createPettyCashRecord(payload = {}) {
  const pool = await getPool();
  await ensurePettyCashTable(pool);
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const date = normalizeCutDate(payload.date);
    const requestUserId = payload.userId ? Number(payload.userId) : null;

    if (requestUserId) {
      await setAuditContext(transaction, { userId: requestUserId });
    }

    const result = await new sql.Request(transaction)
      .input('fecha', sql.VarChar(10), date)
      .input('monto_inicial', sql.Decimal(18, 2), Number(payload.initialAmount || 0))
      .input('monto_final', sql.Decimal(18, 2), Number(payload.finalAmount || 0))
      .input('facturacion_turno', sql.Decimal(18, 2), Number(payload.turnBilling || 0))
      .input('pasa_caja_chica', sql.Decimal(18, 2), Number(payload.cashToPetty || 0))
      .input('queda_caja_registradora', sql.Decimal(18, 2), Number(payload.registerBalance || 0))
      .input('billetera_cambio', sql.Decimal(18, 2), Number(payload.changeWallet || 0))
      .input('total_caja_chica', sql.Decimal(18, 2), Number(payload.pettyCashTotal || 0))
      .input('salida_caja', sql.Decimal(18, 2), Number(payload.cashOut || 0))
      .input('motivo', sql.NVarChar(500), truncateText(payload.reason || '', 500))
      .input('total_real_caja', sql.Decimal(18, 2), Number(payload.realCashTotal || 0))
      .input('comentarios', sql.NVarChar(500), truncateText(payload.comments || '', 500))
      .input('beneficio_dividendo', sql.Decimal(18, 2), Number(payload.dividendBenefit || 0))
      .input('catorceavo_aguinaldo', sql.Decimal(18, 2), Number(payload.fourteenthBonus || 0))
      .input('user_id', sql.Int, userId)
      .query(`
        INSERT INTO dbo.CAJA_CHICA_DIARIA (
          FECHA,
          MONTO_INICIAL,
          MONTO_FINAL,
          FACTURACION_TURNO,
          PASA_CAJA_CHICA,
          QUEDA_CAJA_REGISTRADORA,
          BILLETERA_CAMBIO,
          TOTAL_CAJA_CHICA,
          SALIDA_CAJA,
          MOTIVO,
          TOTAL_REAL_CAJA,
          COMENTARIOS,
          BENEFICIO_DIVIDENDO,
          CATORCEAVO_AGUINALDO,
          ID_USUARIO
        )
        VALUES (
          @fecha,
          @monto_inicial,
          @monto_final,
          @facturacion_turno,
          @pasa_caja_chica,
          @queda_caja_registradora,
          @billetera_cambio,
          @total_caja_chica,
          @salida_caja,
          @motivo,
          @total_real_caja,
          @comentarios,
          @beneficio_dividendo,
          @catorceavo_aguinaldo,
          @user_id
        );

        SELECT
          cc.*,
          u.nombre AS USUARIO
        FROM dbo.CAJA_CHICA_DIARIA cc
        LEFT JOIN dbo.usuario u
          ON u.id_usuario = cc.ID_USUARIO
        WHERE cc.ID_CAJA_CHICA = CAST(SCOPE_IDENTITY() AS INT);
      `);

    await insertAuditRecord(transaction, {
      tableName: 'CAJA_CHICA_DIARIA',
      action: 'INSERT',
      recordKey: String(result.recordset[0]?.ID_CAJA_CHICA || ''),
      userId,
      newData: JSON.stringify(payload),
    });

    await transaction.commit();
    return mapPettyCashManualRecord(result.recordset[0]);
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

async function updatePettyCashRecord(id, payload = {}) {
  const pool = await getPool();
  await ensurePettyCashTable(pool);
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const recordId = Number(id || 0);
    const date = normalizeCutDate(payload.date);
    const requestUserId = payload.userId ? Number(payload.userId) : null;

    if (!recordId || recordId <= 0) {
      throw new Error('Registro de caja chica invalido');
    }

    if (requestUserId) {
      await setAuditContext(transaction, { userId: requestUserId });
    }

    const previous = await new sql.Request(transaction)
      .input('id', sql.Int, recordId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.CAJA_CHICA_DIARIA
        WHERE ID_CAJA_CHICA = @id;
      `);

    if (!previous.recordset[0]) {
      throw new Error('No se encontro el registro de caja chica');
    }

    const result = await new sql.Request(transaction)
      .input('id', sql.Int, recordId)
      .input('fecha', sql.VarChar(10), date)
      .input('monto_inicial', sql.Decimal(18, 2), Number(payload.initialAmount || 0))
      .input('monto_final', sql.Decimal(18, 2), Number(payload.finalAmount || 0))
      .input('facturacion_turno', sql.Decimal(18, 2), Number(payload.turnBilling || 0))
      .input('pasa_caja_chica', sql.Decimal(18, 2), Number(payload.cashToPetty || 0))
      .input('queda_caja_registradora', sql.Decimal(18, 2), Number(payload.registerBalance || 0))
      .input('billetera_cambio', sql.Decimal(18, 2), Number(payload.changeWallet || 0))
      .input('total_caja_chica', sql.Decimal(18, 2), Number(payload.pettyCashTotal || 0))
      .input('salida_caja', sql.Decimal(18, 2), Number(payload.cashOut || 0))
      .input('motivo', sql.NVarChar(500), truncateText(payload.reason || '', 500))
      .input('total_real_caja', sql.Decimal(18, 2), Number(payload.realCashTotal || 0))
      .input('comentarios', sql.NVarChar(500), truncateText(payload.comments || '', 500))
      .input('beneficio_dividendo', sql.Decimal(18, 2), Number(payload.dividendBenefit || 0))
      .input('catorceavo_aguinaldo', sql.Decimal(18, 2), Number(payload.fourteenthBonus || 0))
      .input('user_id', sql.Int, userId)
      .query(`
        UPDATE dbo.CAJA_CHICA_DIARIA
        SET
          FECHA = @fecha,
          MONTO_INICIAL = @monto_inicial,
          MONTO_FINAL = @monto_final,
          FACTURACION_TURNO = @facturacion_turno,
          PASA_CAJA_CHICA = @pasa_caja_chica,
          QUEDA_CAJA_REGISTRADORA = @queda_caja_registradora,
          BILLETERA_CAMBIO = @billetera_cambio,
          TOTAL_CAJA_CHICA = @total_caja_chica,
          SALIDA_CAJA = @salida_caja,
          MOTIVO = @motivo,
          TOTAL_REAL_CAJA = @total_real_caja,
          COMENTARIOS = @comentarios,
          BENEFICIO_DIVIDENDO = @beneficio_dividendo,
          CATORCEAVO_AGUINALDO = @catorceavo_aguinaldo,
          ID_USUARIO = COALESCE(@user_id, ID_USUARIO)
        WHERE ID_CAJA_CHICA = @id;

        SELECT
          cc.*,
          u.nombre AS USUARIO
        FROM dbo.CAJA_CHICA_DIARIA cc
        LEFT JOIN dbo.usuario u
          ON u.id_usuario = cc.ID_USUARIO
        WHERE cc.ID_CAJA_CHICA = @id;
      `);

    await insertAuditRecord(transaction, {
      tableName: 'CAJA_CHICA_DIARIA',
      action: 'UPDATE',
      recordKey: String(recordId),
      userId,
      previousData: JSON.stringify(previous.recordset[0]),
      newData: JSON.stringify(payload),
    });

    await transaction.commit();
    return mapPettyCashManualRecord(result.recordset[0]);
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

async function deletePettyCashRecord(id, userId = null) {
  const pool = await getPool();
  await ensurePettyCashTable(pool);
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const recordId = Number(id || 0);
    const resolvedUserId = userId ? Number(userId) : null;

    if (!recordId || recordId <= 0) {
      throw new Error('Registro de caja chica invalido');
    }

    if (resolvedUserId) {
      await setAuditContext(transaction, { userId: resolvedUserId });
    }

    const previous = await new sql.Request(transaction)
      .input('id', sql.Int, recordId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.CAJA_CHICA_DIARIA
        WHERE ID_CAJA_CHICA = @id;
      `);

    if (!previous.recordset[0]) {
      throw new Error('No se encontro el registro de caja chica');
    }

    await new sql.Request(transaction)
      .input('id', sql.Int, recordId)
      .query(`
        DELETE FROM dbo.CAJA_CHICA_DIARIA
        WHERE ID_CAJA_CHICA = @id;
      `);

    await insertAuditRecord(transaction, {
      tableName: 'CAJA_CHICA_DIARIA',
      action: 'DELETE',
      recordKey: String(recordId),
      userId: resolvedUserId,
      previousData: JSON.stringify(previous.recordset[0]),
    });

    await transaction.commit();
    return { id: recordId, deleted: true };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA LOS CORTES DIARIOS DESDE dbo.CORTE_DIARIO.
// SI RECIBE dateFrom Y dateTo, FILTRA EL HISTORICO POR RANGO DE FECHAS.
// SI RECIBE ID_USUARIO, FILTRA SOLO LOS CORTES DE ESE TURNO.
async function listDailyCuts(dateFrom, dateTo, userId) {
  const pool = await getPool();
  await ensureDailyCutShiftColumns(pool);
  const cutDateFrom = dateFrom ? normalizeCutDate(dateFrom) : null;
  const cutDateTo = dateTo ? normalizeCutDate(dateTo) : null;
  const request = pool.request();
  const filters = [];

  if (cutDateFrom) {
    request.input('cut_date_from', sql.VarChar(10), cutDateFrom);
    filters.push('TRY_CONVERT(date, cd.FECHA_CORTE) >= TRY_CONVERT(date, @cut_date_from)');
  }

  if (cutDateTo) {
    request.input('cut_date_to', sql.VarChar(10), cutDateTo);
    filters.push('TRY_CONVERT(date, cd.FECHA_CORTE) <= TRY_CONVERT(date, @cut_date_to)');
  }

  if (userId !== null && userId !== undefined && userId !== '') {
    request.input('user_id', sql.Int, Number(userId));
    filters.push('cd.ID_USUARIO = @user_id');
  }

  const result = await request.query(`
    SELECT
      cd.ID_CORTE,
      cd.FECHA_CORTE,
      cd.ID_USUARIO,
      cd.VENTA_TOTAL_DIA,
      cd.DINERO_INICIA_CAJA,
      cd.VENTA_EFECTIVO,
      cd.VENTA_TRANSFERENCIA,
      cd.VENTA_CREDITO,
      cd.ABONOS_CREDITO,
      cd.ENTRADA_DE_DINERO,
      cd.SALIDA_DE_DINERO,
      cd.TOTAL_EN_CAJA,
      cd.ESTADO_CORTE,
      cd.GANANCIA_DEL_DIA,
      u.nombre AS USUARIO
    FROM dbo.CORTE_DIARIO cd
    LEFT JOIN dbo.usuario u
      ON u.id_usuario = cd.ID_USUARIO
    ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
    ORDER BY cd.ID_CORTE DESC
  `);

  for (const cut of result.recordset.filter((item) => Number(item.ESTADO_CORTE || 0) === 1)) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const totals = await calculateShiftCutTotals(transaction, cut);
      const preservedCashOut = Number(cut.SALIDA_DE_DINERO || totals.cashOut || 0);
      const recalculatedCashTotal = Number((
        Number(cut.DINERO_INICIA_CAJA || totals.initialCash || 0) +
        Number(totals.cashSales || 0) +
        Number(totals.creditPayments || 0) +
        Number(totals.cashIn || 0) -
        preservedCashOut
      ).toFixed(2));

      await new sql.Request(transaction)
        .input('id_corte', sql.Int, Number(cut.ID_CORTE))
        .input('venta_total_dia', sql.Decimal(18, 2), totals.totalSales)
        .input('venta_efectivo', sql.Decimal(18, 2), totals.cashSales)
        .input('venta_transferencia', sql.Decimal(18, 2), totals.transferSales)
        .input('venta_credito', sql.Decimal(18, 2), totals.creditSales)
        .input('abonos_credito', sql.Decimal(18, 2), totals.creditPayments)
        .input('entrada_de_dinero', sql.Decimal(18, 2), totals.cashIn)
        .input('salida_de_dinero', sql.Decimal(18, 2), preservedCashOut)
        .input('total_en_caja', sql.Decimal(18, 2), recalculatedCashTotal)
        .input('ganancia_del_dia', sql.Decimal(18, 2), totals.profit)
        .query(`
          UPDATE dbo.CORTE_DIARIO
          SET
            VENTA_TOTAL_DIA = @venta_total_dia,
            VENTA_EFECTIVO = @venta_efectivo,
            VENTA_TRANSFERENCIA = @venta_transferencia,
            VENTA_CREDITO = @venta_credito,
            ABONOS_CREDITO = @abonos_credito,
            ENTRADA_DE_DINERO = @entrada_de_dinero,
            SALIDA_DE_DINERO = @salida_de_dinero,
            TOTAL_EN_CAJA = @total_en_caja,
            GANANCIA_DEL_DIA = @ganancia_del_dia
          WHERE ID_CORTE = @id_corte
            AND ESTADO_CORTE = 1;
        `);

      cut.VENTA_TOTAL_DIA = totals.totalSales;
      cut.VENTA_EFECTIVO = totals.cashSales;
      cut.VENTA_TRANSFERENCIA = totals.transferSales;
      cut.VENTA_CREDITO = totals.creditSales;
      cut.ABONOS_CREDITO = totals.creditPayments;
      cut.ENTRADA_DE_DINERO = totals.cashIn;
      cut.SALIDA_DE_DINERO = preservedCashOut;
      cut.TOTAL_EN_CAJA = recalculatedCashTotal;
      cut.GANANCIA_DEL_DIA = totals.profit;

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  return result.recordset.map(mapDailyCut);
}

async function updateDailyCutCashManagement(id, payload = {}) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const cutId = Number(id || 0);
    const requestUserId = payload.userId ? Number(payload.userId) : null;
    const cutDate = normalizeCutDate(payload.date);
    const initialCash = Number(payload.initialAmount || 0);
    const physicalCash = Number(payload.finalAmount || 0);
    const cashOut = Number(payload.cashOut || 0);

    if (!cutId || cutId <= 0) {
      throw new Error('Corte invalido para actualizar caja chica');
    }

    if (!Number.isFinite(initialCash) || !Number.isFinite(physicalCash) || !Number.isFinite(cashOut)) {
      throw new Error('Montos invalidos para actualizar el corte');
    }

    if (requestUserId) {
      await setAuditContext(transaction, { userId: requestUserId });
    }

    const previous = await new sql.Request(transaction)
      .input('id_corte', sql.Int, cutId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.CORTE_DIARIO
        WHERE ID_CORTE = @id_corte;
      `);

    const previousCut = previous.recordset[0];

    if (!previousCut) {
      throw new Error('No se encontro el corte original');
    }

    const auditUserId = requestUserId || Number(previousCut.ID_USUARIO || 0) || 1;
    const previousTime = String(previousCut.FECHA_CORTE || '').match(/\b(\d{2}:\d{2}:\d{2})\b/)?.[1] || '00:00:00';
    const cutTimestamp = `${cutDate} ${previousTime}`;

    const result = await new sql.Request(transaction)
      .input('id_corte', sql.Int, cutId)
      .input('fecha_corte', sql.VarChar(40), cutTimestamp)
      .input('dinero_inicia_caja', sql.Decimal(18, 2), initialCash)
      .input('salida_de_dinero', sql.Decimal(18, 2), cashOut)
      .input('total_en_caja', sql.Decimal(18, 2), physicalCash)
      .query(`
        UPDATE dbo.CORTE_DIARIO
        SET
          FECHA_CORTE = @fecha_corte,
          DINERO_INICIA_CAJA = @dinero_inicia_caja,
          SALIDA_DE_DINERO = @salida_de_dinero,
          TOTAL_EN_CAJA = @total_en_caja,
          ESTADO_CORTE = CASE
            WHEN TRY_CONVERT(date, @fecha_corte) < CAST(GETDATE() AS date) THEN 4
            ELSE ESTADO_CORTE
          END
        WHERE ID_CORTE = @id_corte;

        SELECT TOP 1
          cd.*,
          u.nombre AS USUARIO
        FROM dbo.CORTE_DIARIO cd
        LEFT JOIN dbo.usuario u
          ON u.id_usuario = cd.ID_USUARIO
        WHERE cd.ID_CORTE = @id_corte;
      `);

    await insertAuditRecord(transaction, {
      tableName: 'CORTE_DIARIO',
      action: 'UPDATE',
      recordKey: String(cutId),
      userId: auditUserId,
      previousData: JSON.stringify(previousCut),
      newData: JSON.stringify({
        date: cutDate,
        initialCash,
        physicalCash,
        cashOut,
      }),
    });

    await transaction.commit();
    return mapDailyCut(result.recordset[0]);
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

async function deleteDailyCutCashManagement(id, userId = null) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const cutId = Number(id || 0);
    const requestUserId = userId ? Number(userId) : null;

    if (!cutId || cutId <= 0) {
      throw new Error('Corte invalido para eliminar');
    }

    if (requestUserId) {
      await setAuditContext(transaction, { userId: requestUserId });
    }

    const previous = await new sql.Request(transaction)
      .input('id_corte', sql.Int, cutId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.CORTE_DIARIO
        WHERE ID_CORTE = @id_corte;
      `);

    if (!previous.recordset[0]) {
      throw new Error('No se encontro el corte para eliminar');
    }

    const resolvedUserId = requestUserId || Number(previous.recordset[0].ID_USUARIO || 0) || 1;

    await new sql.Request(transaction)
      .input('id_corte', sql.Int, cutId)
      .query(`
        DELETE FROM dbo.CORTE_DIARIO
        WHERE ID_CORTE = @id_corte;
      `);

    await insertAuditRecord(transaction, {
      tableName: 'CORTE_DIARIO',
      action: 'DELETE',
      recordKey: String(cutId),
      userId: resolvedUserId,
      previousData: JSON.stringify(previous.recordset[0]),
    });

    await transaction.commit();
    return { id: cutId, deleted: true };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA LOS PAGOS DE CREDITO DEL DIA DESDE dbo.PAGOS_CREDITO.
// SI RECIBE ID_USUARIO, FILTRA SOLO LOS ABONOS DEL TURNO DE ESE USUARIO.
// SE USA PARA MOSTRAR ABONOS EN EL MODAL DE CORTE.
async function listCreditPaymentsByDate(date, userId) {
  const pool = await getPool();
  await ensureCreditPaymentMethodColumn(pool.request());
  const cutDate = normalizeCutDate(date);
  const request = pool.request()
    .input('cut_date', sql.VarChar(10), cutDate);

  if (userId !== null && userId !== undefined && userId !== '') {
    request.input('user_id', sql.Int, Number(userId));
  }

  const result = await request
    .query(`
      WITH rango_dia AS (
        SELECT
          DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), SYSUTCDATETIME()), CAST(TRY_CONVERT(date, @cut_date) AS datetime2)) AS INICIO_UTC,
          DATEADD(DAY, 1, DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), SYSUTCDATETIME()), CAST(TRY_CONVERT(date, @cut_date) AS datetime2))) AS FIN_UTC
      )
      SELECT
        pc.ID_PAGO_CREDITO,
        pc.DESCRIPCION_PAGO,
        pc.MONTO,
        pc.ID_CLIENTE,
        CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')) AS CLIENTE,
        pc.ID_FACTURA,
        pc.ID_USUARIO,
        pc.FORMA_ABONO,
        u.nombre AS USUARIO,
        pc.FECHA_HORA
      FROM dbo.PAGOS_CREDITO pc
      LEFT JOIN dbo.cliente c
        ON c.ID_CLIENTE = pc.ID_CLIENTE
      LEFT JOIN dbo.usuario u
        ON u.id_usuario = pc.ID_USUARIO
      CROSS JOIN rango_dia
      WHERE TRY_CONVERT(datetime2, pc.FECHA_HORA) >= rango_dia.INICIO_UTC
        AND TRY_CONVERT(datetime2, pc.FECHA_HORA) < rango_dia.FIN_UTC
      ${userId !== null && userId !== undefined && userId !== '' ? 'AND pc.ID_USUARIO = @user_id' : ''}
      ORDER BY pc.ID_PAGO_CREDITO DESC
    `);

  return result.recordset.map((payment) => ({
    id: Number(payment.ID_PAGO_CREDITO),
    description: payment.DESCRIPCION_PAGO,
    amount: Number(payment.MONTO || 0),
    paymentMethod: normalizeCreditPaymentMethod(payment.FORMA_ABONO),
    customerId: Number(payment.ID_CLIENTE || 0),
    customerName: String(payment.CLIENTE || '').trim() || 'Cliente sin nombre',
    invoiceId: Number(payment.ID_FACTURA || 0),
    userId: Number(payment.ID_USUARIO || 0),
    userName: payment.USUARIO || 'Usuario sin nombre',
    createdAt: payment.FECHA_HORA,
  }));
}

async function listCreditPaymentsHistory(limit = 1000) {
  const pool = await getPool();
  await ensureCreditPaymentMethodColumn(pool.request());
  const safeLimit = Math.min(Math.max(Number(limit || 1000), 1), 5000);
  const result = await pool.request()
    .input('limit', sql.Int, safeLimit)
    .query(`
      SELECT TOP (@limit)
        pc.ID_PAGO_CREDITO,
        pc.DESCRIPCION_PAGO,
        pc.MONTO,
        pc.ID_CLIENTE,
        CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')) AS CLIENTE,
        pc.ID_FACTURA,
        pc.ID_USUARIO,
        pc.FORMA_ABONO,
        u.nombre AS USUARIO,
        pc.FECHA_HORA
      FROM dbo.PAGOS_CREDITO pc
      LEFT JOIN dbo.cliente c
        ON c.ID_CLIENTE = pc.ID_CLIENTE
      LEFT JOIN dbo.usuario u
        ON u.id_usuario = pc.ID_USUARIO
      WHERE ISNULL(pc.MONTO, 0) > 0
      ORDER BY TRY_CONVERT(datetime2, pc.FECHA_HORA) DESC, pc.ID_PAGO_CREDITO DESC
    `);

  return result.recordset.map((payment) => ({
    id: Number(payment.ID_PAGO_CREDITO),
    description: payment.DESCRIPCION_PAGO,
    amount: Number(payment.MONTO || 0),
    paymentMethod: normalizeCreditPaymentMethod(payment.FORMA_ABONO),
    customerId: Number(payment.ID_CLIENTE || 0),
    customerName: String(payment.CLIENTE || '').trim() || 'Cliente sin nombre',
    invoiceId: Number(payment.ID_FACTURA || 0),
    userId: Number(payment.ID_USUARIO || 0),
    userName: payment.USUARIO || 'Usuario sin nombre',
    createdAt: payment.FECHA_HORA,
  }));
}

async function listCreditPaymentsByCustomer(customerId) {
  const resolvedCustomerId = Number(customerId || 0);

  if (!resolvedCustomerId || resolvedCustomerId <= 0) {
    throw new Error('Cliente requerido para consultar historico de abonos');
  }

  const pool = await getPool();
  await ensureCreditPaymentMethodColumn(pool.request());
  const result = await pool.request()
    .input('customer_id', sql.Int, resolvedCustomerId)
    .query(`
      SELECT
        MIN(pc.ID_PAGO_CREDITO) AS ID_PAGO_CREDITO,
        pc.DESCRIPCION_PAGO,
        SUM(CAST(pc.MONTO AS DECIMAL(18,2))) AS MONTO,
        pc.ID_CLIENTE,
        CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')) AS CLIENTE,
        MIN(pc.ID_FACTURA) AS ID_FACTURA,
        pc.ID_USUARIO,
        pc.FORMA_ABONO,
        u.nombre AS USUARIO,
        pc.FECHA_HORA,
        COUNT(*) AS FACTURAS_AFECTADAS
      FROM dbo.PAGOS_CREDITO pc
      LEFT JOIN dbo.cliente c
        ON c.ID_CLIENTE = pc.ID_CLIENTE
      LEFT JOIN dbo.usuario u
        ON u.id_usuario = pc.ID_USUARIO
      WHERE pc.ID_CLIENTE = @customer_id
        AND ISNULL(pc.MONTO, 0) > 0
      GROUP BY
        pc.ID_CLIENTE,
        c.NOMBRE,
        c.APELLIDO,
        pc.DESCRIPCION_PAGO,
        pc.ID_USUARIO,
        pc.FORMA_ABONO,
        u.nombre,
        pc.FECHA_HORA
      ORDER BY TRY_CONVERT(datetime2, pc.FECHA_HORA) DESC, MIN(pc.ID_PAGO_CREDITO) DESC
    `);

  return result.recordset.map((payment) => ({
    id: Number(payment.ID_PAGO_CREDITO),
    description: payment.DESCRIPCION_PAGO,
    amount: Number(payment.MONTO || 0),
    paymentMethod: normalizeCreditPaymentMethod(payment.FORMA_ABONO),
    customerId: Number(payment.ID_CLIENTE || 0),
    customerName: String(payment.CLIENTE || '').trim() || 'Cliente sin nombre',
    invoiceId: Number(payment.ID_FACTURA || 0),
    userId: Number(payment.ID_USUARIO || 0),
    userName: payment.USUARIO || 'Usuario sin nombre',
    createdAt: payment.FECHA_HORA,
    invoicesTouched: Number(payment.FACTURAS_AFECTADAS || 1),
  }));
}

async function calculateDailyCutTotals(transaction, date, userId, initialCashOverride) {
  const cutDate = normalizeCutDate(date);
  const resolvedUserId = Number(userId || 0);
  await ensureCreditPaymentMethodColumn(new sql.Request(transaction));

  const request = new sql.Request(transaction)
    .input('cut_date', sql.VarChar(10), cutDate);

  if (resolvedUserId > 0) {
    request.input('user_id', sql.Int, resolvedUserId);
  }

  const result = await request.query(`
      WITH rango_dia AS (
        SELECT
          DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), SYSUTCDATETIME()), CAST(TRY_CONVERT(date, @cut_date) AS datetime2)) AS INICIO_UTC,
          DATEADD(DAY, 1, DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), SYSUTCDATETIME()), CAST(TRY_CONVERT(date, @cut_date) AS datetime2))) AS FIN_UTC
      ),
      ventas AS (
        SELECT
          ve.PRECIO_VENTA * ve.CANT_PD AS total,
          ve.UTILIDAD AS utilidad,
          1 AS id_tp,
          ve.FECHA_HORA,
          f.ID_USUARIO
        FROM dbo.VENTA_EFECTIVO ve
        INNER JOIN dbo.FACTURA f
          ON f.ID_FACT = ve.ID_FACT
        WHERE ISNULL(ve.ID_ESTADO_VENTA, 0) <> 3

        UNION ALL

        SELECT
          vc.PRECIO_VENTA * vc.CANT_PD AS total,
          vc.UTILIDAD AS utilidad,
          2 AS id_tp,
          vc.FECHA_HORA,
          f.ID_USUARIO
        FROM dbo.VENTA_CREDITO vc
        INNER JOIN dbo.FACTURA f
          ON f.ID_FACT = vc.ID_FACT
        WHERE ISNULL(vc.ID_ESTADO_VENTA, 0) <> 3

        UNION ALL

        SELECT
          vt.PRECIO_VENTA * vt.CANT_PD AS total,
          vt.UTILIDAD AS utilidad,
          3 AS id_tp,
          vt.FECHA_HORA,
          f.ID_USUARIO
        FROM dbo.VENTA_TRANSFERENCIA vt
        INNER JOIN dbo.FACTURA f
          ON f.ID_FACT = vt.ID_FACT
        WHERE ISNULL(vt.ID_ESTADO_VENTA, 0) <> 3
      )
      SELECT
        ISNULL(SUM(total), 0) AS venta_total_dia,
        ISNULL(SUM(CASE WHEN id_tp = 1 THEN total ELSE 0 END), 0) AS venta_efectivo,
        ISNULL(SUM(CASE WHEN id_tp = 2 THEN total ELSE 0 END), 0) AS venta_credito,
        ISNULL(SUM(CASE WHEN id_tp = 3 THEN total ELSE 0 END), 0) AS venta_transferencia,
        ISNULL(SUM(utilidad), 0) AS ganancia_del_dia,
        ISNULL((
          SELECT SUM(pc.MONTO)
          FROM dbo.PAGOS_CREDITO pc
          CROSS JOIN rango_dia
          WHERE TRY_CONVERT(datetime2, pc.FECHA_HORA) >= rango_dia.INICIO_UTC
            AND TRY_CONVERT(datetime2, pc.FECHA_HORA) < rango_dia.FIN_UTC
            AND LOWER(ISNULL(pc.FORMA_ABONO, 'efectivo')) = 'efectivo'
            ${resolvedUserId > 0 ? 'AND pc.ID_USUARIO = @user_id' : ''}
        ), 0) AS abonos_credito
      FROM ventas
      CROSS JOIN rango_dia
      WHERE TRY_CONVERT(datetime2, ventas.FECHA_HORA) >= rango_dia.INICIO_UTC
        AND TRY_CONVERT(datetime2, ventas.FECHA_HORA) < rango_dia.FIN_UTC
        ${resolvedUserId > 0 ? 'AND ventas.ID_USUARIO = @user_id' : ''}
    `);

  const totals = result.recordset[0] || {};
  const initialCash = initialCashOverride === null || initialCashOverride === undefined
    ? await getOpenInitialCash(transaction, cutDate, resolvedUserId)
    : Number(initialCashOverride || 0);
  const cashIn = 0;
  const cashOut = 0;
  const cashSales = Number(totals.venta_efectivo || 0);
  const creditPayments = Number(totals.abonos_credito || 0);

  return {
    cutDate,
    userId: resolvedUserId > 0 ? resolvedUserId : null,
    totalSales: Number(totals.venta_total_dia || 0),
    initialCash,
    cashSales,
    transferSales: Number(totals.venta_transferencia || 0),
    creditSales: Number(totals.venta_credito || 0),
    creditPayments,
    cashIn,
    cashOut,
    cashTotal: initialCash + cashSales + creditPayments + cashIn - cashOut,
    profit: Number(totals.ganancia_del_dia || 0),
  };
}

async function calculateShiftCutTotals(transaction, openCut, endTimestamp = buildCurrentCutTimestamp()) {
  await ensureCreditPaymentMethodColumn(new sql.Request(transaction));
  const resolvedUserId = Number(openCut.ID_USUARIO || 0);
  const startTimestamp = formatSqlDateTime(openCut.FECHA_APERTURA || openCut.FECHA_CORTE);
  const safeEndTimestamp = formatSqlDateTime(endTimestamp);

  const result = await new sql.Request(transaction)
    .input('start_local', sql.VarChar(19), startTimestamp)
    .input('end_local', sql.VarChar(19), safeEndTimestamp)
    .input('user_id', sql.Int, resolvedUserId)
    .query(`
      WITH rango_turno AS (
        SELECT
          DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), SYSUTCDATETIME()), TRY_CONVERT(datetime2, @start_local)) AS INICIO_UTC,
          DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), SYSUTCDATETIME()), TRY_CONVERT(datetime2, @end_local)) AS FIN_UTC
      ),
      ventas AS (
        SELECT ve.PRECIO_VENTA * ve.CANT_PD AS total, ve.UTILIDAD AS utilidad, 1 AS id_tp, ve.FECHA_HORA, f.ID_USUARIO
        FROM dbo.VENTA_EFECTIVO ve
        INNER JOIN dbo.FACTURA f ON f.ID_FACT = ve.ID_FACT
        WHERE ISNULL(ve.ID_ESTADO_VENTA, 0) <> 3

        UNION ALL

        SELECT vc.PRECIO_VENTA * vc.CANT_PD AS total, vc.UTILIDAD AS utilidad, 2 AS id_tp, vc.FECHA_HORA, f.ID_USUARIO
        FROM dbo.VENTA_CREDITO vc
        INNER JOIN dbo.FACTURA f ON f.ID_FACT = vc.ID_FACT
        WHERE ISNULL(vc.ID_ESTADO_VENTA, 0) <> 3

        UNION ALL

        SELECT vt.PRECIO_VENTA * vt.CANT_PD AS total, vt.UTILIDAD AS utilidad, 3 AS id_tp, vt.FECHA_HORA, f.ID_USUARIO
        FROM dbo.VENTA_TRANSFERENCIA vt
        INNER JOIN dbo.FACTURA f ON f.ID_FACT = vt.ID_FACT
        WHERE ISNULL(vt.ID_ESTADO_VENTA, 0) <> 3
      )
      SELECT
        ISNULL(SUM(total), 0) AS venta_total_dia,
        ISNULL(SUM(CASE WHEN id_tp = 1 THEN total ELSE 0 END), 0) AS venta_efectivo,
        ISNULL(SUM(CASE WHEN id_tp = 2 THEN total ELSE 0 END), 0) AS venta_credito,
        ISNULL(SUM(CASE WHEN id_tp = 3 THEN total ELSE 0 END), 0) AS venta_transferencia,
        ISNULL(SUM(utilidad), 0) AS ganancia_del_dia,
        ISNULL((
          SELECT SUM(pc.MONTO)
          FROM dbo.PAGOS_CREDITO pc
          CROSS JOIN rango_turno
          WHERE TRY_CONVERT(datetime2, pc.FECHA_HORA) >= rango_turno.INICIO_UTC
            AND TRY_CONVERT(datetime2, pc.FECHA_HORA) <= rango_turno.FIN_UTC
            AND LOWER(ISNULL(pc.FORMA_ABONO, 'efectivo')) = 'efectivo'
            AND pc.ID_USUARIO = @user_id
        ), 0) AS abonos_credito
      FROM ventas
      CROSS JOIN rango_turno
      WHERE TRY_CONVERT(datetime2, ventas.FECHA_HORA) >= rango_turno.INICIO_UTC
        AND TRY_CONVERT(datetime2, ventas.FECHA_HORA) <= rango_turno.FIN_UTC
        AND ventas.ID_USUARIO = @user_id;
    `);

  const totals = result.recordset[0] || {};
  const initialCash = Number(openCut.DINERO_INICIA_CAJA || 0);
  const cashIn = Number(openCut.ENTRADA_DE_DINERO || 0);
  const cashOut = Number(openCut.SALIDA_DE_DINERO || 0);
  const cashSales = Number(totals.venta_efectivo || 0);
  const creditPayments = Number(totals.abonos_credito || 0);

  return {
    cutDate: formatSqlDateKey(openCut.FECHA_CORTE),
    userId: resolvedUserId,
    totalSales: Number(totals.venta_total_dia || 0),
    initialCash,
    cashSales,
    transferSales: Number(totals.venta_transferencia || 0),
    creditSales: Number(totals.venta_credito || 0),
    creditPayments,
    cashIn,
    cashOut,
    cashTotal: initialCash + cashSales + creditPayments + cashIn - cashOut,
    profit: Number(totals.ganancia_del_dia || 0),
    startTimestamp,
    endTimestamp: safeEndTimestamp,
  };
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO GUARDA EL INICIO DE CAJA EN dbo.CORTE_DIARIO.
// SE EJECUTA DESPUES DEL LOGIN Y CREA UN CORTE ABIERTO CON ESTADO_CORTE = 1.
// EL REGISTRO QUEDA ASOCIADO AL ID_USUARIO QUE INICIO EL TURNO.
async function createOpeningCut(date, initialCash, userId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await ensureDailyCutShiftColumns(transaction);
    await setAuditContext(transaction, { userId });

    const cash = Number(initialCash || 0);

    if (!Number.isFinite(cash) || cash < 0) {
      throw new Error('Monto inicial de caja invalido');
    }

    const resolvedUserId = Number(userId || 0);

    if (!resolvedUserId || resolvedUserId <= 0) {
      throw new Error('Usuario requerido para abrir el turno');
    }

    const existingOpenCut = await getLatestOpenCut(transaction, resolvedUserId);

    if (existingOpenCut) {
      await transaction.commit();
      return mapDailyCut(existingOpenCut);
    }

    const totals = await calculateDailyCutTotals(transaction, date, resolvedUserId, cash);
    const cutTimestamp = buildCurrentCutTimestamp();
    const result = await new sql.Request(transaction)
      .input('fecha_corte', sql.VarChar(40), cutTimestamp)
      .input('fecha_apertura', sql.VarChar(40), cutTimestamp)
      .input('user_id', sql.Int, resolvedUserId)
      .input('venta_total_dia', sql.Decimal(18, 2), totals.totalSales)
      .input('dinero_inicia_caja', sql.Decimal(18, 2), cash)
      .input('venta_efectivo', sql.Decimal(18, 2), totals.cashSales)
      .input('venta_transferencia', sql.Decimal(18, 2), totals.transferSales)
      .input('venta_credito', sql.Decimal(18, 2), totals.creditSales)
      .input('abonos_credito', sql.Decimal(18, 2), totals.creditPayments)
      .input('entrada_de_dinero', sql.Decimal(18, 2), totals.cashIn)
      .input('salida_de_dinero', sql.Decimal(18, 2), totals.cashOut)
      .input('total_en_caja', sql.Decimal(18, 2), totals.cashTotal)
      .input('estado_corte', sql.Int, 1)
      .input('ganancia_del_dia', sql.Decimal(18, 2), totals.profit)
      .query(`
        INSERT INTO dbo.CORTE_DIARIO (
          FECHA_CORTE,
          FECHA_APERTURA,
          ID_USUARIO,
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
          GANANCIA_DEL_DIA
        )
        VALUES (
          @fecha_corte,
          TRY_CONVERT(datetime2, @fecha_apertura),
          @user_id,
          @venta_total_dia,
          @dinero_inicia_caja,
          @venta_efectivo,
          @venta_transferencia,
          @venta_credito,
          @abonos_credito,
          @entrada_de_dinero,
          @salida_de_dinero,
          @total_en_caja,
          @estado_corte,
          @ganancia_del_dia
        );

        SELECT TOP 1
          cd.*,
          u.nombre AS USUARIO
        FROM dbo.CORTE_DIARIO cd
        LEFT JOIN dbo.usuario u
          ON u.id_usuario = cd.ID_USUARIO
        WHERE cd.ID_CORTE = CAST(SCOPE_IDENTITY() AS INT);
      `);

    await transaction.commit();
    return mapDailyCut(result.recordset[0]);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO REGISTRA UNA COMPRA EN dbo.COMPRA_EFECTIVO O dbo.COMPRA_CREDITO.
// GUARDA HISTORICO DE COMPRA, ID_TP, ID_PROVEEDOR, NUM_FACT, ID_USUARIO E ID_ESTADO_COMPRA.
async function purchaseRealCostColumnsExist(transaction, purchaseTable) {
  const result = await new sql.Request(transaction)
    .input('table_name', sql.VarChar(128), purchaseTable.replace(/^dbo\./i, ''))
    .query(`
      SELECT
        CASE
          WHEN COL_LENGTH('dbo.' + @table_name, 'COSTO_TRANSPORTE_TOTAL') IS NOT NULL
           AND COL_LENGTH('dbo.' + @table_name, 'OTROS_COSTOS_DIRECTOS') IS NOT NULL
           AND COL_LENGTH('dbo.' + @table_name, 'COSTO_ADICIONAL_UNIDAD') IS NOT NULL
           AND COL_LENGTH('dbo.' + @table_name, 'COSTO_REAL_UNITARIO') IS NOT NULL
          THEN 1
          ELSE 0
        END AS has_columns
    `);

  return Number(result.recordset[0]?.has_columns || 0) === 1;
}

async function registerPurchase({
  userId,
  paymentTypeId,
  supplierId,
  invoiceNumber,
  purchaseDate,
  lines,
  transportCost = 0,
  otherDirectCost = 0,
}) {
  if (!userId || Number(userId) <= 0) {
    throw new Error('Usuario requerido para registrar compra');
  }

  if (!paymentTypeId || !resolvePurchaseTable(paymentTypeId)) {
    throw new Error('Tipo de compra no valido');
  }

  if (!supplierId || Number(supplierId) <= 0) {
    throw new Error('Proveedor requerido para registrar compra');
  }

  if (!invoiceNumber || !String(invoiceNumber).trim()) {
    throw new Error('Numero de factura requerido');
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Agrega al menos un producto a la compra');
  }

  const purchaseTable = resolvePurchaseTable(paymentTypeId);
  const totalPurchasedUnits = lines.reduce((total, line) => total + Number(line.quantity || 0), 0);
  const resolvedTransportCost = Number(transportCost || 0);
  const resolvedOtherDirectCost = Number(otherDirectCost || 0);
  const totalAdditionalCost = Math.max(resolvedTransportCost, 0) + Math.max(resolvedOtherDirectCost, 0);
  const additionalCostPerUnit = totalPurchasedUnits > 0 ? totalAdditionalCost / totalPurchasedUnits : 0;
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId });
    await ensureFefoLotObjects(transaction);

    const purchaseTimestamp = resolvePurchaseTimestamp(purchaseDate);
    let firstPurchaseId = null;
    const hasRealCostColumns = await purchaseRealCostColumnsExist(transaction, purchaseTable);

    for (const line of lines) {
      if (!line.productId || !line.quantity || Number(line.quantity) <= 0 || !line.unitCost || Number(line.unitCost) <= 0) {
        throw new Error('Linea de compra invalida');
      }

      const baseUnitCost = Number(line.unitCost);
      const realUnitCost = Number((baseUnitCost + additionalCostPerUnit).toFixed(4));
      const request = new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.productId))
        .input('quantity', sql.Decimal(18, 3), roundLotQuantity(line.quantity))
        .input('unit_cost', sql.Decimal(18, 4), realUnitCost)
        .input('user_id', sql.Int, Number(userId))
        .input('purchase_timestamp', sql.VarChar(40), purchaseTimestamp)
        .input('payment_type_id', sql.Int, Number(paymentTypeId))
        .input('supplier_id', sql.Int, Number(supplierId))
        .input('purchase_status_id', sql.Int, 4)
        .input('invoice_number', sql.VarChar(80), String(invoiceNumber).trim());

      let result;

      if (hasRealCostColumns) {
        result = await request
          .input('transport_cost', sql.Decimal(18, 2), resolvedTransportCost)
          .input('other_direct_cost', sql.Decimal(18, 2), resolvedOtherDirectCost)
          .input('additional_unit_cost', sql.Decimal(18, 4), additionalCostPerUnit)
          .input('real_unit_cost', sql.Decimal(18, 4), realUnitCost)
          .query(`
            INSERT INTO ${purchaseTable} (
              ID_PD,
              CANT_PD,
              PRECIO_COSTO,
              ID_USUARIO,
              FECHA_HORA,
              ID_TP,
              ID_PROVEEDOR,
              ID_ESTADO_COMPRA,
              NUM_FACT,
              COSTO_TRANSPORTE_TOTAL,
              OTROS_COSTOS_DIRECTOS,
              COSTO_ADICIONAL_UNIDAD,
              COSTO_REAL_UNITARIO
            )
            VALUES (
              @product_id,
              @quantity,
              @unit_cost,
              @user_id,
              @purchase_timestamp,
              @payment_type_id,
              @supplier_id,
              @purchase_status_id,
              @invoice_number,
              @transport_cost,
              @other_direct_cost,
              @additional_unit_cost,
              @real_unit_cost
            );

            SELECT CAST(SCOPE_IDENTITY() AS INT) AS inserted_purchase_id;
          `);
      } else {
        result = await request.query(`
          INSERT INTO ${purchaseTable} (
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
          VALUES (
            @product_id,
            @quantity,
            @unit_cost,
            @user_id,
            @purchase_timestamp,
            @payment_type_id,
            @supplier_id,
            @purchase_status_id,
            @invoice_number
          );

          SELECT CAST(SCOPE_IDENTITY() AS INT) AS inserted_purchase_id;
        `);
      }

      if (firstPurchaseId === null) {
        firstPurchaseId = Number(result.recordset[0]?.inserted_purchase_id || 0);
      }

      const insertedPurchaseId = Number(result.recordset[0]?.inserted_purchase_id || 0);

      const inventoryUpdateResult = await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.productId))
        .input('quantity', sql.Decimal(18, 3), roundLotQuantity(line.quantity))
        .input('real_unit_cost', sql.Decimal(18, 4), realUnitCost)
        .query(`
          UPDATE i
          SET
            precio_costo = CASE
              WHEN ISNULL(i.stock, 0) + @quantity <= 0 THEN @real_unit_cost
              ELSE ((ISNULL(i.stock, 0) * ISNULL(i.precio_costo, @real_unit_cost)) + (@quantity * @real_unit_cost)) / (ISNULL(i.stock, 0) + @quantity)
            END,
            stock = ISNULL(i.stock, 0) + @quantity,
            actualizado_en = SYSDATETIME()
          OUTPUT
            deleted.stock AS STOCK_ANT,
            inserted.stock AS STOCK_ACT,
            inserted.precio_costo AS PRECIO_COSTO
          FROM dbo.inventario i
          INNER JOIN dbo.producto p
            ON p.codigo = i.codigo
          WHERE p.id_producto = @product_id
        `);

      const stockRow = inventoryUpdateResult.recordset[0];
      await insertInventoryLogRecord(transaction, {
        action: 'COMPRA',
        productId: Number(line.productId),
        quantity: Number(line.quantity),
        previousStock: Number(stockRow?.STOCK_ANT || 0),
        newStock: Number(stockRow?.STOCK_ACT || 0),
        unitCost: realUnitCost,
        userId,
        date: purchaseTimestamp,
        customerId: null,
        paymentTypeId: Number(paymentTypeId),
      });

      await insertPurchaseLot(transaction, {
        productId: Number(line.productId),
        purchaseId: insertedPurchaseId,
        purchaseTable,
        invoiceNumber,
        purchaseTimestamp,
        quantity: Number(line.quantity),
        unitCost: realUnitCost,
        lotNumber: line.lotNumber || '',
        expiryDate: line.expiryDate || null,
        userName: `Usuario ${userId}`,
      });
    }

    await insertAuditRecord(transaction, {
      tableName: purchaseTable,
      action: 'COMPRA',
      recordKey: `NUM_FACT=${String(invoiceNumber).trim()}`,
      userId,
      previousData: '',
      newData: `factura=${String(invoiceNumber).trim()}; proveedor=${supplierId}; productos=${lines.length}; unidades=${totalPurchasedUnits}; costo_adicional=${Number(totalAdditionalCost.toFixed(2))}`,
    });

    await transaction.commit();

    return {
      purchaseId: firstPurchaseId,
      purchaseTable,
      paymentTypeId: Number(paymentTypeId),
      supplierId: Number(supplierId),
      invoiceNumber: String(invoiceNumber).trim(),
      savedLines: lines.length,
      transportCost: resolvedTransportCost,
      otherDirectCost: resolvedOtherDirectCost,
      additionalCostPerUnit: Number(additionalCostPerUnit.toFixed(4)),
      savedAt: purchaseTimestamp,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function ensureQuickInventorySupplier(pool) {
  const supplierName = 'Ingreso rapido inventario';
  const existing = await pool.request()
    .input('name', sql.VarChar(120), supplierName)
    .query(`
      SELECT TOP 1 ID_PROVEEDOR
      FROM dbo.proveedor
      WHERE LOWER(LTRIM(RTRIM(NOMBRE))) = LOWER(LTRIM(RTRIM(@name)))
      ORDER BY ID_PROVEEDOR ASC
    `);

  if (existing.recordset[0]?.ID_PROVEEDOR) {
    return Number(existing.recordset[0].ID_PROVEEDOR);
  }

  const inserted = await pool.request()
    .input('name', sql.VarChar(120), supplierName)
    .query(`
      INSERT INTO dbo.proveedor (
        NOMBRE,
        TELEFONO,
        DIRECCION,
        CREDITO_ABIERTO,
        COMPRAS_REALIZADAS,
        FECHA_HORA
      )
      VALUES (
        @name,
        '',
        'Registro automatico',
        0,
        0,
        SYSDATETIME()
      );

      SELECT CAST(SCOPE_IDENTITY() AS INT) AS ID_PROVEEDOR;
    `);

  return Number(inserted.recordset[0]?.ID_PROVEEDOR || 0);
}

async function getNextQuickInventoryInvoiceNumber(pool) {
  const result = await pool.request().query(`
    SELECT ISNULL(MAX(ID_COMPRA), 0) + 1 AS NEXT_ID
    FROM (
      SELECT ID_CEFECT AS ID_COMPRA FROM dbo.COMPRA_EFECTIVO
      UNION ALL
      SELECT ID_CCD AS ID_COMPRA FROM dbo.COMPRA_CREDITO
    ) purchases;
  `);
  const nextId = Number(result.recordset[0]?.NEXT_ID || 1);
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RAP-${dateKey}-${String(nextId).padStart(4, '0')}`;
}

async function registerQuickInventoryPurchase({
  productId,
  quantity,
  unitCost,
  expiryDate,
  userId,
}) {
  const resolvedProductId = Number(productId || 0);
  const resolvedQuantity = Number(quantity || 0);
  const resolvedUnitCost = Number(unitCost || 0);
  const resolvedUserId = Number(userId || 0);

  if (!resolvedUserId || resolvedUserId <= 0) {
    throw new Error('Usuario requerido para ingreso rapido');
  }

  if (!resolvedProductId || resolvedProductId <= 0) {
    throw new Error('Producto requerido para ingreso rapido');
  }

  if (!Number.isFinite(resolvedQuantity) || resolvedQuantity <= 0) {
    throw new Error('Cantidad de stock invalida');
  }

  if (!Number.isFinite(resolvedUnitCost) || resolvedUnitCost <= 0) {
    throw new Error('Costo de compra invalido');
  }

  const pool = await getPool();
  const productResult = await pool.request()
    .input('product_id', sql.Int, resolvedProductId)
    .query(`
      SELECT TOP 1 id_producto, codigo, nombre
      FROM dbo.producto
      WHERE id_producto = @product_id
    `);

  const product = productResult.recordset[0];

  if (!product) {
    throw new Error('Producto no encontrado para ingreso rapido');
  }

  const supplierId = await ensureQuickInventorySupplier(pool);
  const invoiceNumber = await getNextQuickInventoryInvoiceNumber(pool);
  const purchaseDate = new Date().toISOString().slice(0, 10);
  const purchase = await registerPurchase({
    userId: resolvedUserId,
    paymentTypeId: 1,
    supplierId,
    invoiceNumber,
    purchaseDate,
    lines: [{
      productId: resolvedProductId,
      quantity: resolvedQuantity,
      unitCost: resolvedUnitCost,
      lotNumber: `RAP-${String(product.codigo || resolvedProductId).slice(0, 24)}-${invoiceNumber.slice(-4)}`,
      expiryDate: normalizeNullableDate(expiryDate),
    }],
  });

  return {
    ...purchase,
    productId: resolvedProductId,
    productName: product.nombre,
    quantity: resolvedQuantity,
    unitCost: resolvedUnitCost,
    expiryDate: normalizeNullableDate(expiryDate),
  };
}

async function registerQuickInventoryReduction({
  productId,
  quantity,
  reason,
  userId,
}) {
  const resolvedProductId = Number(productId || 0);
  const resolvedQuantity = roundLotQuantity(quantity);
  const resolvedUserId = Number(userId || 0);
  const resolvedReason = truncateText(String(reason || '').trim(), 160);

  if (!resolvedUserId || resolvedUserId <= 0) {
    throw new Error('Usuario requerido para rebajar inventario');
  }

  if (!resolvedProductId || resolvedProductId <= 0) {
    throw new Error('Producto requerido para rebajar inventario');
  }

  if (!Number.isFinite(resolvedQuantity) || resolvedQuantity <= 0) {
    throw new Error('Cantidad de rebaja invalida');
  }

  if (!resolvedReason) {
    throw new Error('Selecciona una razon para rebajar inventario');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await setAuditContext(transaction, { userId: resolvedUserId });
    await ensureFefoLotObjects(transaction);

    const userName = await resolveUserName(transaction, resolvedUserId) || 'Sistema';
    await deductInventoryLotsFefo(transaction, {
      productId: resolvedProductId,
      quantity: resolvedQuantity,
      userName,
    });

    const stockResult = await new sql.Request(transaction)
      .input('product_id', sql.Int, resolvedProductId)
      .input('quantity', sql.Decimal(18, 3), resolvedQuantity)
      .query(`
        UPDATE i
        SET
          i.stock = i.stock - @quantity,
          i.actualizado_en = SYSDATETIME()
        OUTPUT
          inserted.codigo AS CODIGO,
          deleted.stock AS STOCK_ANT,
          inserted.stock AS STOCK_ACT,
          inserted.precio_costo AS PRECIO_COSTO,
          p.nombre AS NOMBRE_PRODUCTO
        FROM dbo.inventario i
        INNER JOIN dbo.producto p
          ON p.codigo = i.codigo
        WHERE p.id_producto = @product_id
          AND ISNULL(i.stock, 0) >= @quantity;
      `);

    const stockRow = stockResult.recordset[0];

    if (!stockRow) {
      throw new Error('Stock insuficiente para rebajar inventario');
    }

    const now = new Date().toISOString();

    await insertInventoryLogRecord(transaction, {
      action: `REBAJA_${resolvedReason}`,
      productId: resolvedProductId,
      quantity: resolvedQuantity,
      previousStock: Number(stockRow.STOCK_ANT || 0),
      newStock: Number(stockRow.STOCK_ACT || 0),
      unitCost: Number(stockRow.PRECIO_COSTO || 0),
      userId: resolvedUserId,
      date: now,
    });

    await insertAuditRecord(transaction, {
      tableName: 'dbo.inventario',
      action: 'REBAJA_INVENTARIO',
      recordKey: `id_producto=${resolvedProductId}`,
      userId: resolvedUserId,
      user: userName,
      previousData: `stock=${Number(stockRow.STOCK_ANT || 0)}`,
      newData: `stock=${Number(stockRow.STOCK_ACT || 0)}; cantidad=${resolvedQuantity}; razon=${resolvedReason}`,
    });

    await transaction.commit();

    return {
      productId: resolvedProductId,
      productName: stockRow.NOMBRE_PRODUCTO || '',
      quantity: resolvedQuantity,
      reason: resolvedReason,
      previousStock: Number(stockRow.STOCK_ANT || 0),
      newStock: Number(stockRow.STOCK_ACT || 0),
      unitCost: Number(stockRow.PRECIO_COSTO || 0),
      savedAt: now,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function resolvePurchaseTimestamp(purchaseDate) {
  if (!purchaseDate) {
    return new Date().toISOString();
  }

  const rawDate = String(purchaseDate).trim();
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? new Date(`${rawDate}T12:00:00`)
    : new Date(rawDate);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Fecha de compra no valida');
  }

  return parsedDate.toISOString();
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CALCULA EL CORTE DEL DIA SIN INSERTAR EN dbo.CORTE_DIARIO.
// SE USA PARA MOSTRAR EL RESUMEN ACTUAL AUNQUE NO EXISTA UN CORTE GUARDADO.
// EL CALCULO SE HACE SOLO CON LAS VENTAS Y ABONOS DEL ID_USUARIO INDICADO.
async function previewDailyCut(date, userId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await ensureDailyCutShiftColumns(transaction);
    const resolvedUserId = Number(userId || 0);
    const openCut = resolvedUserId > 0 ? await getLatestOpenCut(transaction, resolvedUserId) : null;
    const totals = openCut
      ? await calculateShiftCutTotals(transaction, openCut)
      : await calculateDailyCutTotals(transaction, date, resolvedUserId);
    const userResult = resolvedUserId > 0
      ? await new sql.Request(transaction)
          .input('user_id', sql.Int, resolvedUserId)
          .query(`
            SELECT TOP 1 nombre
            FROM dbo.usuario
            WHERE id_usuario = @user_id
          `)
      : { recordset: [] };
    await transaction.commit();

    return {
      id: openCut ? Number(openCut.ID_CORTE) : 0,
      date: totals.cutDate,
      userId: resolvedUserId > 0 ? resolvedUserId : null,
      userName: userResult.recordset[0]?.nombre || 'Todos los cajeros',
      totalSales: totals.totalSales,
      initialCash: totals.initialCash,
      cashSales: totals.cashSales,
      transferSales: totals.transferSales,
      creditSales: totals.creditSales,
      creditPayments: totals.creditPayments,
      cashIn: totals.cashIn,
      cashOut: totals.cashOut,
      cashTotal: totals.cashTotal,
      statusId: openCut ? Number(openCut.ESTADO_CORTE || 1) : 1,
      statusName: openCut ? mapCutStatus(openCut.ESTADO_CORTE) : 'Abierto',
      profit: totals.profit,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO GENERA UN CORTE DIARIO EN dbo.CORTE_DIARIO.
// CALCULA VENTAS POR TIPO DE PAGO Y ABONOS DESDE dbo.PAGOS_CREDITO PARA LA FECHA INDICADA.
// ANTES DE INSERTAR EL CORTE CERRADO, CAMBIA A ESTADO_CORTE = 4 CUALQUIER CORTE ABIERTO
// DEL MISMO DIA Y DEL MISMO ID_USUARIO.
async function createDailyCut(date, physicalCashCount, userId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await ensureDailyCutShiftColumns(transaction);
    const resolvedUserId = Number(userId || 0);

    if (!resolvedUserId || resolvedUserId <= 0) {
      throw new Error('Usuario requerido para cerrar el turno');
    }

    await setAuditContext(transaction, { userId: resolvedUserId });

    const openCut = await getLatestOpenCut(transaction, resolvedUserId);
    const closeTimestamp = buildCurrentCutTimestamp();
    const totals = openCut
      ? await calculateShiftCutTotals(transaction, openCut, closeTimestamp)
      : await calculateDailyCutTotals(transaction, date, resolvedUserId);
    const cashTotal = physicalCashCount === null || physicalCashCount === undefined || physicalCashCount === ''
      ? totals.cashTotal
      : Number(physicalCashCount);
    const calculatedCashTotal = Number(totals.cashTotal.toFixed(2));
    const countedCashTotal = Number(cashTotal.toFixed(2));
    const cashDifference = Number((countedCashTotal - calculatedCashTotal).toFixed(2));
    const cutTimestamp = openCut ? String(openCut.FECHA_CORTE || buildCutTimestampForDate(totals.cutDate)) : buildCutTimestampForDate(totals.cutDate);

    if (openCut) {
      const result = await new sql.Request(transaction)
        .input('id_corte', sql.Int, Number(openCut.ID_CORTE))
        .input('venta_total_dia', sql.Decimal(18, 2), totals.totalSales)
        .input('dinero_inicia_caja', sql.Decimal(18, 2), totals.initialCash)
        .input('venta_efectivo', sql.Decimal(18, 2), totals.cashSales)
        .input('venta_transferencia', sql.Decimal(18, 2), totals.transferSales)
        .input('venta_credito', sql.Decimal(18, 2), totals.creditSales)
        .input('abonos_credito', sql.Decimal(18, 2), totals.creditPayments)
        .input('entrada_de_dinero', sql.Decimal(18, 2), totals.cashIn)
        .input('salida_de_dinero', sql.Decimal(18, 2), totals.cashOut)
        .input('total_en_caja', sql.Decimal(18, 2), countedCashTotal)
        .input('estado_corte', sql.Int, 4)
        .input('ganancia_del_dia', sql.Decimal(18, 2), totals.profit)
        .input('diferencia', sql.Decimal(18, 2), cashDifference)
        .input('total_calculado', sql.Decimal(18, 2), calculatedCashTotal)
        .input('fecha_cierre', sql.VarChar(40), closeTimestamp)
        .query(`
          UPDATE dbo.CORTE_DIARIO
          SET
            VENTA_TOTAL_DIA = @venta_total_dia,
            DINERO_INICIA_CAJA = @dinero_inicia_caja,
            VENTA_EFECTIVO = @venta_efectivo,
            VENTA_TRANSFERENCIA = @venta_transferencia,
            VENTA_CREDITO = @venta_credito,
            ABONOS_CREDITO = @abonos_credito,
            ENTRADA_DE_DINERO = @entrada_de_dinero,
            SALIDA_DE_DINERO = @salida_de_dinero,
            TOTAL_EN_CAJA = @total_en_caja,
            ESTADO_CORTE = @estado_corte,
            GANANCIA_DEL_DIA = @ganancia_del_dia,
            DIFERENCIA = @diferencia,
            TOTAL_CALCULADO = @total_calculado,
            FECHA_CIERRE = TRY_CONVERT(datetime2, @fecha_cierre)
          WHERE ID_CORTE = @id_corte;

          SELECT TOP 1
            cd.*,
            u.nombre AS USUARIO
          FROM dbo.CORTE_DIARIO cd
          LEFT JOIN dbo.usuario u
            ON u.id_usuario = cd.ID_USUARIO
          WHERE cd.ID_CORTE = @id_corte;
        `);

      await transaction.commit();
      return mapDailyCut(result.recordset[0]);
    }

    const result = await new sql.Request(transaction)
      .input('fecha_corte', sql.VarChar(40), cutTimestamp)
      .input('fecha_apertura', sql.VarChar(40), cutTimestamp)
      .input('fecha_cierre', sql.VarChar(40), closeTimestamp)
      .input('user_id', sql.Int, resolvedUserId)
      .input('venta_total_dia', sql.Decimal(18, 2), totals.totalSales)
      .input('dinero_inicia_caja', sql.Decimal(18, 2), totals.initialCash)
      .input('venta_efectivo', sql.Decimal(18, 2), totals.cashSales)
      .input('venta_transferencia', sql.Decimal(18, 2), totals.transferSales)
      .input('venta_credito', sql.Decimal(18, 2), totals.creditSales)
      .input('abonos_credito', sql.Decimal(18, 2), totals.creditPayments)
      .input('entrada_de_dinero', sql.Decimal(18, 2), totals.cashIn)
      .input('salida_de_dinero', sql.Decimal(18, 2), totals.cashOut)
      .input('total_en_caja', sql.Decimal(18, 2), countedCashTotal)
      .input('estado_corte', sql.Int, 4)
      .input('ganancia_del_dia', sql.Decimal(18, 2), totals.profit)
      .input('diferencia', sql.Decimal(18, 2), cashDifference)
      .input('total_calculado', sql.Decimal(18, 2), calculatedCashTotal)
      .query(`
        INSERT INTO dbo.CORTE_DIARIO (
          FECHA_CORTE,
          FECHA_APERTURA,
          FECHA_CIERRE,
          ID_USUARIO,
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
          DIFERENCIA,
          TOTAL_CALCULADO
        )
        VALUES (
          @fecha_corte,
          TRY_CONVERT(datetime2, @fecha_apertura),
          TRY_CONVERT(datetime2, @fecha_cierre),
          @user_id,
          @venta_total_dia,
          @dinero_inicia_caja,
          @venta_efectivo,
          @venta_transferencia,
          @venta_credito,
          @abonos_credito,
          @entrada_de_dinero,
          @salida_de_dinero,
          @total_en_caja,
          @estado_corte,
          @ganancia_del_dia,
          @diferencia,
          @total_calculado
        );

        SELECT TOP 1
          cd.*,
          u.nombre AS USUARIO
        FROM dbo.CORTE_DIARIO cd
        LEFT JOIN dbo.usuario u
          ON u.id_usuario = cd.ID_USUARIO
        WHERE cd.ID_CORTE = CAST(SCOPE_IDENTITY() AS INT);
      `);

    await transaction.commit();
    return mapDailyCut(result.recordset[0]);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA EL HISTORICO REAL DE dbo.auditoria.
// LEE LAS COLUMNAS DISPONIBLES DE LA TABLA PARA SOPORTAR DIFERENTES ESTRUCTURAS.
// GENERA registros normalizados para mostrarlos en el modulo Historico de src/app/app.html.
async function listAuditHistory(limit = 200) {
  const safeLimit = Math.min(Math.max(Number(limit || 200), 1), 500);
  const pool = await getPool();
  await ensureAuditTimestampSupport(pool);
  const metadata = await pool.request().query(`
    IF OBJECT_ID('dbo.auditoria', 'U') IS NULL
    BEGIN
      SELECT CAST(NULL AS sysname) AS column_name, CAST(0 AS int) AS column_id
      WHERE 1 = 0;
      RETURN;
    END;

    SELECT name AS column_name, column_id
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.auditoria', 'U')
    ORDER BY column_id;
  `);

  const columns = metadata.recordset.map((column) => String(column.column_name));

  if (columns.length === 0) {
    return [];
  }

  const columnSet = new Set(columns.map((column) => column.toLowerCase()));
  const firstExistingColumn = (candidates) => candidates.find((column) => columnSet.has(column.toLowerCase()));
  const orderColumn = firstExistingColumn([
    'id_auditoria',
    'id',
    'ID_AUDITORIA',
    'ID_AUD',
    'ID',
    'fecha_hora',
    'fecha',
    'registrado_en',
    'creado_en',
  ]) || columns[0];
  const auditDateColumn = firstExistingColumn([
    'fecha_hora',
    'fecha',
    'registrado_en',
    'creado_en',
    'FECHA_HORA',
    'FECHA',
  ]);

  const result = await pool.request().query(`
    SELECT TOP (${safeLimit})
      *,
      ${auditDateColumn ? `CONVERT(varchar(19), TRY_CONVERT(datetime2, ${sqlColumnName(auditDateColumn)}), 126)` : 'CAST(NULL AS varchar(19))'} AS __AUDIT_DATE
    FROM dbo.auditoria
    ORDER BY ${sqlColumnName(orderColumn)} DESC;
  `);

  const rawUserIds = [
    ...new Set(result.recordset
      .map((row) => row.id_usuario ?? row.usuario_id ?? row.ID_USUARIO ?? row.ID_USER)
      .filter((value) => value !== null && value !== undefined && Number(value) > 0)
      .map((value) => Number(value))),
  ];
  const userNamesById = new Map();

  if (rawUserIds.length > 0) {
    const usersRequest = pool.request();
    rawUserIds.forEach((userId, index) => usersRequest.input(`user_id_${index}`, sql.Int, userId));
    const usersResult = await usersRequest.query(`
      SELECT id_usuario, nombre, usuario
      FROM dbo.usuario
      WHERE id_usuario IN (${rawUserIds.map((_, index) => `@user_id_${index}`).join(', ')})
    `);

    for (const user of usersResult.recordset) {
      userNamesById.set(Number(user.id_usuario), String(user.nombre || user.usuario || '').trim());
    }
  }

  return result.recordset.map((row, index) => {
    const rowKeysByLowerName = new Map(Object.keys(row).map((key) => [key.toLowerCase(), key]));
    const pick = (candidates) => {
      for (const candidate of candidates) {
        const key = rowKeysByLowerName.get(String(candidate).toLowerCase());

        if (!key) {
          continue;
        }

        return row[key];
      }

      return null;
    };
    const pickFirstValue = (candidates) => {
      for (const candidate of candidates) {
        const key = rowKeysByLowerName.get(String(candidate).toLowerCase());

        if (!key) {
          continue;
        }

        const value = row[key];

        if (value !== null && value !== undefined && String(value).trim() !== '') {
          return value;
        }
      }

      return null;
    };
    const rawDate = pickFirstValue(['__AUDIT_DATE', 'fecha_hora', 'fecha', 'registrado_en', 'creado_en', 'FECHA_HORA', 'FECHA']);
    const rawUserId = pick(['id_usuario', 'usuario_id', 'ID_USUARIO', 'ID_USER']);
    const userName = pick(['usuario', 'usuario_bd', 'creado_por', 'USUARIO']);
    const resolvedUserId = rawUserId === null ? null : Number(rawUserId);
    const resolvedUserName = resolvedUserId ? userNamesById.get(resolvedUserId) : '';

    return {
      id: Number(pick(['id_auditoria', 'id', 'ID_AUDITORIA', 'ID_AUD', 'ID']) || index + 1),
      tableName: String(pick(['tabla', 'nombre_tabla', 'tabla_afectada', 'TABLA_AFECTADA', 'TABLA']) || 'Sin tabla'),
      action: String(pick(['accion', 'operacion', 'tipo_movimiento', 'ACCION']) || 'MOVIMIENTO'),
      recordKey: pick(['clave', 'llave', 'id_registro', 'registro_id', 'registro']) === null
        ? ''
        : String(pick(['clave', 'llave', 'id_registro', 'registro_id', 'registro'])),
      user: String(resolvedUserName || userName || (rawUserId === null ? 'Sistema' : `Usuario ID ${rawUserId}`)),
      userId: rawUserId === null
        ? null
        : Number(rawUserId),
      date: rawDate instanceof Date ? formatSqlLocalDateTime(rawDate) : (rawDate ? String(rawDate).replace(' ', 'T') : null),
      previousData: String(pick(['dato_anterior', 'DATO_ANTERIOR']) || ''),
      newData: String(pick(['dato_nuevo', 'DATO_NUEVO']) || ''),
    };
  });
}

async function createAuditHistoryRecord(payload = {}) {
  const pool = await getPool();
  await insertAuditRecord(pool, {
    tableName: String(payload.tableName || 'sistema').trim(),
    action: String(payload.action || 'MOVIMIENTO').trim(),
    recordKey: String(payload.recordKey || '').trim(),
    userId: payload.userId ? Number(payload.userId) : null,
    user: payload.user ? String(payload.user) : null,
    previousData: String(payload.previousData || ''),
    newData: String(payload.newData || ''),
  });

  return { ok: true };
}

function mapAnalyticsMoney(value) {
  return Number(value || 0);
}

function mapAnalyticsVariation(currentValue, previousValue) {
  const current = mapAnalyticsMoney(currentValue);
  const previous = mapAnalyticsMoney(previousValue);

  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function resolveProfitabilityStatus(netMargin) {
  if (netMargin >= 25) {
    return { label: 'Excelente', level: 'excellent' };
  }

  if (netMargin >= 15) {
    return { label: 'Buena', level: 'good' };
  }

  if (netMargin >= 10) {
    return { label: 'Regular', level: 'regular' };
  }

  return { label: netMargin < 0 ? 'Negocio con perdidas' : 'Critica', level: 'critical' };
}

function normalizeChartRows(rows, labelKey = 'label') {
  return rows.map((row) => ({
    label: String(row[labelKey] || ''),
    value: mapAnalyticsMoney(row.value),
    sales: mapAnalyticsMoney(row.sales),
    utility: mapAnalyticsMoney(row.utility),
    cost: mapAnalyticsMoney(row.cost),
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSOLIDA VENTAS, COSTOS, GASTOS, INVENTARIO, CLIENTES Y KARDEX
// PARA EL MODULO "VENTAS Y RENTABILIDAD" SIN CREAR TABLAS NUEVAS.
async function getSalesProfitabilityAnalytics({ year, month } = {}) {
  const now = new Date();
  const requestedYear = Number(year || now.getFullYear());
  const requestedMonth = Number(month || now.getMonth() + 1);
  const resolvedYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
    ? requestedYear
    : now.getFullYear();
  const resolvedMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
    ? requestedMonth
    : now.getMonth() + 1;
  const pool = await getPool();
  await ensureOperationalCostsTable(pool.request());

  const result = await pool.request()
    .input('analytics_year', sql.Int, resolvedYear)
    .input('analytics_month', sql.Int, resolvedMonth)
    .query(`
    SET DATEFIRST 7;

    DECLARE @system_today date = CAST(GETDATE() AS date);
    DECLARE @month_start date = DATEFROMPARTS(@analytics_year, @analytics_month, 1);
    DECLARE @month_end date = DATEADD(month, 1, @month_start);
    DECLARE @today date = CASE
      WHEN YEAR(@system_today) = @analytics_year AND MONTH(@system_today) = @analytics_month THEN @system_today
      ELSE DATEADD(day, -1, @month_end)
    END;
    DECLARE @tomorrow date = DATEADD(day, 1, @today);
    DECLARE @yesterday date = DATEADD(day, -1, @today);
    DECLARE @week_start date = DATEADD(day, 1 - DATEPART(weekday, @today), @today);
    DECLARE @previous_week_start date = DATEADD(day, -7, @week_start);
    DECLARE @previous_month_start date = DATEADD(month, -1, @month_start);
    DECLARE @year_start date = DATEFROMPARTS(@analytics_year, 1, 1);
    DECLARE @previous_year_start date = DATEADD(year, -1, @year_start);

    IF OBJECT_ID('tempdb..#sales') IS NOT NULL DROP TABLE #sales;
    IF OBJECT_ID('tempdb..#purchases') IS NOT NULL DROP TABLE #purchases;

    SELECT
      source_table,
      sale_id,
      payment_type,
      invoice_id,
      product_id,
      customer_id,
      user_id,
      user_name,
      quantity,
      unit_cost,
      unit_price,
      CAST(quantity * unit_cost AS decimal(18, 4)) AS cost_total,
      CAST(quantity * unit_price AS decimal(18, 4)) AS sale_total,
      CAST(utility AS decimal(18, 4)) AS utility_total,
      sale_date,
      status_id
    INTO #sales
    FROM (
      SELECT
        'VENTA_EFECTIVO' AS source_table,
        ID_VENTA AS sale_id,
        'Efectivo' AS payment_type,
        ID_FACT AS invoice_id,
        ID_PD AS product_id,
        ID_CLIENTE AS customer_id,
        CAST(NULL AS int) AS user_id,
        USUARIO AS user_name,
        CAST(CANT_PD AS decimal(18, 4)) AS quantity,
        CAST(PRECIO_COSTO AS decimal(18, 4)) AS unit_cost,
        CAST(PRECIO_VENTA AS decimal(18, 4)) AS unit_price,
        CAST(UTILIDAD AS decimal(18, 4)) AS utility,
        TRY_CONVERT(datetime2, FECHA_HORA) AS sale_date,
        ID_ESTADO_VENTA AS status_id
      FROM dbo.VENTA_EFECTIVO
      WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

      UNION ALL

      SELECT
        'VENTA_CREDITO',
        ID_VENTA,
        'Credito',
        ID_FACT,
        ID_PD,
        ID_CLIENTE,
        CAST(NULL AS int),
        USUARIO,
        CAST(CANT_PD AS decimal(18, 4)),
        CAST(PRECIO_COSTO AS decimal(18, 4)),
        CAST(PRECIO_VENTA AS decimal(18, 4)),
        CAST(UTILIDAD AS decimal(18, 4)),
        TRY_CONVERT(datetime2, FECHA_HORA),
        ID_ESTADO_VENTA
      FROM dbo.VENTA_CREDITO
      WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

      UNION ALL

      SELECT
        'VENTA_TRANSFERENCIA',
        ID_VTR,
        'Transferencia',
        ID_FACT,
        ID_PD,
        ID_CLIENTE,
        CAST(NULL AS int),
        USUARIO,
        CAST(CANT_PD AS decimal(18, 4)),
        CAST(PRECIO_COSTO AS decimal(18, 4)),
        CAST(PRECIO_VENTA AS decimal(18, 4)),
        CAST(UTILIDAD AS decimal(18, 4)),
        TRY_CONVERT(datetime2, FECHA_HORA),
        ID_ESTADO_VENTA
      FROM dbo.VENTA_TRANSFERENCIA
      WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
    ) sales_source
    WHERE ISNULL(status_id, 4) <> 3;

    SELECT
      purchase_id,
      purchase_type,
      product_id,
      quantity,
      unit_cost,
      CAST(quantity * unit_cost AS decimal(18, 4)) AS purchase_total,
      user_id,
      supplier_id,
      invoice_number,
      purchase_date
    INTO #purchases
    FROM (
      SELECT
        ID_CEFECT AS purchase_id,
        'Compra efectivo' AS purchase_type,
        ID_PD AS product_id,
        CAST(CANT_PD AS decimal(18, 4)) AS quantity,
        CAST(PRECIO_COSTO AS decimal(18, 4)) AS unit_cost,
        ID_USUARIO AS user_id,
        ID_PROVEEDOR AS supplier_id,
        NUM_FACT AS invoice_number,
        TRY_CONVERT(datetime2, FECHA_HORA) AS purchase_date,
        ID_ESTADO_COMPRA AS status_id
      FROM dbo.COMPRA_EFECTIVO
      WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL

      UNION ALL

      SELECT
        ID_CCD,
        'Compra credito',
        ID_PD,
        CAST(CANT_PD AS decimal(18, 4)),
        CAST(PRECIO_COSTO AS decimal(18, 4)),
        ID_USUARIO,
        ID_PROVEEDOR,
        NUM_FACT,
        TRY_CONVERT(datetime2, FECHA_HORA),
        ID_ESTADO_COMPRA
      FROM dbo.COMPRA_CREDITO
      WHERE TRY_CONVERT(datetime2, FECHA_HORA) IS NOT NULL
    ) purchases_source
    WHERE ISNULL(status_id, 1) <> 3;

    DECLARE @latest_sale_date_in_period date = (
      SELECT MAX(CAST(sale_date AS date))
      FROM #sales
      WHERE sale_date >= @month_start
        AND sale_date < @month_end
    );

    IF @latest_sale_date_in_period IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM #sales
         WHERE sale_date >= @today
           AND sale_date < @tomorrow
       )
    BEGIN
      SET @today = @latest_sale_date_in_period;
      SET @tomorrow = DATEADD(day, 1, @today);
      SET @yesterday = DATEADD(day, -1, @today);
      SET @week_start = DATEADD(day, 1 - DATEPART(weekday, @today), @today);
      SET @previous_week_start = DATEADD(day, -7, @week_start);
    END;

    SELECT
      'sales_day' AS metric_key,
      'Ventas del dia' AS label,
      ISNULL(SUM(CASE WHEN sale_date >= @today AND sale_date < @tomorrow THEN sale_total ELSE 0 END), 0) AS current_value,
      ISNULL(SUM(CASE WHEN sale_date >= @yesterday AND sale_date < @today THEN sale_total ELSE 0 END), 0) AS previous_value,
      'Hoy vs ayer' AS comparison
    FROM #sales
    UNION ALL
    SELECT 'sales_week', 'Ventas de la semana',
      ISNULL(SUM(CASE WHEN sale_date >= @week_start AND sale_date < @tomorrow THEN sale_total ELSE 0 END), 0),
      ISNULL(SUM(CASE WHEN sale_date >= @previous_week_start AND sale_date < @week_start THEN sale_total ELSE 0 END), 0),
      'Semana actual vs anterior'
    FROM #sales
    UNION ALL
    SELECT 'sales_month', 'Ventas del mes',
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN sale_total ELSE 0 END), 0),
      ISNULL(SUM(CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN sale_total ELSE 0 END), 0),
      'Mes actual vs anterior'
    FROM #sales
    UNION ALL
    SELECT 'sales_year', 'Ventas del ano',
      ISNULL(SUM(CASE WHEN sale_date >= @year_start AND sale_date < DATEADD(year, 1, @year_start) THEN sale_total ELSE 0 END), 0),
      ISNULL(SUM(CASE WHEN sale_date >= @previous_year_start AND sale_date < @year_start THEN sale_total ELSE 0 END), 0),
      'Ano actual vs anterior'
    FROM #sales
    UNION ALL
    SELECT 'billing_total', 'Facturacion total',
      ISNULL(SUM(sale_total), 0),
      ISNULL(SUM(CASE WHEN sale_date < @year_start THEN sale_total ELSE 0 END), 0),
      'Acumulado vs antes del ano'
    FROM #sales
    UNION ALL
    SELECT 'gross_profit', 'Utilidad bruta',
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN utility_total ELSE 0 END), 0),
      ISNULL(SUM(CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN utility_total ELSE 0 END), 0),
      'Mes actual vs anterior'
    FROM #sales
    UNION ALL
    SELECT 'invoice_count', 'Facturas emitidas',
      COUNT(DISTINCT CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN invoice_id END),
      COUNT(DISTINCT CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN invoice_id END),
      'Mes actual vs anterior'
    FROM #sales
    UNION ALL
    SELECT 'products_sold', 'Productos vendidos',
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN quantity ELSE 0 END), 0),
      ISNULL(SUM(CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN quantity ELSE 0 END), 0),
      'Mes actual vs anterior'
    FROM #sales
    UNION ALL
    SELECT 'customers_served', 'Clientes atendidos',
      COUNT(DISTINCT CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN customer_id END),
      COUNT(DISTINCT CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN customer_id END),
      'Mes actual vs anterior'
    FROM #sales
    UNION ALL
    SELECT 'avg_ticket', 'Ticket promedio',
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN sale_total ELSE 0 END) / NULLIF(COUNT(DISTINCT CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN invoice_id END), 0), 0),
      ISNULL(SUM(CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN sale_total ELSE 0 END) / NULLIF(COUNT(DISTINCT CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN invoice_id END), 0), 0),
      'Mes actual vs anterior'
    FROM #sales;

    SELECT
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN sale_total ELSE 0 END), 0) AS income,
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN cost_total ELSE 0 END), 0) AS cost_of_sales,
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN utility_total ELSE 0 END), 0) AS gross_profit,
      ISNULL((SELECT SUM(MONTO) FROM dbo.COSTO_OPERATIVO WHERE FECHA >= @month_start AND FECHA < DATEADD(month, 1, @month_start)), 0) AS operational_expenses,
      ISNULL((SELECT SUM(MONTO) FROM dbo.COSTO_OPERATIVO WHERE FECHA >= @previous_month_start AND FECHA < @month_start), 0) AS previous_operational_expenses,
      ISNULL(SUM(CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN sale_total ELSE 0 END), 0) AS previous_month_sales,
      ISNULL(SUM(CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN utility_total ELSE 0 END), 0) AS previous_month_utility,
      ISNULL(AVG(CASE WHEN sale_date < @month_start THEN sale_total END), 0) AS historical_average_line_sale
    FROM #sales;

    SELECT
      RIGHT('0' + CAST(DATEPART(hour, sale_date) AS varchar(2)), 2) + ':00' AS label,
      SUM(sale_total) AS value
    FROM #sales
    WHERE sale_date >= @today AND sale_date < @tomorrow
    GROUP BY DATEPART(hour, sale_date)
    ORDER BY MIN(DATEPART(hour, sale_date));

    SELECT
      CONVERT(varchar(10), CAST(sale_date AS date), 23) AS label,
      SUM(sale_total) AS value
    FROM #sales
    WHERE sale_date >= DATEADD(day, -29, @today) AND sale_date < @tomorrow
    GROUP BY CAST(sale_date AS date)
    ORDER BY CAST(sale_date AS date);

    SELECT TOP 52
      CONCAT(YEAR(sale_date), '-S', DATEPART(week, sale_date)) AS label,
      SUM(sale_total) AS value
    FROM #sales
    WHERE sale_date >= DATEADD(month, -12, @today)
    GROUP BY YEAR(sale_date), DATEPART(week, sale_date)
    ORDER BY MIN(CAST(sale_date AS date));

    SELECT
      FORMAT(DATEFROMPARTS(YEAR(sale_date), MONTH(sale_date), 1), 'yyyy-MM') AS label,
      SUM(sale_total) AS value
    FROM #sales
    WHERE sale_date >= DATEADD(year, -5, @month_start)
    GROUP BY YEAR(sale_date), MONTH(sale_date)
    ORDER BY DATEFROMPARTS(YEAR(sale_date), MONTH(sale_date), 1);

    SELECT 'Mes actual' AS label,
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN sale_total ELSE 0 END), 0) AS sales,
      ISNULL(SUM(CASE WHEN sale_date >= @month_start AND sale_date < DATEADD(month, 1, @month_start) THEN utility_total ELSE 0 END), 0) AS utility
    FROM #sales
    UNION ALL
    SELECT 'Mes anterior',
      ISNULL(SUM(CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN sale_total ELSE 0 END), 0),
      ISNULL(SUM(CASE WHEN sale_date >= @previous_month_start AND sale_date < @month_start THEN utility_total ELSE 0 END), 0)
    FROM #sales;

    SELECT 'Ano actual' AS label,
      ISNULL(SUM(CASE WHEN sale_date >= @year_start AND sale_date < DATEADD(year, 1, @year_start) THEN sale_total ELSE 0 END), 0) AS sales,
      ISNULL(SUM(CASE WHEN sale_date >= @year_start AND sale_date < DATEADD(year, 1, @year_start) THEN utility_total ELSE 0 END), 0) AS utility
    FROM #sales
    UNION ALL
    SELECT 'Ano anterior',
      ISNULL(SUM(CASE WHEN sale_date >= @previous_year_start AND sale_date < @year_start THEN sale_total ELSE 0 END), 0),
      ISNULL(SUM(CASE WHEN sale_date >= @previous_year_start AND sale_date < @year_start THEN utility_total ELSE 0 END), 0)
    FROM #sales;

    SELECT TOP 20
      p.id_producto AS product_id,
      p.nombre AS product_name,
      ISNULL(i.categoria, 'Sin categoria') AS category,
      SUM(s.quantity) AS quantity,
      SUM(s.sale_total) AS sales,
      SUM(s.utility_total) AS utility,
      MAX(s.unit_price) AS sale_price,
      MAX(s.unit_cost) AS cost,
      ISNULL(SUM(s.utility_total) / NULLIF(SUM(s.sale_total), 0), 0) AS margin
    FROM #sales s
    LEFT JOIN dbo.producto p ON p.id_producto = s.product_id
    LEFT JOIN dbo.inventario i ON i.codigo = p.codigo
    GROUP BY p.id_producto, p.nombre, i.categoria
    ORDER BY SUM(s.quantity) DESC, SUM(s.sale_total) DESC;

    SELECT TOP 20
      p.id_producto AS product_id,
      p.nombre AS product_name,
      ISNULL(i.categoria, 'Sin categoria') AS category,
      SUM(s.quantity) AS quantity,
      SUM(s.sale_total) AS sales,
      SUM(s.utility_total) AS utility,
      MAX(s.unit_price) AS sale_price,
      MAX(s.unit_cost) AS cost,
      ISNULL(SUM(s.utility_total) / NULLIF(SUM(s.sale_total), 0), 0) AS margin
    FROM #sales s
    LEFT JOIN dbo.producto p ON p.id_producto = s.product_id
    LEFT JOIN dbo.inventario i ON i.codigo = p.codigo
    GROUP BY p.id_producto, p.nombre, i.categoria
    ORDER BY SUM(s.utility_total) DESC;

    SELECT TOP 20
      p.id_producto AS product_id,
      p.nombre AS product_name,
      ISNULL(i.categoria, 'Sin categoria') AS category,
      ISNULL(SUM(s.quantity), 0) AS quantity,
      ISNULL(SUM(s.sale_total), 0) AS sales,
      ISNULL(SUM(s.utility_total), 0) AS utility,
      ISNULL(MAX(s.unit_price), MAX(i.precio_venta)) AS sale_price,
      ISNULL(MAX(s.unit_cost), MAX(i.precio_costo)) AS cost,
      ISNULL(SUM(s.utility_total) / NULLIF(SUM(s.sale_total), 0), 0) AS margin
    FROM dbo.producto p
    LEFT JOIN dbo.inventario i ON i.codigo = p.codigo
    LEFT JOIN #sales s ON s.product_id = p.id_producto
    GROUP BY p.id_producto, p.nombre, i.categoria
    HAVING ISNULL(SUM(s.sale_total), 0) > 0
    ORDER BY ISNULL(SUM(s.utility_total) / NULLIF(SUM(s.sale_total), 0), -1) ASC;

    SELECT TOP 20
      p.id_producto AS product_id,
      p.nombre AS product_name,
      ISNULL(i.categoria, 'Sin categoria') AS category,
      ISNULL(i.precio_venta, 0) AS sale_price,
      ISNULL(i.precio_costo, 0) AS cost,
      ISNULL(i.stock, 0) AS stock,
      ISNULL(i.proveedor, 'Sin proveedor') AS supplier
    FROM dbo.producto p
    LEFT JOIN dbo.inventario i ON i.codigo = p.codigo
    WHERE NOT EXISTS (SELECT 1 FROM #sales s WHERE s.product_id = p.id_producto)
    ORDER BY p.nombre;

    SELECT TOP 20
      p.id_producto AS product_id,
      p.nombre AS product_name,
      ISNULL(i.categoria, 'Sin categoria') AS category,
      SUM(s.quantity) AS quantity,
      SUM(s.sale_total) AS sales,
      SUM(s.utility_total) AS utility,
      MAX(s.unit_price) AS sale_price,
      MAX(s.unit_cost) AS cost,
      ISNULL(SUM(s.utility_total) / NULLIF(SUM(s.sale_total), 0), 0) AS margin
    FROM #sales s
    LEFT JOIN dbo.producto p ON p.id_producto = s.product_id
    LEFT JOIN dbo.inventario i ON i.codigo = p.codigo
    GROUP BY p.id_producto, p.nombre, i.categoria
    HAVING SUM(s.utility_total) < 0
    ORDER BY SUM(s.utility_total) ASC;

    SELECT TOP 20
      c.ID_CLIENTE AS customer_id,
      LTRIM(RTRIM(CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')))) AS customer_name,
      COUNT(DISTINCT s.invoice_id) AS invoices,
      SUM(s.sale_total) AS sales,
      SUM(s.utility_total) AS utility,
      MAX(s.sale_date) AS last_sale
    FROM #sales s
    LEFT JOIN dbo.cliente c ON c.ID_CLIENTE = s.customer_id
    GROUP BY c.ID_CLIENTE, c.NOMBRE, c.APELLIDO
    ORDER BY SUM(s.sale_total) DESC;

    SELECT TOP 20
      c.ID_CLIENTE AS customer_id,
      LTRIM(RTRIM(CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')))) AS customer_name,
      COUNT(DISTINCT s.invoice_id) AS invoices,
      SUM(s.sale_total) AS sales,
      SUM(s.utility_total) AS utility,
      MAX(s.sale_date) AS last_sale
    FROM #sales s
    LEFT JOIN dbo.cliente c ON c.ID_CLIENTE = s.customer_id
    GROUP BY c.ID_CLIENTE, c.NOMBRE, c.APELLIDO
    ORDER BY SUM(s.utility_total) DESC;

    SELECT TOP 20
      c.ID_CLIENTE AS customer_id,
      LTRIM(RTRIM(CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')))) AS customer_name,
      COUNT(DISTINCT s.invoice_id) AS invoices,
      ISNULL(SUM(s.sale_total), 0) AS sales,
      ISNULL(SUM(s.utility_total), 0) AS utility,
      MAX(s.sale_date) AS last_sale
    FROM dbo.cliente c
    LEFT JOIN #sales s ON s.customer_id = c.ID_CLIENTE
    GROUP BY c.ID_CLIENTE, c.NOMBRE, c.APELLIDO
    HAVING MAX(s.sale_date) IS NULL OR MAX(s.sale_date) < DATEADD(day, -60, @today)
    ORDER BY MAX(s.sale_date) ASC;

    SELECT TOP 20
      c.ID_CLIENTE AS customer_id,
      LTRIM(RTRIM(CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')))) AS customer_name,
      COUNT(DISTINCT s.invoice_id) AS invoices,
      SUM(s.sale_total) AS sales,
      SUM(s.utility_total) AS utility,
      MIN(s.sale_date) AS first_sale,
      MAX(s.sale_date) AS last_sale
    FROM #sales s
    LEFT JOIN dbo.cliente c ON c.ID_CLIENTE = s.customer_id
    GROUP BY c.ID_CLIENTE, c.NOMBRE, c.APELLIDO
    HAVING MIN(s.sale_date) >= DATEADD(day, -30, @today)
    ORDER BY MIN(s.sale_date) DESC;

    SELECT TOP 20
      c.ID_CLIENTE AS customer_id,
      LTRIM(RTRIM(CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')))) AS customer_name,
      COUNT(DISTINCT s.invoice_id) AS invoices,
      SUM(s.sale_total) AS sales,
      SUM(s.utility_total) AS utility,
      MAX(s.sale_date) AS last_sale
    FROM #sales s
    LEFT JOIN dbo.cliente c ON c.ID_CLIENTE = s.customer_id
    GROUP BY c.ID_CLIENTE, c.NOMBRE, c.APELLIDO
    HAVING COUNT(DISTINCT s.invoice_id) >= 2
    ORDER BY COUNT(DISTINCT s.invoice_id) DESC, SUM(s.sale_total) DESC;

    SELECT
      ISNULL(SUM(i.stock), 0) AS current_stock,
      ISNULL(SUM(i.stock * i.precio_costo), 0) AS inventory_cost,
      ISNULL(SUM(i.stock * i.precio_venta), 0) AS inventory_value,
      ISNULL(SUM((i.precio_venta - i.precio_costo) * i.stock), 0) AS potential_profit
    FROM dbo.inventario i;

    SELECT TOP 250
      movement_date,
      document,
      movement_type,
      product_id,
      product_name,
      category,
      entrada,
      salida,
      current_stock,
      unit_cost,
      average_cost,
      user_name,
      warehouse
    FROM (
      SELECT
        pch.purchase_date AS movement_date,
        ISNULL(NULLIF(pch.invoice_number, ''), CONCAT('Compra #', pch.purchase_id)) AS document,
        pch.purchase_type AS movement_type,
        p.id_producto AS product_id,
        p.nombre AS product_name,
        ISNULL(i.categoria, 'Sin categoria') AS category,
        pch.quantity AS entrada,
        CAST(0 AS decimal(18, 4)) AS salida,
        ISNULL(i.stock, 0) AS current_stock,
        pch.unit_cost,
        ISNULL(i.precio_costo, pch.unit_cost) AS average_cost,
        ISNULL(u.nombre, 'Sistema') AS user_name,
        'Principal' AS warehouse
      FROM #purchases pch
      LEFT JOIN dbo.producto p ON p.id_producto = pch.product_id
      LEFT JOIN dbo.inventario i ON i.codigo = p.codigo
      LEFT JOIN dbo.usuario u ON u.id_usuario = pch.user_id

      UNION ALL

      SELECT
        s.sale_date,
        CONCAT('Factura #', s.invoice_id),
        CONCAT('Venta ', s.payment_type),
        p.id_producto,
        p.nombre,
        ISNULL(i.categoria, 'Sin categoria'),
        CAST(0 AS decimal(18, 4)),
        s.quantity,
        ISNULL(i.stock, 0),
        s.unit_cost,
        ISNULL(i.precio_costo, s.unit_cost),
        ISNULL(NULLIF(s.user_name, ''), ISNULL(u.nombre, 'Sistema')),
        'Principal'
      FROM #sales s
      LEFT JOIN dbo.producto p ON p.id_producto = s.product_id
      LEFT JOIN dbo.inventario i ON i.codigo = p.codigo
      LEFT JOIN dbo.usuario u ON u.id_usuario = s.user_id
    ) kardex_source
    ORDER BY movement_date DESC;

    SELECT
      YEAR(period_start) AS period_year,
      MONTH(period_start) AS period_month,
      FORMAT(period_start, 'yyyy-MM') AS period_key,
      FORMAT(period_start, 'MMMM yyyy', 'es-HN') AS period_label,
      COUNT(*) AS movements
    FROM (
      SELECT DATEFROMPARTS(YEAR(sale_date), MONTH(sale_date), 1) AS period_start
      FROM #sales
      UNION ALL
      SELECT DATEFROMPARTS(YEAR(purchase_date), MONTH(purchase_date), 1)
      FROM #purchases
    ) available_periods
    GROUP BY period_start
    ORDER BY period_start DESC;
  `);

  const metricRows = result.recordsets[0] || [];
  const profitabilityRow = result.recordsets[1]?.[0] || {};
  const income = mapAnalyticsMoney(profitabilityRow.income);
  const costOfSales = mapAnalyticsMoney(profitabilityRow.cost_of_sales);
  const grossProfit = mapAnalyticsMoney(profitabilityRow.gross_profit);
  const operationalExpenses = mapAnalyticsMoney(profitabilityRow.operational_expenses);
  const previousOperationalExpenses = mapAnalyticsMoney(profitabilityRow.previous_operational_expenses);
  const previousMonthSales = mapAnalyticsMoney(profitabilityRow.previous_month_sales);
  const previousMonthUtility = mapAnalyticsMoney(profitabilityRow.previous_month_utility);
  const previousNetProfit = previousMonthUtility - previousOperationalExpenses;
  const previousNetMargin = previousMonthSales > 0 ? (previousNetProfit / previousMonthSales) * 100 : 0;
  const netProfit = grossProfit - operationalExpenses;
  const netMargin = income > 0 ? (netProfit / income) * 100 : 0;
  const profitabilityStatus = resolveProfitabilityStatus(netMargin);
  const monthSalesVariation = mapAnalyticsVariation(income, previousMonthSales);
  const monthUtilityVariation = mapAnalyticsVariation(grossProfit, previousMonthUtility);
  const historicalAverage = mapAnalyticsMoney(profitabilityRow.historical_average_line_sale);

  const kpis = metricRows.map((row) => ({
    key: String(row.metric_key),
    label: String(row.label),
    value: mapAnalyticsMoney(row.current_value),
    previousValue: mapAnalyticsMoney(row.previous_value),
    variation: mapAnalyticsVariation(row.current_value, row.previous_value),
    comparison: String(row.comparison),
  }));

  kpis.push(
    {
      key: 'net_profit',
      label: 'Utilidad neta',
      value: netProfit,
      previousValue: previousNetProfit,
      variation: mapAnalyticsVariation(netProfit, previousNetProfit),
      comparison: 'Mes actual vs anterior',
    },
    {
      key: 'net_margin',
      label: 'Margen de utilidad',
      value: netMargin,
      previousValue: previousNetMargin,
      variation: mapAnalyticsVariation(netMargin, previousNetMargin),
      comparison: 'Mes actual vs anterior',
    },
  );

  const productMapper = (row) => ({
    productId: Number(row.product_id || 0),
    productName: row.product_name || 'Producto sin nombre',
    category: row.category || 'Sin categoria',
    quantity: mapAnalyticsMoney(row.quantity),
    sales: mapAnalyticsMoney(row.sales),
    utility: mapAnalyticsMoney(row.utility),
    salePrice: mapAnalyticsMoney(row.sale_price),
    cost: mapAnalyticsMoney(row.cost),
    margin: mapAnalyticsMoney(row.margin),
    stock: mapAnalyticsMoney(row.stock),
    supplier: row.supplier || '',
  });

  const customerMapper = (row) => ({
    customerId: Number(row.customer_id || 0),
    customerName: row.customer_name || 'Cliente sin nombre',
    invoices: Number(row.invoices || 0),
    sales: mapAnalyticsMoney(row.sales),
    utility: mapAnalyticsMoney(row.utility),
    firstSale: row.first_sale ? new Date(row.first_sale).toISOString() : null,
    lastSale: row.last_sale ? new Date(row.last_sale).toISOString() : null,
  });

  const inventorySummary = result.recordsets[18]?.[0] || {};
  const availableMonths = (result.recordsets[20] || []).map((row) => ({
    year: Number(row.period_year || 0),
    month: Number(row.period_month || 0),
    key: row.period_key || '',
    label: row.period_label || row.period_key || '',
    movements: Number(row.movements || 0),
  }));
  const noMovementProducts = (result.recordsets[11] || []).map(productMapper);
  const lossProducts = (result.recordsets[12] || []).map(productMapper);
  const alerts = [];

  if (monthSalesVariation < -15) {
    alerts.push({ type: 'sales_drop', severity: 'critical', message: `Las ventas bajaron ${Math.abs(monthSalesVariation).toFixed(1)}% contra el mes anterior.` });
  }

  if (monthUtilityVariation < -10) {
    alerts.push({ type: 'utility_drop', severity: 'warning', message: `La utilidad disminuyo ${Math.abs(monthUtilityVariation).toFixed(1)}% contra el mes anterior.` });
  }

  if (lossProducts.length > 0) {
    alerts.push({ type: 'negative_margin', severity: 'critical', message: `${lossProducts.length} productos tienen margen negativo.` });
  }

  if (noMovementProducts.length > 0) {
    alerts.push({ type: 'no_movement', severity: 'warning', message: `${noMovementProducts.length} productos no tienen movimiento registrado.` });
  }

  if (netMargin < 10) {
    alerts.push({ type: 'low_margin', severity: 'critical', message: `El margen neto esta en ${netMargin.toFixed(1)}%, por debajo del minimo de 10%.` });
  }

  if (income > 0 && historicalAverage > 0 && income < historicalAverage) {
    alerts.push({ type: 'below_average', severity: 'warning', message: 'Las ventas actuales estan por debajo del promedio historico.' });
  }

  return {
    generatedAt: new Date().toISOString(),
    selectedPeriod: {
      year: resolvedYear,
      month: resolvedMonth,
      key: `${resolvedYear}-${String(resolvedMonth).padStart(2, '0')}`,
    },
    availableMonths,
    kpis,
    profitability: {
      income,
      costOfSales,
      grossProfit,
      operationalExpenses,
      netProfit,
      netMargin,
      generalProfitability: profitabilityStatus.label,
      status: profitabilityStatus,
      monthlySalesVariation: monthSalesVariation,
      monthlyUtilityVariation: monthUtilityVariation,
    },
    charts: {
      salesByHour: normalizeChartRows(result.recordsets[2] || []),
      salesLast30Days: normalizeChartRows(result.recordsets[3] || []),
      salesByWeekLast12Months: normalizeChartRows(result.recordsets[4] || []),
      salesByMonthLast5Years: normalizeChartRows(result.recordsets[5] || []),
      monthComparison: normalizeChartRows(result.recordsets[6] || []),
      utilityComparison: normalizeChartRows(result.recordsets[6] || []).map((row) => ({ ...row, value: row.utility })),
      annualComparison: normalizeChartRows(result.recordsets[7] || []),
    },
    products: {
      topSold: (result.recordsets[8] || []).map(productMapper),
      topProfitable: (result.recordsets[9] || []).map(productMapper),
      lowProfitability: (result.recordsets[10] || []).map(productMapper),
      noMovement: noMovementProducts,
      losses: lossProducts,
    },
    customers: {
      topRevenue: (result.recordsets[13] || []).map(customerMapper),
      topProfit: (result.recordsets[14] || []).map(customerMapper),
      inactive: (result.recordsets[15] || []).map(customerMapper),
      newCustomers: (result.recordsets[16] || []).map(customerMapper),
      recurrent: (result.recordsets[17] || []).map(customerMapper),
    },
    kardex: {
      summary: {
        currentStock: mapAnalyticsMoney(inventorySummary.current_stock),
        inventoryCost: mapAnalyticsMoney(inventorySummary.inventory_cost),
        inventoryValue: mapAnalyticsMoney(inventorySummary.inventory_value),
        potentialProfit: mapAnalyticsMoney(inventorySummary.potential_profit),
      },
      rows: (result.recordsets[19] || []).map((row, index) => ({
        id: index + 1,
        date: row.movement_date ? new Date(row.movement_date).toISOString() : null,
        document: row.document || '',
        movementType: row.movement_type || '',
        productId: Number(row.product_id || 0),
        productName: row.product_name || 'Producto sin nombre',
        category: row.category || 'Sin categoria',
        entrada: mapAnalyticsMoney(row.entrada),
        salida: mapAnalyticsMoney(row.salida),
        existencia: mapAnalyticsMoney(row.current_stock),
        unitCost: mapAnalyticsMoney(row.unit_cost),
        averageCost: mapAnalyticsMoney(row.average_cost),
        userName: row.user_name || 'Sistema',
        warehouse: row.warehouse || 'Principal',
      })),
    },
    alerts,
    reports: [
      'Ventas diarias',
      'Ventas semanales',
      'Ventas mensuales',
      'Ventas anuales',
      'Rentabilidad',
      'Kardex',
      'Utilidad por producto',
      'Utilidad por cliente',
      'Productos mas vendidos',
      'Productos menos vendidos',
    ],
  };
}

async function getSystemHealth() {
  const startedAt = Date.now();
  const pool = await getPool();
  const result = await pool.request().query(`
    DECLARE @month_start date = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
    DECLARE @next_month_start date = DATEADD(month, 1, @month_start);

    WITH oldp AS (
      SELECT
        LTRIM(RTRIM(Codigo)) COLLATE DATABASE_DEFAULT AS codigo,
        MAX(Nombre) COLLATE DATABASE_DEFAULT AS nombre,
        SUM(CAST(ISNULL(Stock, 0) AS decimal(18, 2))) AS stock
      FROM [DBSistemaPuntoDeVenta].dbo.Productos
      WHERE NULLIF(LTRIM(RTRIM(Codigo)), '') IS NOT NULL
      GROUP BY LTRIM(RTRIM(Codigo)) COLLATE DATABASE_DEFAULT
    ),
    newp AS (
      SELECT
        codigo COLLATE DATABASE_DEFAULT AS codigo,
        COUNT(*) AS rows_count,
        SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) AS active_rows
      FROM dbo.producto
      GROUP BY codigo COLLATE DATABASE_DEFAULT
    ),
    newi AS (
      SELECT
        codigo COLLATE DATABASE_DEFAULT AS codigo,
        COUNT(*) AS rows_count,
        SUM(CAST(ISNULL(stock, 0) AS decimal(18, 2))) AS stock
      FROM dbo.inventario
      GROUP BY codigo COLLATE DATABASE_DEFAULT
    )
    SELECT
      DB_NAME() AS database_name,
      @@SERVERNAME AS server_name,
      (SELECT COUNT(*) FROM oldp) AS old_codes,
      (SELECT COUNT(*) FROM newp WHERE active_rows > 0) AS active_new_codes,
      (SELECT COUNT(*) FROM oldp o LEFT JOIN newp n ON n.codigo = o.codigo WHERE n.codigo IS NULL) AS missing_codes,
      (SELECT COUNT(*) FROM newp n LEFT JOIN oldp o ON o.codigo = n.codigo WHERE o.codigo IS NULL AND n.active_rows > 0) AS active_extra_codes,
      (SELECT COUNT(*) FROM newp WHERE rows_count > 1) AS duplicate_product_codes,
      (SELECT COUNT(*) FROM newi WHERE rows_count > 1) AS duplicate_inventory_codes,
      (SELECT COUNT(*) FROM oldp o INNER JOIN newi i ON i.codigo = o.codigo WHERE ABS(ISNULL(o.stock, 0) - ISNULL(i.stock, 0)) > 0.001) AS stock_mismatches,
      (SELECT COUNT(*) FROM dbo.inventario WHERE stock < 0) AS negative_stock,
      (SELECT COUNT(*) FROM dbo.producto p LEFT JOIN dbo.inventario i ON i.codigo = p.codigo WHERE p.activo = 1 AND i.codigo IS NULL) AS products_without_inventory,
      (SELECT COUNT(*) FROM dbo.inventario i LEFT JOIN dbo.producto p ON p.codigo = i.codigo WHERE p.id_producto IS NULL) AS inventory_without_product,
      (SELECT COUNT(*) FROM dbo.producto) AS product_rows,
      (SELECT COUNT(*) FROM dbo.producto WHERE activo = 1) AS active_product_rows,
      (SELECT COUNT(*) FROM dbo.inventario) AS inventory_rows,
      (SELECT COUNT(*) FROM dbo.producto p INNER JOIN dbo.inventario i ON i.codigo = p.codigo WHERE ISNULL(p.activo, 0) = 0 AND ISNULL(i.stock, 0) > 0) AS inactive_products_with_stock,
      (SELECT COUNT(*) FROM dbo.producto WHERE NULLIF(LTRIM(RTRIM(ISNULL(imagen_url, ''))), '') IS NOT NULL) AS products_with_image,
      (SELECT COUNT(*) FROM dbo.PRODUCTO_PROXIMO_VENCER) AS expiring_products,
      (SELECT ISNULL(MAX(ID_FACT), 0) FROM dbo.FACTURA) AS latest_invoice_number,
      (SELECT COUNT(*) FROM dbo.FACTURA WHERE TRY_CONVERT(date, FECHA_HORA) = CONVERT(date, GETDATE())) AS invoices_today,
      (
        SELECT COUNT(*)
        FROM (
          SELECT f.ID_FACT
          FROM dbo.FACTURA f
          INNER JOIN (
            SELECT ID_FACT, ID_ESTADO_VENTA FROM dbo.VENTA_EFECTIVO WHERE ID_FACT IS NOT NULL
            UNION ALL SELECT ID_FACT, ID_ESTADO_VENTA FROM dbo.VENTA_CREDITO WHERE ID_FACT IS NOT NULL
            UNION ALL SELECT ID_FACT, ID_ESTADO_VENTA FROM dbo.VENTA_TRANSFERENCIA WHERE ID_FACT IS NOT NULL
          ) lines ON lines.ID_FACT = f.ID_FACT
          WHERE TRY_CONVERT(date, f.FECHA_HORA) >= DATEADD(day, -7, CONVERT(date, GETDATE()))
          GROUP BY f.ID_FACT
          HAVING COUNT(*) = SUM(CASE WHEN ISNULL(lines.ID_ESTADO_VENTA, 0) = 3 THEN 1 ELSE 0 END)
        ) annulled
      ) AS annulled_invoices_7d,
      (
        SELECT COUNT(*)
        FROM dbo.FACTURA f
        WHERE NOT EXISTS (
          SELECT 1 FROM dbo.VENTA_EFECTIVO ve WHERE ve.ID_FACT = f.ID_FACT
          UNION ALL
          SELECT 1 FROM dbo.VENTA_CREDITO vc WHERE vc.ID_FACT = f.ID_FACT
          UNION ALL
          SELECT 1 FROM dbo.VENTA_TRANSFERENCIA vt WHERE vt.ID_FACT = f.ID_FACT
        )
      ) AS invoices_without_lines,
      (
        SELECT COUNT(*)
        FROM (
          SELECT ID_FACT FROM dbo.VENTA_EFECTIVO WHERE ID_FACT IS NOT NULL
          UNION ALL SELECT ID_FACT FROM dbo.VENTA_CREDITO WHERE ID_FACT IS NOT NULL
          UNION ALL SELECT ID_FACT FROM dbo.VENTA_TRANSFERENCIA WHERE ID_FACT IS NOT NULL
        ) lines
        LEFT JOIN dbo.FACTURA f ON f.ID_FACT = lines.ID_FACT
        WHERE f.ID_FACT IS NULL
      ) AS sale_lines_without_invoice,
      (
        SELECT COUNT(*)
        FROM (
          SELECT TRY_CONVERT(date, FECHA_HORA) AS sale_date, PRECIO_VENTA * CANT_PD AS total FROM dbo.VENTA_EFECTIVO
          UNION ALL SELECT TRY_CONVERT(date, FECHA_HORA), PRECIO_VENTA * CANT_PD FROM dbo.VENTA_CREDITO
          UNION ALL SELECT TRY_CONVERT(date, FECHA_HORA), PRECIO_VENTA * CANT_PD FROM dbo.VENTA_TRANSFERENCIA
        ) sales
        WHERE sales.sale_date = CONVERT(date, GETDATE())
      ) AS sales_lines_today,
      (
        SELECT ISNULL(SUM(total), 0)
        FROM (
          SELECT TRY_CONVERT(date, FECHA_HORA) AS sale_date, CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) AS total FROM dbo.VENTA_EFECTIVO
          UNION ALL SELECT TRY_CONVERT(date, FECHA_HORA), CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) FROM dbo.VENTA_CREDITO
          UNION ALL SELECT TRY_CONVERT(date, FECHA_HORA), CAST(PRECIO_VENTA * CANT_PD AS decimal(18, 2)) FROM dbo.VENTA_TRANSFERENCIA
        ) sales
        WHERE sales.sale_date = CONVERT(date, GETDATE())
      ) AS sales_total_today,
      (SELECT COUNT(*) FROM dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO WHERE accion = 'CODIGO_NUEVO_AGREGADO' AND creado_en >= @month_start AND creado_en < @next_month_start) AS new_codes_month,
      (SELECT COUNT(*) FROM dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO WHERE accion IN ('CODIGO_DESACTIVADO', 'DUPLICADO_ELIMINADO') AND creado_en >= @month_start AND creado_en < @next_month_start) AS removed_or_disabled_codes_month,
      SYSDATETIME() AS generated_at;

    WITH checks AS (
      SELECT 'Faltantes en BD nueva' AS title, 'critical' AS severity, COUNT(*) AS affected
      FROM (
        SELECT o.Codigo COLLATE DATABASE_DEFAULT AS codigo
        FROM [DBSistemaPuntoDeVenta].dbo.Productos o
        LEFT JOIN dbo.producto p ON p.codigo COLLATE DATABASE_DEFAULT = o.Codigo COLLATE DATABASE_DEFAULT
        WHERE p.id_producto IS NULL
      ) x
      UNION ALL
      SELECT 'Stock diferente contra BD antigua', 'critical', COUNT(*)
      FROM (
        SELECT o.codigo
        FROM (
          SELECT Codigo COLLATE DATABASE_DEFAULT AS codigo, SUM(CAST(ISNULL(Stock, 0) AS decimal(18, 2))) AS stock
          FROM [DBSistemaPuntoDeVenta].dbo.Productos
          GROUP BY Codigo COLLATE DATABASE_DEFAULT
        ) o
        INNER JOIN (
          SELECT codigo COLLATE DATABASE_DEFAULT AS codigo, SUM(CAST(ISNULL(stock, 0) AS decimal(18, 2))) AS stock
          FROM dbo.inventario
          GROUP BY codigo COLLATE DATABASE_DEFAULT
        ) i ON i.codigo = o.codigo
        WHERE ABS(ISNULL(o.stock, 0) - ISNULL(i.stock, 0)) > 0.001
      ) x
      UNION ALL
      SELECT 'Codigos duplicados', 'warning', COUNT(*)
      FROM (
        SELECT codigo FROM dbo.producto GROUP BY codigo HAVING COUNT(*) > 1
      ) x
      UNION ALL
      SELECT 'Stock negativo', 'warning', COUNT(*)
      FROM dbo.inventario
      WHERE stock < 0
      UNION ALL
      SELECT 'Codigos activos excedentes', 'warning', COUNT(*)
      FROM dbo.producto p
      LEFT JOIN [DBSistemaPuntoDeVenta].dbo.Productos o
        ON o.Codigo COLLATE DATABASE_DEFAULT = p.codigo COLLATE DATABASE_DEFAULT
      WHERE o.IdProducto IS NULL
        AND p.activo = 1
      UNION ALL
      SELECT 'Productos activos sin inventario', 'critical', COUNT(*)
      FROM dbo.producto p
      LEFT JOIN dbo.inventario i ON i.codigo = p.codigo
      WHERE p.activo = 1
        AND i.codigo IS NULL
      UNION ALL
      SELECT 'Inventario sin producto asociado', 'warning', COUNT(*)
      FROM dbo.inventario i
      LEFT JOIN dbo.producto p ON p.codigo = i.codigo
      WHERE p.id_producto IS NULL
      UNION ALL
      SELECT 'Productos inactivos con stock', 'warning', COUNT(*)
      FROM dbo.producto p
      INNER JOIN dbo.inventario i ON i.codigo = p.codigo
      WHERE ISNULL(p.activo, 0) = 0
        AND ISNULL(i.stock, 0) > 0
      UNION ALL
      SELECT 'Productos proximos a vencer', 'warning', COUNT(*)
      FROM dbo.PRODUCTO_PROXIMO_VENCER
      UNION ALL
      SELECT 'Facturas sin detalle de venta', 'critical', COUNT(*)
      FROM dbo.FACTURA f
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.VENTA_EFECTIVO ve WHERE ve.ID_FACT = f.ID_FACT
        UNION ALL
        SELECT 1 FROM dbo.VENTA_CREDITO vc WHERE vc.ID_FACT = f.ID_FACT
        UNION ALL
        SELECT 1 FROM dbo.VENTA_TRANSFERENCIA vt WHERE vt.ID_FACT = f.ID_FACT
      )
      UNION ALL
      SELECT 'Lineas de venta sin factura', 'critical', COUNT(*)
      FROM (
        SELECT ID_FACT FROM dbo.VENTA_EFECTIVO WHERE ID_FACT IS NOT NULL
        UNION ALL SELECT ID_FACT FROM dbo.VENTA_CREDITO WHERE ID_FACT IS NOT NULL
        UNION ALL SELECT ID_FACT FROM dbo.VENTA_TRANSFERENCIA WHERE ID_FACT IS NOT NULL
      ) lines
      LEFT JOIN dbo.FACTURA f ON f.ID_FACT = lines.ID_FACT
      WHERE f.ID_FACT IS NULL
    )
    SELECT title, severity, affected
    FROM checks
    ORDER BY
      CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      affected DESC;

    SELECT
      accion,
      COUNT(*) AS total
    FROM dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO
    WHERE creado_en >= @month_start
      AND creado_en < @next_month_start
    GROUP BY accion
    ORDER BY total DESC, accion ASC;

    SELECT TOP 40
      accion,
      codigo,
      id_producto_oficial,
      id_producto_afectado,
      stock_anterior,
      stock_nuevo,
      detalle,
      creado_en
    FROM dbo.SISTEMA_SALUD_PRODUCTO_CAMBIO
    ORDER BY id_cambio DESC;

    SELECT metric, rows_count
    FROM (
      SELECT 'producto' AS metric, COUNT(*) AS rows_count FROM dbo.producto
      UNION ALL SELECT 'inventario', COUNT(*) FROM dbo.inventario
      UNION ALL SELECT 'factura', COUNT(*) FROM dbo.FACTURA
      UNION ALL SELECT 'venta_efectivo', COUNT(*) FROM dbo.VENTA_EFECTIVO
      UNION ALL SELECT 'venta_credito', COUNT(*) FROM dbo.VENTA_CREDITO
      UNION ALL SELECT 'venta_transferencia', COUNT(*) FROM dbo.VENTA_TRANSFERENCIA
      UNION ALL SELECT 'compra_efectivo', COUNT(*) FROM dbo.COMPRA_EFECTIVO
      UNION ALL SELECT 'compra_credito', COUNT(*) FROM dbo.COMPRA_CREDITO
      UNION ALL SELECT 'usuario', COUNT(*) FROM dbo.usuario
      UNION ALL SELECT 'cliente', COUNT(*) FROM dbo.cliente
    ) x
    ORDER BY metric;

    SELECT TOP 300
      id_producto,
      codigo,
      nombre,
      imagen_url
    FROM dbo.producto
    WHERE NULLIF(LTRIM(RTRIM(ISNULL(imagen_url, ''))), '') IS NOT NULL
    ORDER BY id_producto DESC;
  `);

  const summary = result.recordsets[0]?.[0] || {};
  const imageRows = result.recordsets[5] || [];
  const brokenImages = imageRows
    .map((row) => ({
      productId: Number(row.id_producto || 0),
      sku: row.codigo || '',
      name: row.nombre || '',
      imageUrl: row.imagen_url || '',
      resolvedPath: resolveHealthImagePath(row.imagen_url),
    }))
    .filter((row) => !row.resolvedPath || !fs.existsSync(row.resolvedPath))
    .slice(0, 40);
  const disk = getDiskHealthSnapshot();
  const responseMs = Date.now() - startedAt;
  const tableRows = (result.recordsets[4] || []).map((row) => ({
    name: row.metric,
    rows: Number(row.rows_count || 0),
  }));
  const checks = (result.recordsets[1] || []).map((row) => ({
    title: row.title,
    severity: row.severity,
    affected: Number(row.affected || 0),
  }));

  if (brokenImages.length > 0) {
    checks.push({
      title: 'Imagenes de producto no encontradas',
      severity: 'warning',
      affected: brokenImages.length,
    });
  }

  if (disk.availablePercent !== null && disk.availablePercent < 12) {
    checks.push({
      title: 'Espacio disponible en disco bajo',
      severity: disk.availablePercent < 6 ? 'critical' : 'warning',
      affected: 1,
    });
  }

  return {
    generatedAt: summary.generated_at ? new Date(summary.generated_at).toISOString() : new Date().toISOString(),
    environment: {
      databaseName: summary.database_name || '',
      serverName: summary.server_name || '',
      dbResponseMs: responseMs,
      nodeVersion: process.version,
      platform: `${os.type()} ${os.release()}`,
      appPath: projectRootPath,
      disk,
    },
    summary: {
      oldCodes: Number(summary.old_codes || 0),
      activeNewCodes: Number(summary.active_new_codes || 0),
      missingCodes: Number(summary.missing_codes || 0),
      activeExtraCodes: Number(summary.active_extra_codes || 0),
      duplicateProductCodes: Number(summary.duplicate_product_codes || 0),
      duplicateInventoryCodes: Number(summary.duplicate_inventory_codes || 0),
      stockMismatches: Number(summary.stock_mismatches || 0),
      negativeStock: Number(summary.negative_stock || 0),
      productsWithoutInventory: Number(summary.products_without_inventory || 0),
      inventoryWithoutProduct: Number(summary.inventory_without_product || 0),
      productRows: Number(summary.product_rows || 0),
      activeProductRows: Number(summary.active_product_rows || 0),
      inventoryRows: Number(summary.inventory_rows || 0),
      inactiveProductsWithStock: Number(summary.inactive_products_with_stock || 0),
      productsWithImage: Number(summary.products_with_image || 0),
      brokenProductImages: brokenImages.length,
      expiringProducts: Number(summary.expiring_products || 0),
      latestInvoiceNumber: Number(summary.latest_invoice_number || 0),
      invoicesToday: Number(summary.invoices_today || 0),
      annulledInvoices7d: Number(summary.annulled_invoices_7d || 0),
      invoicesWithoutLines: Number(summary.invoices_without_lines || 0),
      saleLinesWithoutInvoice: Number(summary.sale_lines_without_invoice || 0),
      salesLinesToday: Number(summary.sales_lines_today || 0),
      salesTotalToday: Number(summary.sales_total_today || 0),
      newCodesMonth: Number(summary.new_codes_month || 0),
      removedOrDisabledCodesMonth: Number(summary.removed_or_disabled_codes_month || 0),
    },
    checks,
    tableRows,
    brokenImages,
    monthlyChanges: (result.recordsets[2] || []).map((row) => ({
      action: row.accion,
      total: Number(row.total || 0),
    })),
    recentChanges: (result.recordsets[3] || []).map((row) => ({
      action: row.accion,
      sku: row.codigo,
      officialProductId: row.id_producto_oficial === null ? null : Number(row.id_producto_oficial),
      affectedProductId: row.id_producto_afectado === null ? null : Number(row.id_producto_afectado),
      previousStock: row.stock_anterior === null ? null : Number(row.stock_anterior),
      newStock: row.stock_nuevo === null ? null : Number(row.stock_nuevo),
      detail: row.detalle || '',
      createdAt: row.creado_en ? new Date(row.creado_en).toISOString() : null,
    })),
  };
}

function sqlColumnName(columnName) {
  return `[${String(columnName).replace(/]/g, ']]')}]`;
}

module.exports = {
  activateInvoice,
  annulInvoice,
  annulPurchase,
  createAssembledOfferCode,
  createDailyCut,
  createFinancialMovement,
  createInventoryProduct,
  createProductBarcode,
  createPettyCashRecord,
  deleteDailyCutCashManagement,
  deletePettyCashRecord,
  executeMonthlyCostIncreaseProcedure,
  createOpeningCut,
  createOperationalCost,
  updateAssembledOfferCode,
  getDashboardSalesSummary,
  getDashboardSalesTrend,
  getSalesProfitabilityAnalytics,
  getSalesByCategoryForPeriod,
  getSalesDropAlert,
  getSalesTotalByPeriod,
  listFinancialMovements,
  listAssembledOfferCodes,
  listMonthlyCostIncreaseAlerts,
  listOperationalCosts,
  listPettyCashRecords,
  getInvoiceDetails,
  getInvoicesSummary,
  getNextInvoiceNumber,
  getBillingProducts,
  getBillingProductAvailability,
  getInactiveProducts,
  listProductBarcodes,
  getProductInventoryDetail,
  getProducts,
  getQuoteDetails,
  getSystemHealth,
  listQuotes,
  listPayrollRecords,
  listInvoices,
  listExpiringProducts,
  listPurchases,
  listTodayInvoices,
  listCustomers,
  listCredits,
  listAuditHistory,
  createAuditHistoryRecord,
  listCreditPaymentsByDate,
  listCreditPaymentsHistory,
  listCreditPaymentsByCustomer,
  listDailyCuts,
  previewDailyCut,
  refreshExpiringProducts,
  saveAttendanceMark,
  savePayrollWeek,
  listSuppliers,
  listActiveUsers,
  listAttendanceUsers,
  loginUser,
  createQuote,
  registerPurchase,
  registerQuickInventoryPurchase,
  registerQuickInventoryReduction,
  registerCreditPayment,
  registerSale,
  updateDailyCutCashManagement,
  updatePettyCashRecord,
  updateProductActiveStatus,
  setPrimaryProductBarcode,
  updateProductBarcodeStatus,
  reactivateInventoryProduct,
  updateInventoryStockLevels,
};
