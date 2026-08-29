require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getPool, sql } = require('../server/db');

const projectRootPath = path.join(__dirname, '..');
const imageAssetsPrefix = 'assets/img/';
const imageAssetsPath = path.join(projectRootPath, 'src', 'img');
const dryRun = process.argv.includes('--dry-run');

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

function normalizeImageUrl(row) {
  const imageUrl = row.imagen_url;
  const current = String(imageUrl || '').trim().replace(/\\/g, '/');

  if (!current) {
    return null;
  }

  const matchingFile = findImageAssetFile(current) || findImageAssetFile(String(row.id_producto));

  if (!matchingFile) {
    return null;
  }

  return `${imageAssetsPrefix}${matchingFile}`;
}

async function main() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT id_producto, codigo, nombre, imagen_url
    FROM dbo.producto
    WHERE imagen_url IS NOT NULL
      AND LTRIM(RTRIM(imagen_url)) <> ''
    ORDER BY id_producto;
  `);

  const updates = [];
  const skipped = [];

  for (const row of result.recordset) {
    const currentImageUrl = String(row.imagen_url || '').trim();
    const nextImageUrl = normalizeImageUrl(row);

    if (!nextImageUrl) {
      skipped.push({
        id: row.id_producto,
        sku: row.codigo,
        name: row.nombre,
        imageUrl: currentImageUrl,
      });
      continue;
    }

    if (nextImageUrl !== currentImageUrl) {
      updates.push({
        id: row.id_producto,
        sku: row.codigo,
        name: row.nombre,
        from: currentImageUrl,
        to: nextImageUrl,
      });
    }
  }

  if (!dryRun) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const item of updates) {
        await new sql.Request(transaction)
          .input('product_id', sql.Int, Number(item.id))
          .input('image_url', sql.VarChar(500), item.to)
          .query(`
            UPDATE dbo.producto
            SET imagen_url = @image_url,
                actualizado_en = GETDATE()
            WHERE id_producto = @product_id;
          `);
      }

      await transaction.commit();
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        // Ignore rollback failure; the original error is more useful.
      }
      throw error;
    }
  }

  console.log(JSON.stringify({
    dryRun,
    scanned: result.recordset.length,
    updated: updates.length,
    skippedCount: skipped.length,
    updates: updates.slice(0, 30),
    skipped: skipped.slice(0, 30),
  }, null, 2));

  await pool.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
