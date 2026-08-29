const express = require('express');
const {
  cleanupOldBackups,
  createBackup,
  getBackupConfig,
  listBackups,
  runAutomaticBackup,
  saveBackupConfig,
  restoreBackup,
  validateBackupForRestore,
} = require('./backup.service');

function createDatabaseBackupRouter({ audit }) {
  const router = express.Router();

  router.get('/database-backups', async (_req, res) => {
    try {
      return res.json(await listBackups());
    } catch (error) {
      return res.status(500).json({ message: error.message || 'No se pudieron cargar los respaldos.' });
    }
  });

  router.get('/database-backups/config', async (_req, res) => {
    return res.json({ config: getBackupConfig() });
  });

  router.put('/database-backups/config', async (req, res) => {
    try {
      const user = req.body?.user || null;
      const role = String(user?.rol || user?.role || '').toLowerCase();

      if (!role.includes('admin') && !role.includes('administrador')) {
        return res.status(403).json({ message: 'Solo usuarios administrativos pueden configurar respaldos.' });
      }

      const config = saveBackupConfig(req.body?.config || {});

      if (audit) {
        await audit({
          tableName: 'RESPALDO_BASE_DATOS',
          action: 'CONFIGURAR_RESPALDOS',
          recordKey: config.backupDir,
          userId: user?.id || null,
          user: user?.nombre || user?.usuario || 'Sistema',
          newData: JSON.stringify(config),
        });
      }

      return res.json({ config });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'No se pudo guardar la configuracion de respaldos.' });
    }
  });

  router.post('/database-backups/manual', async (req, res) => {
    try {
      const backup = await createBackup({ user: req.body?.user || null, audit });
      return res.json({ backup, message: 'Respaldo generado correctamente.' });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'No se pudo generar el respaldo.' });
    }
  });

  router.post('/database-backups/run-automatic', async (_req, res) => {
    try {
      const backup = await runAutomaticBackup({ audit });
      return res.json({ backup, skipped: !backup });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'No se pudo ejecutar el respaldo automatico.' });
    }
  });

  router.post('/database-backups/cleanup', async (_req, res) => {
    try {
      return res.json(await cleanupOldBackups({ audit }));
    } catch (error) {
      return res.status(400).json({ message: error.message || 'No se pudo aplicar la retencion.' });
    }
  });

  router.post('/database-backups/validate', async (req, res) => {
    try {
      return res.json(await validateBackupForRestore(req.body?.fileName));
    } catch (error) {
      return res.status(400).json({ message: error.message || 'El respaldo no es valido.' });
    }
  });

  router.post('/database-backups/restore', async (req, res) => {
    try {
      if (req.body?.confirmation !== 'CONFIRMO RESTAURAR') {
        return res.status(400).json({ message: 'La segunda confirmacion no coincide.' });
      }

      const result = await restoreBackup({
        fileName: req.body?.fileName,
        user: req.body?.user || null,
        audit,
      });

      return res.json({ restore: result, message: 'Base de datos restaurada correctamente.' });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'No se pudo restaurar la base de datos.' });
    }
  });

  return router;
}

module.exports = {
  createDatabaseBackupRouter,
};
