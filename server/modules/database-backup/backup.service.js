const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { getDbConfig, getPool, resetPool, sql } = require('../../db');

const backupTypes = {
  automatic: 'Automático',
  manual: 'Manual',
  preRestore: 'Pre-Restauración',
};
const backupStatuses = {
  success: 'Correcto',
  error: 'Error',
};
const moduleDir = __dirname;
const storageDir = path.join(moduleDir, 'storage');
const configFile = path.join(storageDir, 'backup-config.json');
const historyFile = path.join(storageDir, 'backup-history.json');
const defaultBackupDir = process.env.DB_BACKUP_DIR || path.join(process.cwd(), 'database-backups');
const minPreRestoreBackups = Number(process.env.DB_BACKUP_MIN_PRE_RESTORE || 3);

let schedulerTimer = null;
let schedulerRunning = false;
let schedulerAudit = null;

function ensureStorage() {
  fs.mkdirSync(storageDir, { recursive: true });
}

function defaultConfig() {
  return {
    enabled: false,
    frequency: 'daily',
    time: '23:00',
    maxBackups: 15,
    backupDir: defaultBackupDir,
    lastAutomaticRunKey: '',
  };
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureStorage();
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeConfig(rawConfig = {}) {
  const defaults = defaultConfig();
  const maxBackups = Number(rawConfig.maxBackups ?? defaults.maxBackups);
  const frequency = ['daily', 'weekly'].includes(rawConfig.frequency) ? rawConfig.frequency : defaults.frequency;
  const time = /^\d{2}:\d{2}$/.test(String(rawConfig.time || '')) ? String(rawConfig.time) : defaults.time;
  const backupDir = String(rawConfig.backupDir || defaults.backupDir).trim() || defaults.backupDir;

  return {
    enabled: Boolean(rawConfig.enabled),
    frequency,
    time,
    maxBackups: Number.isFinite(maxBackups) ? Math.max(3, Math.min(365, Math.trunc(maxBackups))) : defaults.maxBackups,
    backupDir: path.resolve(backupDir),
    lastAutomaticRunKey: String(rawConfig.lastAutomaticRunKey || ''),
  };
}

function getBackupConfig() {
  return normalizeConfig(readJson(configFile, defaultConfig()));
}

function saveBackupConfig(nextConfig) {
  const config = normalizeConfig({
    ...getBackupConfig(),
    ...(nextConfig || {}),
  });
  writeJson(configFile, config);
  scheduleAutomaticBackups();
  return config;
}

function readHistory() {
  const rows = readJson(historyFile, []);
  return Array.isArray(rows) ? rows : [];
}

function writeHistory(rows) {
  writeJson(historyFile, rows);
}

function nowStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: now,
    fileStamp: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`,
    iso: now.toISOString(),
  };
}

function ensureBackupDirectory(backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.accessSync(backupDir, fs.constants.R_OK | fs.constants.W_OK);
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relativePath === '' || (!!relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function buildBackupFileName(type) {
  const prefix = type === backupTypes.preRestore ? 'pre_restore_backup' : 'backup';
  return `${prefix}_${nowStamp().fileStamp}.bak`;
}

function resolveNewBackupPath(type, backupDir) {
  const parsed = path.parse(buildBackupFileName(type));
  let backupPath = path.join(backupDir, `${parsed.name}${parsed.ext}`);
  let sequence = 1;

  while (fs.existsSync(backupPath)) {
    backupPath = path.join(backupDir, `${parsed.name}_${sequence}${parsed.ext}`);
    sequence += 1;
  }

  return backupPath;
}

function resolveExistingBackupPath(fileName, backupDir) {
  const safeFileName = path.basename(String(fileName || ''));

  if (!safeFileName.toLowerCase().endsWith('.bak')) {
    throw new Error('Solo se permiten archivos .bak del directorio autorizado.');
  }

  const backupPath = path.resolve(backupDir, safeFileName);

  if (!isPathInside(backupDir, backupPath)) {
    throw new Error('No se permiten archivos fuera del directorio autorizado de respaldos.');
  }

  if (!fs.existsSync(backupPath)) {
    throw new Error('El archivo de respaldo no existe.');
  }

  return backupPath;
}

async function getDriveFreeBytes(targetPath) {
  if (process.platform !== 'win32') {
    return null;
  }

  const root = path.parse(path.resolve(targetPath)).root.replace(/\\$/, '');

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${root}'").FreeSpace`],
      { windowsHide: true, timeout: 10000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }

        const freeBytes = Number(String(stdout || '').trim());
        resolve(Number.isFinite(freeBytes) ? freeBytes : null);
      },
    );
  });
}

async function validateBackupDirectory(backupDir) {
  ensureBackupDirectory(backupDir);
  const probePath = path.join(backupDir, `.backup-access-${process.pid}.tmp`);
  fs.writeFileSync(probePath, 'ok', 'utf8');
  fs.unlinkSync(probePath);

  return {
    backupDir,
    freeBytes: await getDriveFreeBytes(backupDir),
  };
}

async function estimateDatabaseSizeBytes(pool, databaseName) {
  const result = await pool.request()
    .input('database_name', sql.NVarChar(128), databaseName)
    .query(`
      SELECT SUM(CAST(size AS bigint)) * 8 * 1024 AS size_bytes
      FROM sys.master_files
      WHERE database_id = DB_ID(@database_name);
    `);

  const sizeBytes = Number(result.recordset[0]?.size_bytes || 0);
  return Number.isFinite(sizeBytes) ? sizeBytes : 0;
}

function sqlIdentifier(identifier) {
  return `[${String(identifier || '').replace(/]/g, ']]')}]`;
}

function buildMasterConfig() {
  return {
    ...getDbConfig(),
    database: 'master',
    pool: {
      max: 1,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: Math.max(Number(process.env.DB_RESTORE_TIMEOUT || 900000), 120000),
  };
}

async function createMasterPool() {
  const pool = new sql.ConnectionPool(buildMasterConfig());
  await pool.connect();
  return pool;
}

function mapHistoryRow(row) {
  const filePath = String(row.filePath || '');
  let size = Number(row.size || 0);

  if ((!size || size < 0) && filePath && fs.existsSync(filePath)) {
    size = fs.statSync(filePath).size;
  }

  return {
    id: String(row.id || `${row.createdAt}-${path.basename(filePath)}`),
    createdAt: row.createdAt || null,
    type: row.type || backupTypes.manual,
    status: row.status || backupStatuses.error,
    fileName: row.fileName || path.basename(filePath),
    filePath,
    size,
    message: row.message || '',
    userId: row.userId || null,
    user: row.user || 'Sistema',
    protected: row.type === backupTypes.preRestore,
  };
}

function addHistory(row) {
  const history = readHistory().map(mapHistoryRow);
  const nextRow = mapHistoryRow({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: nowStamp().iso,
    ...row,
  });

  history.unshift(nextRow);
  writeHistory(history.slice(0, 500));
  return nextRow;
}

async function auditOperation(audit, operation, result, payload = {}) {
  if (!audit) {
    return;
  }

  try {
    await audit({
      tableName: 'RESPALDO_BASE_DATOS',
      action: operation,
      recordKey: payload.fileName || '',
      userId: payload.userId || null,
      user: payload.user || 'Sistema',
      previousData: '',
      newData: JSON.stringify({
        result,
        file: payload.filePath || '',
        message: payload.message || '',
      }),
    });
  } catch {
    // La operacion principal no debe fallar por una auditoria secundaria.
  }
}

function assertAdminUser(user = {}) {
  const role = String(user.rol || user.role || '').toLowerCase();

  if (!role.includes('admin') && !role.includes('administrador')) {
    throw new Error('Solo usuarios administrativos pueden ejecutar esta operacion.');
  }
}

async function verifySqlBackup(backupPath) {
  const masterPool = await createMasterPool();

  try {
    await masterPool.request()
      .input('backup_path', sql.NVarChar(4000), backupPath)
      .query('RESTORE VERIFYONLY FROM DISK = @backup_path WITH CHECKSUM;');

    const header = await masterPool.request()
      .input('backup_path', sql.NVarChar(4000), backupPath)
      .query('RESTORE HEADERONLY FROM DISK = @backup_path;');

    return {
      ok: true,
      databaseName: header.recordset[0]?.DatabaseName || null,
      backupStartDate: header.recordset[0]?.BackupStartDate || null,
      backupFinishDate: header.recordset[0]?.BackupFinishDate || null,
    };
  } finally {
    await masterPool.close();
  }
}

async function createBackup({
  type = backupTypes.manual,
  user = null,
  audit = null,
  applyRetention = true,
} = {}) {
  const config = getBackupConfig();
  const backupDir = config.backupDir;
  const createdAt = nowStamp().iso;
  let backupPath = '';

  try {
    if (user) {
      assertAdminUser(user);
    }

    await validateBackupDirectory(backupDir);
    backupPath = resolveNewBackupPath(type, backupDir);

    const pool = await getPool();
    const dbConfig = getDbConfig();
    const estimatedSizeBytes = await estimateDatabaseSizeBytes(pool, dbConfig.database);
    const freeBytes = await getDriveFreeBytes(backupDir);

    if (freeBytes !== null && estimatedSizeBytes > 0 && freeBytes < estimatedSizeBytes * 1.2) {
      throw new Error('No hay espacio suficiente para generar el respaldo.');
    }

    await pool.request()
      .input('backup_path', sql.NVarChar(4000), backupPath)
      .query(`BACKUP DATABASE ${sqlIdentifier(dbConfig.database)} TO DISK = @backup_path WITH INIT, CHECKSUM, STATS = 10;`);

    const stats = fs.statSync(backupPath);

    if (!stats.size) {
      throw new Error('SQL Server genero un archivo de respaldo vacio.');
    }

    await verifySqlBackup(backupPath);

    const row = addHistory({
      createdAt,
      type,
      status: backupStatuses.success,
      fileName: path.basename(backupPath),
      filePath: backupPath,
      size: stats.size,
      message: type === backupTypes.manual ? 'Respaldo generado correctamente.' : 'Respaldo generado correctamente.',
      userId: user?.id || null,
      user: user?.nombre || user?.usuario || 'Sistema',
    });

    await auditOperation(audit, 'BACKUP_DATABASE', 'Correcto', row);

    if (applyRetention) {
      await cleanupOldBackups({ audit });
    }

    return row;
  } catch (error) {
    const row = addHistory({
      createdAt,
      type,
      status: backupStatuses.error,
      fileName: backupPath ? path.basename(backupPath) : '',
      filePath: backupPath,
      size: backupPath && fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0,
      message: error.message || 'No se pudo generar el respaldo.',
      userId: user?.id || null,
      user: user?.nombre || user?.usuario || 'Sistema',
    });

    await auditOperation(audit, 'BACKUP_DATABASE', 'Error', row);
    throw error;
  }
}

async function createEmergencyBackup(options = {}) {
  return createBackup({
    ...options,
    type: backupTypes.preRestore,
    applyRetention: false,
  });
}

async function listBackups() {
  const config = getBackupConfig();
  ensureBackupDirectory(config.backupDir);
  const history = readHistory().map(mapHistoryRow);
  const knownFiles = new Set(history.map((row) => path.basename(row.filePath || row.fileName || '')));
  const diskRows = fs.readdirSync(config.backupDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.bak') && !knownFiles.has(fileName))
    .map((fileName) => {
      const filePath = path.join(config.backupDir, fileName);
      const stats = fs.statSync(filePath);

      return mapHistoryRow({
        id: `disk-${fileName}`,
        createdAt: stats.birthtime?.toISOString?.() || stats.mtime.toISOString(),
        type: fileName.toLowerCase().startsWith('pre_restore_backup') ? backupTypes.preRestore : backupTypes.manual,
        status: backupStatuses.success,
        fileName,
        filePath,
        size: stats.size,
        message: 'Archivo encontrado en carpeta de respaldos.',
      });
    });

  const backups = [...history, ...diskRows]
    .filter((row) => row.type !== 'Restauración' && row.fileName && row.filePath && fs.existsSync(row.filePath))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return {
    config,
    backups,
    latest: backups[0] || null,
  };
}

async function validateBackupForRestore(fileName) {
  const config = getBackupConfig();
  const backupPath = resolveExistingBackupPath(fileName, config.backupDir);
  const stats = fs.statSync(backupPath);

  if (!stats.size) {
    throw new Error('El archivo de respaldo esta vacio.');
  }

  const freeBytes = await getDriveFreeBytes(config.backupDir);
  const verification = await verifySqlBackup(backupPath);
  const currentDbName = getDbConfig().database;

  return {
    ok: true,
    fileName: path.basename(backupPath),
    filePath: backupPath,
    size: stats.size,
    freeBytes,
    databaseName: verification.databaseName,
    compatible: !verification.databaseName || String(verification.databaseName).toLowerCase() === String(currentDbName).toLowerCase(),
  };
}

async function restoreBackup({ fileName, user, audit } = {}) {
  assertAdminUser(user);

  const validation = await validateBackupForRestore(fileName);

  if (!validation.compatible) {
    throw new Error(`El respaldo pertenece a la base ${validation.databaseName}, no a la base actual ${getDbConfig().database}.`);
  }

  const emergencyBackup = await createEmergencyBackup({ user, audit });

  if (emergencyBackup.status !== backupStatuses.success || !fs.existsSync(emergencyBackup.filePath)) {
    throw new Error('No se pudo crear el respaldo de emergencia. Restauracion cancelada sin modificar la base actual.');
  }

  let masterPool = null;
  const dbConfig = getDbConfig();

  try {
    await resetPool();
    masterPool = await createMasterPool();

    await masterPool.request()
      .input('backup_path', sql.NVarChar(4000), validation.filePath)
      .query(`
      ALTER DATABASE ${sqlIdentifier(dbConfig.database)} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      RESTORE DATABASE ${sqlIdentifier(dbConfig.database)} FROM DISK = @backup_path WITH REPLACE, CHECKSUM, STATS = 10;
      ALTER DATABASE ${sqlIdentifier(dbConfig.database)} SET MULTI_USER;
    `);
  } catch (error) {
    if (masterPool) {
      try {
        await masterPool.request().query(`ALTER DATABASE ${sqlIdentifier(dbConfig.database)} SET MULTI_USER;`);
      } catch {
        // SQL Server puede quedar restaurando o inaccesible; se reporta el respaldo de emergencia.
      }
    }

    const row = addHistory({
      type: 'Restauración',
      status: backupStatuses.error,
      fileName: validation.fileName,
      filePath: validation.filePath,
      size: validation.size,
      message: `${error.message || 'La restauracion fallo.'} Respaldo previo: ${emergencyBackup.filePath}`,
      userId: user?.id || null,
      user: user?.nombre || user?.usuario || 'Sistema',
    });

    await auditOperation(audit, 'RESTORE_DATABASE', 'Error', row);
    throw new Error(`${error.message || 'La restauracion fallo.'} Respaldo de emergencia disponible en: ${emergencyBackup.filePath}`);
  } finally {
    if (masterPool) {
      await masterPool.close();
    }
  }

  await resetPool();
  await getPool();

  const row = addHistory({
    type: 'Restauración',
    status: backupStatuses.success,
    fileName: validation.fileName,
    filePath: validation.filePath,
    size: validation.size,
    message: `Base restaurada correctamente. Respaldo previo: ${emergencyBackup.filePath}`,
    userId: user?.id || null,
    user: user?.nombre || user?.usuario || 'Sistema',
  });

  await auditOperation(audit, 'RESTORE_DATABASE', 'Correcto', row);

  return {
    ...row,
    emergencyBackup,
  };
}

async function cleanupOldBackups({ audit = null } = {}) {
  const { backups, config } = await listBackups();
  const normalBackups = backups.filter((row) => row.type !== backupTypes.preRestore && row.type !== 'Restauración');
  const protectedBackups = backups.filter((row) => row.type === backupTypes.preRestore);
  const removable = normalBackups.slice(config.maxBackups);
  const removableProtected = protectedBackups.slice(Math.max(minPreRestoreBackups, 1));
  const removed = [];

  for (const row of [...removable, ...removableProtected]) {
    try {
      if (row.filePath && fs.existsSync(row.filePath)) {
        fs.unlinkSync(row.filePath);
        removed.push(row);
      }
    } catch {
      // La limpieza no debe impedir nuevos respaldos.
    }
  }

  if (removed.length > 0) {
    await auditOperation(audit, 'BACKUP_RETENTION_CLEANUP', 'Correcto', {
      fileName: `${removed.length} archivo(s)`,
      filePath: removed.map((row) => row.filePath).join('; '),
      message: `Retencion aplicada: ${config.maxBackups} respaldos normales, ${minPreRestoreBackups} pre-restauracion.`,
    });
  }

  return { removed };
}

function nextScheduleDelay(config) {
  const now = new Date();
  const [hour, minute] = config.time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  if (config.frequency === 'weekly') {
    while (next.getDay() !== 0 || next <= now) {
      next.setDate(next.getDate() + 1);
    }
  }

  return Math.max(1000, next.getTime() - now.getTime());
}

function automaticRunKey(config, date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return config.frequency === 'weekly' ? `${base}-weekly` : `${base}-daily`;
}

async function runAutomaticBackup({ audit = null } = {}) {
  const config = getBackupConfig();

  if (!config.enabled || schedulerRunning) {
    return null;
  }

  const runKey = automaticRunKey(config);

  if (config.lastAutomaticRunKey === runKey) {
    return null;
  }

  schedulerRunning = true;

  try {
    const row = await createBackup({ type: backupTypes.automatic, audit });
    saveBackupConfig({ lastAutomaticRunKey: runKey });
    return row;
  } finally {
    schedulerRunning = false;
  }
}

function scheduleAutomaticBackups({ audit = null } = {}) {
  if (audit) {
    schedulerAudit = audit;
  }

  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  const config = getBackupConfig();

  if (!config.enabled) {
    return;
  }

  schedulerTimer = setTimeout(async () => {
    try {
      await runAutomaticBackup({ audit: schedulerAudit });
    } catch {
      // El error queda registrado en historial por createBackup.
    } finally {
      scheduleAutomaticBackups({ audit: schedulerAudit });
    }
  }, nextScheduleDelay(config));
}

module.exports = {
  backupTypes,
  cleanupOldBackups,
  createBackup,
  createEmergencyBackup,
  getBackupConfig,
  listBackups,
  runAutomaticBackup,
  saveBackupConfig,
  scheduleAutomaticBackups,
  validateBackupForRestore,
  restoreBackup,
};
