const { getPool, sql } = require('./db');

async function setAuditContext(transaction, { userId = null, user = null } = {}) {
  await new sql.Request(transaction)
    .input('audit_user_id', sql.Int, userId ? Number(userId) : null)
    .input('audit_user', sql.NVarChar(255), user ? String(user) : null)
    .query(`
      EXEC sys.sp_set_session_context @key = N'audit_user_id', @value = @audit_user_id;
      EXEC sys.sp_set_session_context @key = N'audit_user', @value = @audit_user;
    `);
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
      WHERE TRY_CONVERT(date, a.FECHA) >= DATEADD(day, -84, CAST(GETDATE() AS date))
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
// ESTE PROCEDIMIENTO CREA O ACTUALIZA LA MARCA DIARIA EN dbo.ASISTENCIA
// USANDO FECHA, HORA_ENTRADA Y HORA_SALIDA EN FORMATO MILITAR PARA EL USUARIO INDICADO.
async function saveAttendanceMark({ employeeId, date, entryTime, exitTime, recordedBy, observation }) {
  const pool = await getPool();
  const normalizedEmployeeId = Number(employeeId || 0);
  const normalizedDate = String(date || '').trim();
  const normalizedEntryTime = String(entryTime || '').trim();
  const normalizedExitTime = String(exitTime || '').trim();
  const normalizedRecordedBy = String(recordedBy || '').trim().slice(0, 30) || 'sistema';
  const normalizedObservation = String(observation || '').trim().slice(0, 255);

  if (!normalizedEmployeeId || normalizedEmployeeId <= 0) {
    throw new Error('Empleado requerido');
  }

  if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new Error('Fecha invalida');
  }

  if (!/^\d{2}:\d{2}$/.test(normalizedEntryTime) || !/^\d{2}:\d{2}$/.test(normalizedExitTime)) {
    throw new Error('Las horas deben estar en formato militar HH:mm');
  }

  if (normalizedEntryTime >= normalizedExitTime) {
    throw new Error('La hora de salida debe ser mayor que la hora de entrada');
  }

  const result = await pool
    .request()
    .input('employee_id', sql.Int, normalizedEmployeeId)
    .input('attendance_date', sql.Date, normalizedDate)
    .input('attendance_date_text', sql.VarChar(10), normalizedDate)
    .input('entry_time_text', sql.VarChar(5), normalizedEntryTime)
    .input('exit_time_text', sql.VarChar(5), normalizedExitTime)
    .input('attendance_status', sql.VarChar(20), 'PRESENTE')
    .input('observation', sql.VarChar(255), normalizedObservation || null)
    .input('recorded_by', sql.VarChar(30), normalizedRecordedBy)
    .query(`
      IF EXISTS (
        SELECT 1
        FROM dbo.ASISTENCIA
        WHERE ID_EMPLEADO = @employee_id
          AND FECHA = @attendance_date
      )
      BEGIN
        UPDATE dbo.ASISTENCIA
        SET HORA_ENTRADA = CONVERT(datetime, @attendance_date_text + 'T' + @entry_time_text + ':00', 126),
            HORA_SALIDA = CONVERT(datetime, @attendance_date_text + 'T' + @exit_time_text + ':00', 126),
            num_semana = DATEPART(ISO_WEEK, @attendance_date),
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
          CONVERT(datetime, @attendance_date_text + 'T' + @entry_time_text + ':00', 126),
          CONVERT(datetime, @attendance_date_text + 'T' + @exit_time_text + ':00', 126),
          DATEPART(ISO_WEEK, @attendance_date),
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

  return {
    id: Number(row.ID_ASISTENCIA),
    employeeId: Number(row.ID_EMPLEADO),
    date: row.FECHA,
    entryTime: row.HORA_ENTRADA || '',
    exitTime: row.HORA_SALIDA || '',
    status: row.ESTADO || 'PRESENTE',
  };
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
      ADD NUM_LOTE INT NULL;
    END;
  `);

  await pool.request().query(`
    CREATE OR ALTER PROCEDURE dbo.sp_recalcular_productos_proximos_vencer
    AS
    BEGIN
      SET NOCOUNT ON;

      TRUNCATE TABLE dbo.PRODUCTO_PROXIMO_VENCER;

      IF COL_LENGTH('dbo.inventario', 'FECHA_VENCIMIENTO') IS NULL
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
        i.FECHA_INGRESO,
        CAST(ISNULL(i.stock, 0) AS DECIMAL(18, 2)),
        i.NUM_LOTE,
        TRY_CONVERT(DATE, i.FECHA_VENCIMIENTO),
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), TRY_CONVERT(DATE, i.FECHA_VENCIMIENTO)),
        GETDATE()
      FROM dbo.producto p
      INNER JOIN dbo.inventario i
        ON i.codigo = p.codigo
      WHERE p.activo = 1
        AND TRY_CONVERT(DATE, i.FECHA_VENCIMIENTO) IS NOT NULL
        AND DATEDIFF(DAY, CAST(GETDATE() AS DATE), TRY_CONVERT(DATE, i.FECHA_VENCIMIENTO)) BETWEEN 0 AND 30
      ORDER BY DATEDIFF(DAY, CAST(GETDATE() AS DATE), TRY_CONVERT(DATE, i.FECHA_VENCIMIENTO)) ASC, p.nombre ASC;
    END
  `);
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
      STOCK,
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
    lotNumber: row.NUM_LOTE === null ? null : Number(row.NUM_LOTE),
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
        'Efectivo' AS TIPO_COMPRA,
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

    await transaction.commit();

    return {
      id: Number(result.recordset[0]?.inserted_cost_id || 0),
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
  const result = await pool.request().query(`
    WITH abonos_linea AS (
      SELECT
        ID_VENTA,
        SUM(MONTO) AS MONTO_ABONADO
      FROM dbo.CREDITO_ABONO_DETALLE
      GROUP BY ID_VENTA
    ),
    saldos_cliente AS (
      SELECT
        vc.ID_CLIENTE,
        SUM(CASE
          WHEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0) > 0
          THEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0)
          ELSE 0
        END) AS SALDO_CREDITO,
        COUNT(DISTINCT CASE
          WHEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(al.MONTO_ABONADO, 0) > 0
          THEN vc.ID_FACT
        END) AS CREDITOS_ABIERTOS
      FROM dbo.VENTA_CREDITO vc
      LEFT JOIN abonos_linea al
        ON al.ID_VENTA = vc.ID_VENTA
      GROUP BY vc.ID_CLIENTE
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
      ISNULL(al.MONTO_ABONADO, 0) AS MONTO_ABONADO
    FROM dbo.VENTA_CREDITO vc
    LEFT JOIN dbo.cliente c
      ON c.ID_CLIENTE = vc.ID_CLIENTE
    LEFT JOIN abonos_linea al
      ON al.ID_VENTA = vc.ID_VENTA
    LEFT JOIN saldos_cliente sc
      ON sc.ID_CLIENTE = vc.ID_CLIENTE
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
    total: Number(credit.PRECIO_VENTA || 0) * Number(credit.CANT_PD || 0),
    paidAmount: Number(credit.MONTO_ABONADO || 0),
    pendingAmount: Math.max(
      Number(credit.PRECIO_VENTA || 0) * Number(credit.CANT_PD || 0) - Number(credit.MONTO_ABONADO || 0),
      0,
    ),
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

async function registerCreditPayment({ customerId, amount, userId, description }) {
  const resolvedCustomerId = Number(customerId || 0);
  const resolvedAmount = Number(amount || 0);
  const resolvedUserId = Number(userId || 0);

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
        .input('created_at', sql.VarChar(40), paymentTimestamp)
        .query(`
          INSERT INTO dbo.PAGOS_CREDITO (
            DESCRIPCION_PAGO,
            MONTO,
            ID_CLIENTE,
            ID_FACTURA,
            ID_USUARIO,
            FECHA_HORA
          )
          VALUES (
            @description,
            @amount,
            @customer_id,
            @invoice_id,
            @user_id,
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
            vc.ID_FACT,
            (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(SUM(cad.MONTO), 0) AS SALDO
          FROM dbo.VENTA_CREDITO vc
          LEFT JOIN dbo.CREDITO_ABONO_DETALLE cad
            ON cad.ID_VENTA = vc.ID_VENTA
          WHERE vc.ID_CLIENTE = @customer_id
          GROUP BY vc.ID_VENTA, vc.ID_FACT, vc.PRECIO_VENTA, vc.CANT_PD
        )
        UPDATE vc
        SET ID_ESTADO_VENTA = CASE WHEN saldos.SALDO <= 0.005 THEN 4 ELSE 2 END
        FROM dbo.VENTA_CREDITO vc
        INNER JOIN saldos
          ON saldos.ID_VENTA = vc.ID_VENTA;

        WITH saldos AS (
          SELECT
            vc.ID_FACT,
            CASE
              WHEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(SUM(cad.MONTO), 0) > 0
              THEN (vc.PRECIO_VENTA * vc.CANT_PD) - ISNULL(SUM(cad.MONTO), 0)
              ELSE 0
            END AS SALDO
          FROM dbo.VENTA_CREDITO vc
          LEFT JOIN dbo.CREDITO_ABONO_DETALLE cad
            ON cad.ID_VENTA = vc.ID_VENTA
          WHERE vc.ID_CLIENTE = @customer_id
          GROUP BY vc.ID_VENTA, vc.ID_FACT, vc.PRECIO_VENTA, vc.CANT_PD
        )
        UPDATE c
        SET
          saldo = ISNULL((SELECT SUM(SALDO) FROM saldos), 0),
          CREDITOS_ABIERTOS = ISNULL((SELECT COUNT(DISTINCT ID_FACT) FROM saldos WHERE SALDO > 0.005), 0)
        FROM dbo.cliente c
        WHERE c.ID_CLIENTE = @customer_id;
      `);

    await transaction.commit();

    return {
      customerId: resolvedCustomerId,
      amount: Number(resolvedAmount.toFixed(2)),
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
  };

  return purchaseTables[Number(paymentTypeId)] || null;
}

function resolveSalePaymentTableAlias(paymentTypeId) {
  const paymentTables = {
    1: { table: 'dbo.VENTA_EFECTIVO', alias: 'Efectivo' },
    2: { table: 'dbo.VENTA_CREDITO', alias: 'Credito' },
    3: { table: 'dbo.VENTA_TRANSFERENCIA', alias: 'Transferencia' },
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

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA EL SIGUIENTE NUMERO DE FACTURA DISPONIBLE.
// EJECUTA SELECT ISNULL(MAX(ID_FACT), 0) + 1 FROM dbo.FACTURA
// PARA MOSTRAR EL NUMERO EN EL FORMULARIO DE VENTA ANTES DE GUARDAR.
async function getNextInvoiceNumber() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT ISNULL(MAX(ID_FACT), 0) + 1 AS next_invoice_id
    FROM dbo.FACTURA
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
      SELECT ID_FACT, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_EFECTIVO
      WHERE ID_FACT IS NOT NULL

      UNION ALL

      SELECT ID_FACT, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_CREDITO
      WHERE ID_FACT IS NOT NULL

      UNION ALL

      SELECT ID_FACT, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
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
    WITH lineas AS (
      SELECT ID_FACT, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_EFECTIVO
      WHERE ID_FACT IS NOT NULL

      UNION ALL

      SELECT ID_FACT, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
      FROM dbo.VENTA_CREDITO
      WHERE ID_FACT IS NOT NULL

      UNION ALL

      SELECT ID_FACT, ID_ESTADO_VENTA, PRECIO_VENTA * CANT_PD AS TOTAL, UTILIDAD, CANT_PD
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
    WHERE TRY_CONVERT(date, f.FECHA_HORA) = CONVERT(date, GETDATE())
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
async function annulInvoice(invoiceId) {
  if (!invoiceId || Number(invoiceId) <= 0) {
    throw new Error('Factura requerida para anular');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
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
      await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.ID_PD))
        .input('quantity', sql.Decimal(18, 2), Number(line.CANT_PD || 0))
        .query(`
          UPDATE i
          SET
            i.stock = i.stock + @quantity,
            i.actualizado_en = GETDATE()
          FROM dbo.inventario i
          INNER JOIN dbo.producto p
            ON p.codigo = i.codigo
          WHERE p.id_producto = @product_id
        `);
    }

    await new sql.Request(transaction)
      .input('invoice_id', sql.Int, Number(invoiceId))
      .query(`
        UPDATE ${paymentInfo.table}
        SET ID_ESTADO_VENTA = 3
        WHERE ID_FACT = @invoice_id
          AND ID_ESTADO_VENTA <> 3
      `);

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
async function activateInvoice(invoiceId) {
  if (!invoiceId || Number(invoiceId) <= 0) {
    throw new Error('Factura requerida para activar');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
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
          ID_PD,
          SUM(CANT_PD) AS CANT_PD
        FROM ${paymentInfo.table}
        WHERE ID_FACT = @invoice_id
          AND ID_ESTADO_VENTA = 3
        GROUP BY ID_PD
      `);

    const annulledLines = linesResult.recordset;

    if (annulledLines.length === 0) {
      throw new Error('La factura no esta anulada o no tiene lineas para activar');
    }

    for (const line of annulledLines) {
      const stockResult = await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.ID_PD))
        .input('quantity', sql.Decimal(18, 2), Number(line.CANT_PD || 0))
        .query(`
          UPDATE i
          SET
            i.stock = i.stock - @quantity,
            i.actualizado_en = GETDATE()
          FROM dbo.inventario i
          INNER JOIN dbo.producto p
            ON p.codigo = i.codigo
          WHERE p.id_producto = @product_id
            AND i.stock >= @quantity;

          SELECT @@ROWCOUNT AS affected_rows;
        `);

      if (Number(stockResult.recordset[0]?.affected_rows || 0) === 0) {
        throw new Error('No hay stock suficiente para activar la factura');
      }
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
async function registerSale({ user, userId, paymentTypeId, customerId, lines }) {
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

    const saleTimestamp = new Date().toISOString();
    const saleStatusId = resolveSaleStatusId(paymentTypeId);
    const totalItems = lines.reduce((total, line) => total + Number(line.quantity || 0), 0);
    const subtotal = lines.reduce((total, line) => total + Number(line.salePrice || 0) * Number(line.quantity || 0), 0);
    const resolvedCustomerId = await resolveSaleCustomerId(transaction, paymentTypeId, customerId);
    let firstInsertedSaleId = null;

    const nextInvoiceResult = await new sql.Request(transaction)
      .query(`
        SELECT ISNULL(MAX(ID_FACT), 0) + 1 AS next_invoice_id
        FROM dbo.FACTURA WITH (UPDLOCK, HOLDLOCK)
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

    for (const line of lines) {
      if (!line.productId || !line.quantity || line.quantity <= 0) {
        throw new Error('Linea de venta invalida');
      }

      const utility = (Number(line.salePrice) - Number(line.unitCost)) * Number(line.quantity);

      const result = await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.productId))
        .input('quantity', sql.Decimal(18, 2), Number(line.quantity))
        .input('unit_cost', sql.Decimal(18, 2), Number(line.unitCost))
        .input('sale_price', sql.Decimal(18, 2), Number(line.salePrice))
        .input('utility', sql.Decimal(18, 2), Number(utility.toFixed(2)))
        .input('user_name', sql.VarChar(120), user)
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
    }

    await transaction.commit();

    return {
      invoiceId,
      expectedInvoiceId,
      saleId: firstInsertedSaleId,
      saleTable,
      saleStatusId,
      savedLines: lines.length,
      savedAt: saleTimestamp,
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
      i.stock,
      i.stock_minimo,
      i.stock_maximo,
      i.categoria,
      i.proveedor,
      i.creado_por,
      i.creado_en,
      i.actualizado_por,
      i.actualizado_en,
      ISNULL(vma.CANTIDAD_VENDIDA_MES_ANTERIOR, 0) AS CANTIDAD_VENDIDA_MES_ANTERIOR
    FROM dbo.producto p
    INNER JOIN dbo.inventario i
      ON i.codigo = p.codigo
    LEFT JOIN ventas_mes_anterior vma
      ON vma.ID_PD = p.id_producto
    WHERE p.activo = 1
    ORDER BY p.nombre ASC
  `);

  return result.recordset.map((product) => ({
    id: product.id_producto,
    sku: product.codigo,
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
    supplier: product.proveedor,
    previousMonthSales: Number(product.CANTIDAD_VENDIDA_MES_ANTERIOR || 0),
    createdBy: product.creado_por,
    updatedBy: product.actualizado_por,
    createdAt: product.creado_en ? new Date(product.creado_en).toISOString() : null,
    updatedAt: product.actualizado_en ? new Date(product.actualizado_en).toISOString() : null,
  }));
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO ACTUALIZA LOS CAMPOS DE STOCK DE UN PRODUCTO EN dbo.inventario.
// RECIBE EL ID DEL PRODUCTO DESDE EL MODAL DE INVENTARIO EN src/app/app.ts.
// SOLO ACTUALIZA stock, stock_minimo Y stock_maximo; NO MODIFICA PRECIO, COSTO, SKU NI NOMBRE.
async function updateInventoryStockLevels({ productId, stock, minStock, maxStock }) {
  if (!productId || Number(productId) <= 0) {
    throw new Error('Producto requerido para actualizar inventario');
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('product_id', sql.Int, Number(productId))
    .input('stock', sql.Decimal(18, 2), Number(stock || 0))
    .input('min_stock', sql.Decimal(18, 2), Number(minStock || 0))
    .input('max_stock', sql.Decimal(18, 2), maxStock === null || maxStock === undefined ? null : Number(maxStock || 0))
    .query(`
      UPDATE i
      SET
        i.stock = @stock,
        i.stock_minimo = @min_stock,
        i.stock_maximo = @max_stock,
        i.actualizado_en = GETDATE()
      FROM dbo.inventario i
      INNER JOIN dbo.producto p
        ON p.codigo = i.codigo
      WHERE p.id_producto = @product_id;

      SELECT @@ROWCOUNT AS affected_rows;
    `);

  const affectedRows = Number(result.recordset[0]?.affected_rows || 0);

  if (affectedRows === 0) {
    throw new Error('No se encontro el producto para actualizar inventario');
  }

  return {
    productId: Number(productId),
    stock: Number(stock || 0),
    minStock: Number(minStock || 0),
    maxStock: maxStock === null || maxStock === undefined ? null : Number(maxStock || 0),
    affectedRows,
  };
}

function normalizeCutDate(date) {
  if (!date) {
    return new Date().toISOString().slice(0, 10);
  }

  const value = String(date).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
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

function mapDailyCut(cut) {
  return {
    id: Number(cut.ID_CORTE),
    date: cut.FECHA_CORTE,
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

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA LOS CORTES DIARIOS DESDE dbo.CORTE_DIARIO.
// SI RECIBE dateFrom Y dateTo, FILTRA EL HISTORICO POR RANGO DE FECHAS.
// SI RECIBE ID_USUARIO, FILTRA SOLO LOS CORTES DE ESE TURNO.
async function listDailyCuts(dateFrom, dateTo, userId) {
  const pool = await getPool();
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

  return result.recordset.map(mapDailyCut);
}

// PROCEDIMIENTO UBICADO EN server/data-access.js
// ESTE PROCEDIMIENTO CONSULTA LOS PAGOS DE CREDITO DEL DIA DESDE dbo.PAGOS_CREDITO.
// SI RECIBE ID_USUARIO, FILTRA SOLO LOS ABONOS DEL TURNO DE ESE USUARIO.
// SE USA PARA MOSTRAR ABONOS EN EL MODAL DE CORTE.
async function listCreditPaymentsByDate(date, userId) {
  const pool = await getPool();
  const cutDate = normalizeCutDate(date);
  const request = pool.request()
    .input('cut_date', sql.VarChar(10), cutDate);

  if (userId !== null && userId !== undefined && userId !== '') {
    request.input('user_id', sql.Int, Number(userId));
  }

  const result = await request
    .query(`
      SELECT
        pc.ID_PAGO_CREDITO,
        pc.DESCRIPCION_PAGO,
        pc.MONTO,
        pc.ID_CLIENTE,
        CONCAT(ISNULL(c.NOMBRE, ''), ' ', ISNULL(c.APELLIDO, '')) AS CLIENTE,
        pc.ID_FACTURA,
        pc.ID_USUARIO,
        u.nombre AS USUARIO,
        pc.FECHA_HORA
      FROM dbo.PAGOS_CREDITO pc
      LEFT JOIN dbo.cliente c
        ON c.ID_CLIENTE = pc.ID_CLIENTE
      LEFT JOIN dbo.usuario u
        ON u.id_usuario = pc.ID_USUARIO
      WHERE TRY_CONVERT(date, pc.FECHA_HORA) = TRY_CONVERT(date, @cut_date)
      ${userId !== null && userId !== undefined && userId !== '' ? 'AND pc.ID_USUARIO = @user_id' : ''}
      ORDER BY pc.ID_PAGO_CREDITO DESC
    `);

  return result.recordset.map((payment) => ({
    id: Number(payment.ID_PAGO_CREDITO),
    description: payment.DESCRIPCION_PAGO,
    amount: Number(payment.MONTO || 0),
    customerId: Number(payment.ID_CLIENTE || 0),
    customerName: String(payment.CLIENTE || '').trim() || 'Cliente sin nombre',
    invoiceId: Number(payment.ID_FACTURA || 0),
    userId: Number(payment.ID_USUARIO || 0),
    userName: payment.USUARIO || 'Usuario sin nombre',
    createdAt: payment.FECHA_HORA,
  }));
}

async function calculateDailyCutTotals(transaction, date, userId, initialCashOverride) {
  const cutDate = normalizeCutDate(date);
  const resolvedUserId = Number(userId || 0);

  if (!resolvedUserId || resolvedUserId <= 0) {
    throw new Error('Usuario requerido para calcular el corte');
  }

  const result = await new sql.Request(transaction)
    .input('cut_date', sql.VarChar(10), cutDate)
    .input('user_id', sql.Int, resolvedUserId)
    .query(`
      WITH ventas AS (
        SELECT
          ve.PRECIO_VENTA * ve.CANT_PD AS total,
          ve.UTILIDAD AS utilidad,
          1 AS id_tp,
          ve.FECHA_HORA,
          f.ID_USUARIO
        FROM dbo.VENTA_EFECTIVO ve
        INNER JOIN dbo.FACTURA f
          ON f.ID_FACT = ve.ID_FACT

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
      )
      SELECT
        ISNULL(SUM(total), 0) AS venta_total_dia,
        ISNULL(SUM(CASE WHEN id_tp = 1 THEN total ELSE 0 END), 0) AS venta_efectivo,
        ISNULL(SUM(CASE WHEN id_tp = 2 THEN total ELSE 0 END), 0) AS venta_credito,
        ISNULL(SUM(CASE WHEN id_tp = 3 THEN total ELSE 0 END), 0) AS venta_transferencia,
        ISNULL(SUM(utilidad), 0) AS ganancia_del_dia,
        ISNULL((
          SELECT SUM(MONTO)
          FROM dbo.PAGOS_CREDITO
          WHERE TRY_CONVERT(date, FECHA_HORA) = TRY_CONVERT(date, @cut_date)
            AND ID_USUARIO = @user_id
        ), 0) AS abonos_credito
      FROM ventas
      WHERE TRY_CONVERT(date, FECHA_HORA) = TRY_CONVERT(date, @cut_date)
        AND ID_USUARIO = @user_id
    `);

  const totals = result.recordset[0] || {};
  const initialCash = initialCashOverride === null || initialCashOverride === undefined
    ? await getLatestOpenInitialCash(transaction, cutDate, resolvedUserId)
    : Number(initialCashOverride || 0);
  const cashIn = 0;
  const cashOut = 0;
  const cashSales = Number(totals.venta_efectivo || 0);
  const creditPayments = Number(totals.abonos_credito || 0);

  return {
    cutDate,
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
    await setAuditContext(transaction, { userId });

    const cash = Number(initialCash || 0);

    if (!Number.isFinite(cash) || cash < 0) {
      throw new Error('Monto inicial de caja invalido');
    }

    const resolvedUserId = Number(userId || 0);

    if (!resolvedUserId || resolvedUserId <= 0) {
      throw new Error('Usuario requerido para abrir el turno');
    }

    const totals = await calculateDailyCutTotals(transaction, date, resolvedUserId, cash);
    const cutTimestamp = buildCurrentCutTimestamp();
    const result = await new sql.Request(transaction)
      .input('fecha_corte', sql.VarChar(40), cutTimestamp)
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
        .input('quantity', sql.Decimal(18, 2), Number(line.quantity))
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

      await new sql.Request(transaction)
        .input('product_id', sql.Int, Number(line.productId))
        .input('quantity', sql.Decimal(18, 2), Number(line.quantity))
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
          FROM dbo.inventario i
          INNER JOIN dbo.producto p
            ON p.codigo = i.codigo
          WHERE p.id_producto = @product_id
        `);
    }

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
    const resolvedUserId = Number(userId || 0);

    if (!resolvedUserId || resolvedUserId <= 0) {
      throw new Error('Usuario requerido para calcular el corte');
    }

    const totals = await calculateDailyCutTotals(transaction, date, resolvedUserId);
    const userResult = await new sql.Request(transaction)
      .input('user_id', sql.Int, resolvedUserId)
      .query(`
        SELECT TOP 1 nombre
        FROM dbo.usuario
        WHERE id_usuario = @user_id
      `);
    await transaction.commit();

    return {
      id: 0,
      date: totals.cutDate,
      userId: resolvedUserId,
      userName: userResult.recordset[0]?.nombre || 'Usuario sin nombre',
      totalSales: totals.totalSales,
      initialCash: totals.initialCash,
      cashSales: totals.cashSales,
      transferSales: totals.transferSales,
      creditSales: totals.creditSales,
      creditPayments: totals.creditPayments,
      cashIn: totals.cashIn,
      cashOut: totals.cashOut,
      cashTotal: totals.cashTotal,
      statusId: 1,
      statusName: 'Abierto',
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
    const resolvedUserId = Number(userId || 0);

    if (!resolvedUserId || resolvedUserId <= 0) {
      throw new Error('Usuario requerido para cerrar el turno');
    }

    await setAuditContext(transaction, { userId: resolvedUserId });

    const totals = await calculateDailyCutTotals(transaction, date, resolvedUserId);
    const cashTotal = physicalCashCount === null || physicalCashCount === undefined || physicalCashCount === ''
      ? totals.cashTotal
      : Number(physicalCashCount);
    const cutTimestamp = buildCurrentCutTimestamp();

    await new sql.Request(transaction)
      .input('cut_date', sql.VarChar(10), totals.cutDate)
      .input('user_id', sql.Int, resolvedUserId)
      .input('closed_status', sql.Int, 4)
      .query(`
        UPDATE dbo.CORTE_DIARIO
        SET ESTADO_CORTE = @closed_status
        WHERE TRY_CONVERT(date, FECHA_CORTE) = TRY_CONVERT(date, @cut_date)
          AND ID_USUARIO = @user_id
          AND ESTADO_CORTE = 1
      `);

    const result = await new sql.Request(transaction)
      .input('fecha_corte', sql.VarChar(40), cutTimestamp)
      .input('user_id', sql.Int, resolvedUserId)
      .input('venta_total_dia', sql.Decimal(18, 2), totals.totalSales)
      .input('dinero_inicia_caja', sql.Decimal(18, 2), totals.initialCash)
      .input('venta_efectivo', sql.Decimal(18, 2), totals.cashSales)
      .input('venta_transferencia', sql.Decimal(18, 2), totals.transferSales)
      .input('venta_credito', sql.Decimal(18, 2), totals.creditSales)
      .input('abonos_credito', sql.Decimal(18, 2), totals.creditPayments)
      .input('entrada_de_dinero', sql.Decimal(18, 2), totals.cashIn)
      .input('salida_de_dinero', sql.Decimal(18, 2), totals.cashOut)
      .input('total_en_caja', sql.Decimal(18, 2), Number(cashTotal.toFixed(2)))
      .input('estado_corte', sql.Int, 4)
      .input('ganancia_del_dia', sql.Decimal(18, 2), totals.profit)
      .query(`
        INSERT INTO dbo.CORTE_DIARIO (
          FECHA_CORTE,
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
// ESTE PROCEDIMIENTO CONSULTA EL HISTORICO REAL DE dbo.auditoria.
// LEE LAS COLUMNAS DISPONIBLES DE LA TABLA PARA SOPORTAR DIFERENTES ESTRUCTURAS.
// GENERA registros normalizados para mostrarlos en el modulo Historico de src/app/app.html.
async function listAuditHistory(limit = 200) {
  const safeLimit = Math.min(Math.max(Number(limit || 200), 1), 500);
  const pool = await getPool();
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
    'fecha_hora',
    'fecha',
    'registrado_en',
    'creado_en',
    'id_auditoria',
    'id',
  ]) || columns[0];

  const result = await pool.request().query(`
    SELECT TOP (${safeLimit}) *
    FROM dbo.auditoria
    ORDER BY ${sqlColumnName(orderColumn)} DESC;
  `);

  return result.recordset.map((row, index) => {
    const pick = (candidates) => {
      const key = candidates.find((candidate) => Object.prototype.hasOwnProperty.call(row, candidate));
      return key ? row[key] : null;
    };
    const rawDate = pick(['fecha_hora', 'fecha', 'registrado_en', 'creado_en', 'FECHA_HORA', 'FECHA']);
    const rawUserId = pick(['id_usuario', 'usuario_id', 'ID_USUARIO', 'ID_USER']);
    const userName = pick(['usuario', 'usuario_bd', 'creado_por', 'USUARIO']);

    return {
      id: Number(pick(['id_auditoria', 'id', 'ID_AUDITORIA', 'ID_AUD', 'ID']) || index + 1),
      tableName: String(pick(['tabla', 'nombre_tabla', 'tabla_afectada', 'TABLA_AFECTADA', 'TABLA']) || 'Sin tabla'),
      action: String(pick(['accion', 'operacion', 'tipo_movimiento', 'ACCION']) || 'MOVIMIENTO'),
      recordKey: pick(['clave', 'llave', 'id_registro', 'registro_id', 'registro']) === null
        ? ''
        : String(pick(['clave', 'llave', 'id_registro', 'registro_id', 'registro'])),
      user: String(userName || (rawUserId === null ? 'Sistema' : `Usuario ID ${rawUserId}`)),
      userId: rawUserId === null
        ? null
        : Number(rawUserId),
      date: rawDate instanceof Date ? rawDate.toISOString() : (rawDate ? String(rawDate) : null),
      previousData: String(pick(['dato_anterior', 'DATO_ANTERIOR']) || ''),
      newData: String(pick(['dato_nuevo', 'DATO_NUEVO']) || ''),
    };
  });
}

function sqlColumnName(columnName) {
  return `[${String(columnName).replace(/]/g, ']]')}]`;
}

module.exports = {
  activateInvoice,
  annulInvoice,
  createDailyCut,
  executeMonthlyCostIncreaseProcedure,
  createOpeningCut,
  createOperationalCost,
  getDashboardSalesSummary,
  getDashboardSalesTrend,
  getSalesByCategoryForPeriod,
  getSalesDropAlert,
  getSalesTotalByPeriod,
  listMonthlyCostIncreaseAlerts,
  listOperationalCosts,
  getInvoiceDetails,
  getInvoicesSummary,
  getNextInvoiceNumber,
  getProducts,
  listInvoices,
  listExpiringProducts,
  listPurchases,
  listTodayInvoices,
  listCustomers,
  listCredits,
  listAuditHistory,
  listCreditPaymentsByDate,
  listDailyCuts,
  previewDailyCut,
  refreshExpiringProducts,
  saveAttendanceMark,
  listSuppliers,
  listActiveUsers,
  listAttendanceUsers,
  loginUser,
  registerPurchase,
  registerCreditPayment,
  registerSale,
  updateInventoryStockLevels,
};
