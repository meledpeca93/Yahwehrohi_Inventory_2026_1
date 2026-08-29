require('dotenv').config({ override: true });

const cors = require('cors');
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { execFile } = require('child_process');
const { fileURLToPath } = require('url');
const { getPool, resetPool } = require('./db');
const {
  activateInvoice,
  annulInvoice,
  annulPurchase,
  createAssembledOfferCode,
  createDailyCut,
  createFinancialMovement,
  createInventoryProduct,
  createOpeningCut,
  createAuditHistoryRecord,
  createOperationalCost,
  createPettyCashRecord,
  createQuote,
  deleteDailyCutCashManagement,
  deletePettyCashRecord,
  updateAssembledOfferCode,
  listMonthlyCostIncreaseAlerts,
  getBillingProducts,
  getInactiveProducts,
  getDashboardSalesSummary,
  getDashboardSalesTrend,
  getSalesProfitabilityAnalytics,
  getSalesByCategoryForPeriod,
  getSalesDropAlert,
  getSalesTotalByPeriod,
  getInvoiceDetails,
  getInvoicesSummary,
  getNextInvoiceNumber,
  getProductInventoryDetail,
  getProducts,
  getQuoteDetails,
  getSystemHealth,
  listPayrollRecords,
  listActiveUsers,
  listAuditHistory,
  listAttendanceUsers,
  listCredits,
  listCreditPaymentsByDate,
  listCreditPaymentsHistory,
  listCreditPaymentsByCustomer,
  listDailyCuts,
  listCustomers,
  listExpiringProducts,
  listInvoices,
  listPurchases,
  listFinancialMovements,
  listAssembledOfferCodes,
  listOperationalCosts,
  listPettyCashRecords,
  listQuotes,
  listTodayInvoices,
  saveAttendanceMark,
  savePayrollWeek,
  listSuppliers,
  loginUser,
  previewDailyCut,
  registerCreditPayment,
  registerPurchase,
  registerQuickInventoryPurchase,
  registerQuickInventoryReduction,
  registerSale,
  reactivateInventoryProduct,
  updateDailyCutCashManagement,
  updatePettyCashRecord,
  updateProductActiveStatus,
  updateInventoryStockLevels,
} = require('./data-access');
const { createFacturacionRouter } = require('./modules/facturacion/facturacion.routes');
const { createDatabaseBackupRouter } = require('./modules/database-backup/backup.routes');
const { scheduleAutomaticBackups } = require('./modules/database-backup/backup.service');
const {
  parseReactivarProductoRequest,
  toInactiveProductsResponse,
  toReactivatedProductResponse,
} = require('./modules/inventario/inventario.dto');

const app = express();
const port = Number(process.env.PORT || 3000);
let sharp = null;

try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

app.use(cors({ origin: ['http://localhost:4200', 'http://127.0.0.1:4200'] }));
app.use(express.json());

const imageAssetsPrefix = 'assets/img/';
const imageAssetsPath = path.join(__dirname, '..', 'src', 'img');
const productThumbnailsPath = path.join(__dirname, '..', 'public', 'product-thumbnails');
const legacyProductImagesPath = path.join(
  process.env.USERPROFILE || 'C:\\Users\\InversionesYR',
  'Documents',
  'Vanguard Software Group',
  'Sistema punto de venta VSG - Imagenes Productos',
);
let imageAssetFileNamesCache = null;

function getImageAssetFileNames() {
  if (imageAssetFileNamesCache) {
    return imageAssetFileNamesCache;
  }

  if (!fs.existsSync(imageAssetsPath)) {
    imageAssetFileNamesCache = [];
    return imageAssetFileNamesCache;
  }

  imageAssetFileNamesCache = fs.readdirSync(imageAssetsPath, { recursive: true })
    .filter((assetFileName) => fs.statSync(path.join(imageAssetsPath, assetFileName)).isFile())
    .map((assetFileName) => String(assetFileName).replace(/\\/g, '/'));

  return imageAssetFileNamesCache;
}

function findImageAssetFile(fileName) {
  const normalizedFileName = String(fileName || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const safeRelativeFileName = normalizedFileName
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
  const safeFileName = path.basename(safeRelativeFileName);

  if (!safeFileName) {
    return null;
  }

  const assetFileNames = getImageAssetFileNames();
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

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return !!relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function encodeProductImagePath(filePath) {
  return Buffer.from(filePath, 'utf8').toString('base64url');
}

function decodeProductImagePath(encodedPath) {
  try {
    return Buffer.from(String(encodedPath || ''), 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function resolveLocalProductImageFile(imageUrl) {
  const normalizedImageUrl = String(imageUrl || '').trim();

  if (!normalizedImageUrl) {
    return null;
  }

  let localImagePath = normalizedImageUrl;

  if (normalizedImageUrl.toLowerCase().startsWith('file://')) {
    try {
      localImagePath = fileURLToPath(normalizedImageUrl);
    } catch {
      return null;
    }
  }

  if (!path.isAbsolute(localImagePath)) {
    return null;
  }

  const resolvedImagePath = path.resolve(localImagePath);
  const allowedRoots = [imageAssetsPath, legacyProductImagesPath]
    .filter((rootPath) => fs.existsSync(rootPath))
    .map((rootPath) => path.resolve(rootPath));

  if (!allowedRoots.some((rootPath) => resolvedImagePath === rootPath || isPathInside(rootPath, resolvedImagePath))) {
    return null;
  }

  return fs.existsSync(resolvedImagePath) ? resolvedImagePath : null;
}

function resolveProductImageUrl(imageUrl) {
  const localImageFile = resolveLocalProductImageFile(imageUrl);

  if (localImageFile) {
    return `/api/product-images-local/${encodeProductImagePath(localImageFile)}`;
  }

  if (!imageUrl || !imageUrl.toLowerCase().startsWith(imageAssetsPrefix)) {
    return imageUrl;
  }

  const fileName = imageUrl.slice(imageAssetsPrefix.length);
  const matchingFile = findImageAssetFile(fileName);

  return matchingFile ? `/api/product-images/${encodeURIComponent(matchingFile)}` : imageUrl;
}

function resolveProductImageRequestFile(source, fileRef) {
  if (source === 'assets') {
    const matchingFile = findImageAssetFile(fileRef);
    return matchingFile ? path.join(imageAssetsPath, matchingFile) : null;
  }

  if (source === 'local') {
    return resolveLocalProductImageFile(decodeProductImagePath(fileRef));
  }

  return null;
}

function createWindowsThumbnail(sourceFile, destinationFile, size) {
  return new Promise((resolve, reject) => {
    const script = `& {
      param([string]$SourceFile, [string]$DestinationFile, [int]$Size)
      Add-Type -AssemblyName System.Drawing
      $image = [System.Drawing.Image]::FromFile($SourceFile)
      try {
        $thumb = New-Object System.Drawing.Bitmap $Size, $Size
        try {
          $graphics = [System.Drawing.Graphics]::FromImage($thumb)
          try {
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $scale = [Math]::Max($Size / $image.Width, $Size / $image.Height)
            $drawWidth = [int][Math]::Ceiling($image.Width * $scale)
            $drawHeight = [int][Math]::Ceiling($image.Height * $scale)
            $x = [int](($Size - $drawWidth) / 2)
            $y = [int](($Size - $drawHeight) / 2)
            $graphics.DrawImage($image, $x, $y, $drawWidth, $drawHeight)
            $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
            $params = New-Object System.Drawing.Imaging.EncoderParameters 1
            $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 72L
            $thumb.Save($DestinationFile, $encoder, $params)
          } finally {
            if ($graphics) { $graphics.Dispose() }
          }
        } finally {
          $thumb.Dispose()
        }
      } finally {
        $image.Dispose()
      }
    }`;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script, '-SourceFile', sourceFile, '-DestinationFile', destinationFile, '-Size', String(size)],
      { windowsHide: true, timeout: 20000 },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
}

async function sendProductThumbnail(req, res, source, fileRef) {
  const matchingFile = resolveProductImageRequestFile(source, fileRef);

  if (!matchingFile) {
    return res.status(404).json({ message: 'Imagen de producto no encontrada' });
  }

  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

  const size = Math.min(Math.max(Number(req.query.size || 120), 48), 320);
  const stat = fs.statSync(matchingFile);
  const cacheKey = crypto
    .createHash('sha1')
    .update(`${matchingFile}:${stat.mtimeMs}:${stat.size}:${size}`)
    .digest('hex');
  const thumbnailExtension = sharp ? 'webp' : 'jpg';
  const cachedFile = path.join(productThumbnailsPath, `${cacheKey}.${thumbnailExtension}`);

  try {
    await fs.promises.mkdir(productThumbnailsPath, { recursive: true });

    if (!fs.existsSync(cachedFile)) {
      if (sharp) {
        await sharp(matchingFile)
          .rotate()
          .resize(size, size, { fit: 'cover', withoutEnlargement: true })
          .webp({ quality: 72 })
          .toFile(cachedFile);
      } else {
        await createWindowsThumbnail(matchingFile, cachedFile, size);
      }
    }

    return res.type(sharp ? 'image/webp' : 'image/jpeg').sendFile(cachedFile);
  } catch {
    return res.sendFile(matchingFile);
  }
}

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA SOLO PRUEBA SI LA CONEXION A SQL SERVER ESTA DISPONIBLE.
app.get('/api/health', async (_req, res) => {
  try {
    await getPool();
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'No se pudo conectar a SQL Server' });
  }
});

app.get('/api/system-health', async (_req, res) => {
  try {
    const health = await getSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudo cargar la salud del sistema' });
  }
});

app.get('/api/product-images/:fileName', (req, res) => {
  const matchingFile = findImageAssetFile(req.params.fileName);

  if (!matchingFile) {
    return res.status(404).json({ message: 'Imagen de producto no encontrada' });
  }

  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  return res.sendFile(path.join(imageAssetsPath, matchingFile));
});

app.get('/api/product-images-local/:encodedPath', (req, res) => {
  const matchingFile = resolveLocalProductImageFile(decodeProductImagePath(req.params.encodedPath));

  if (!matchingFile) {
    return res.status(404).json({ message: 'Imagen de producto no encontrada' });
  }

  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  return res.sendFile(matchingFile);
});

app.get('/api/product-image-thumbnails/:source/:fileRef', (req, res) => {
  return sendProductThumbnail(req, res, req.params.source, req.params.fileRef);
});

app.use('/api', createFacturacionRouter({
  getBillingProducts,
  registerSale,
  resolveProductImageUrl,
  resetPool,
}));
app.use('/api', createDatabaseBackupRouter({
  audit: createAuditHistoryRecord,
}));
scheduleAutomaticBackups({ audit: createAuditHistoryRecord });

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO loginUser DE server/data-access.js
// PARA AUTENTICAR UN USUARIO EN LA BASE DE DATOS.
app.post('/api/auth/login', async (req, res) => {
  const { usuario, pass } = req.body || {};

  if (!usuario || !pass) {
    return res.status(400).json({ message: 'Usuario y contrasena son requeridos' });
  }

  try {
    const user = await loginUser(usuario, pass);

    if (!user) {
      return res.status(401).json({ message: 'Credenciales invalidas o usuario inactivo' });
    }

    return res.json({
      user,
    });
  } catch (error) {
    try {
      await resetPool();
      const user = await loginUser(usuario, pass);

      if (!user) {
        return res.status(401).json({ message: 'Credenciales invalidas o usuario inactivo' });
      }

      return res.json({ user });
    } catch (retryError) {
      console.error('Error al iniciar sesion:', retryError.message || retryError);
    }

    return res.status(500).json({ message: 'Error al iniciar sesion' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO listActiveUsers DE server/data-access.js
// PARA OBTENER LOS USUARIOS ACTIVOS REGISTRADOS EN LA BASE DE DATOS.
app.get('/api/auth/users', async (_req, res) => {
  try {
    const users = await listActiveUsers();
    return res.json({ users });
  } catch (error) {
    try {
      await resetPool();
      const users = await listActiveUsers();
      return res.json({ users });
    } catch (retryError) {
      console.error('Error al obtener usuarios:', retryError.message || retryError);
    }

    return res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO listAttendanceUsers DE server/data-access.js
// PARA CARGAR ASISTENCIA Y PLANILLA CON USUARIOS REALES Y HORAS TRABAJADAS REALES.
app.get('/api/attendance/users', async (_req, res) => {
  try {
    const users = await listAttendanceUsers();
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener asistencia del personal' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA saveAttendanceMark DE server/data-access.js
// PARA CREAR O ACTUALIZAR LA MARCA DIARIA DE ASISTENCIA POR USUARIO Y FECHA.
app.post('/api/attendance/mark', async (req, res) => {
  try {
    const mark = await saveAttendanceMark(req.body || {});
    return res.json({ mark });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al guardar la marca de asistencia' });
  }
});

app.post('/api/payroll/week', async (req, res) => {
  try {
    const result = await savePayrollWeek(req.body || {});
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al guardar planilla' });
  }
});

app.get('/api/payroll/records', async (_req, res) => {
  try {
    const records = await listPayrollRecords();
    return res.json({ records });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al cargar planilla' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO listCustomers DE server/data-access.js
// PARA OBTENER LOS CLIENTES Y LLENAR EL MODAL DE FACTURACION.
app.get('/api/customers', async (_req, res) => {
  try {
    const customers = await listCustomers();
    return res.json({ customers });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener clientes' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO listSuppliers DE server/data-access.js
// PARA OBTENER LOS PROVEEDORES Y LLENAR EL MODAL DE COMPRAS.
app.get('/api/suppliers', async (_req, res) => {
  try {
    const suppliers = await listSuppliers();
    return res.json({ suppliers });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener proveedores' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA listExpiringProducts() UBICADO EN server/data-access.js.
// CONSULTA dbo.PRODUCTO_PROXIMO_VENCER PARA EL MODAL DE ALERTAS EN FACTURACION.
app.get('/api/products/expiring', async (_req, res) => {
  try {
    const alerts = await listExpiringProducts();
    return res.json({ alerts });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener alertas de vencimiento' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA listPurchases() UBICADO EN server/data-access.js.
// CONSULTA dbo.COMPRA_EFECTIVO Y dbo.COMPRA_CREDITO PARA LA HOJA COMPRAS.
app.get('/api/purchases', async (_req, res) => {
  try {
    const purchases = await listPurchases();
    return res.json({ purchases });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener compras' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO listCredits DE server/data-access.js.
// listCredits CONSULTA dbo.VENTA_CREDITO Y HACE JOIN CON dbo.cliente Y dbo.producto
// PARA ALIMENTAR LA PAGINA DE CREDITOS EN src/app/app.html.
app.get('/api/credits', async (_req, res) => {
  try {
    const credits = await listCredits();
    return res.json({ credits });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener creditos' });
  }
});

app.post('/api/credits/payments', async (req, res) => {
  try {
    const payment = await registerCreditPayment(req.body || {});
    return res.status(201).json({ payment });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al registrar abono de credito' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA getNextInvoiceNumber() UBICADO EN server/data-access.js.
// getNextInvoiceNumber CONSULTA dbo.FACTURA Y DEVUELVE MAX(ID_FACT) + 1
// PARA MOSTRAR EL SIGUIENTE NUMERO DE FACTURA EN EL FORMULARIO DE VENTA.
app.get('/api/invoices/next', async (_req, res) => {
  try {
    const nextInvoiceNumber = await getNextInvoiceNumber();
    return res.json({ nextInvoiceNumber });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener numero de factura' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA listInvoices() UBICADO EN server/data-access.js.
// CONSULTA dbo.FACTURA Y LAS TABLAS DE VENTA PARA MOSTRAR LA PAGINA FACTURAS.
app.get('/api/invoices', async (_req, res) => {
  try {
    const invoices = await listInvoices();
    return res.json({ invoices });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener facturas' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA listTodayInvoices() UBICADO EN server/data-access.js.
// CONSULTA dbo.FACTURA Y FILTRA SOLO POR LA FECHA ACTUAL PARA EL MODAL VENTAS DEL DIA.
app.get('/api/invoices/today', async (_req, res) => {
  try {
    const invoices = await listTodayInvoices();
    return res.json({ invoices });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener ventas del dia' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA listDailyCuts() UBICADO EN server/data-access.js.
// CONSULTA dbo.CORTE_DIARIO PARA EL MODAL DE CORTE EN FACTURACION.
app.get('/api/daily-cuts', async (req, res) => {
  try {
    const cuts = await listDailyCuts(req.query.dateFrom, req.query.dateTo, req.query.userId);
    return res.json({ cuts });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener cortes diarios' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA previewDailyCut() UBICADO EN server/data-access.js.
// CALCULA EL CORTE SIN INSERTAR EN dbo.CORTE_DIARIO.
app.get('/api/daily-cuts/preview', async (req, res) => {
  try {
    const cut = await previewDailyCut(req.query.date, req.query.userId);
    return res.json({ cut });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al calcular corte diario' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA createDailyCut() UBICADO EN server/data-access.js.
// CALCULA Y GUARDA EL CORTE EN dbo.CORTE_DIARIO.
app.post('/api/daily-cuts', async (req, res) => {
  try {
    const cut = await createDailyCut(req.body?.date, req.body?.physicalCashCount, req.body?.userId);
    return res.json({ cut });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al generar corte diario' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA createOpeningCut() UBICADO EN server/data-access.js.
// GUARDA EL DINERO INICIAL DE CAJA EN dbo.CORTE_DIARIO CON ESTADO_CORTE = 1.
app.post('/api/daily-cuts/opening', async (req, res) => {
  try {
    const cut = await createOpeningCut(req.body?.date, req.body?.initialCash, req.body?.userId);
    return res.json({ cut });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al guardar inicio de caja' });
  }
});

app.put('/api/daily-cuts/:id/cash-management', async (req, res) => {
  try {
    const cut = await updateDailyCutCashManagement(req.params.id, req.body || {});
    return res.json({ cut });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al actualizar caja chica del corte' });
  }
});

app.delete('/api/daily-cuts/:id/cash-management', async (req, res) => {
  try {
    const result = await deleteDailyCutCashManagement(req.params.id, req.query.userId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al eliminar corte de caja chica' });
  }
});

app.get('/api/petty-cash', async (_req, res) => {
  try {
    const records = await listPettyCashRecords();
    return res.json({ records });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener caja chica' });
  }
});

app.post('/api/petty-cash', async (req, res) => {
  try {
    const record = await createPettyCashRecord(req.body || {});
    return res.json({ record });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al guardar caja chica' });
  }
});

app.put('/api/petty-cash/:id', async (req, res) => {
  try {
    const record = await updatePettyCashRecord(req.params.id, req.body || {});
    return res.json({ record });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al actualizar caja chica' });
  }
});

app.delete('/api/petty-cash/:id', async (req, res) => {
  try {
    const result = await deletePettyCashRecord(req.params.id, req.query.userId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al eliminar caja chica' });
  }
});

app.get('/api/financial-movements', async (req, res) => {
  try {
    const result = await listFinancialMovements({
      year: req.query.year,
      month: req.query.month,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener movimientos financieros' });
  }
});

app.post('/api/financial-movements', async (req, res) => {
  try {
    const movement = await createFinancialMovement(req.body || {});
    return res.json({ movement });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al guardar movimiento financiero' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA listCreditPaymentsByDate() UBICADO EN server/data-access.js.
// CONSULTA dbo.PAGOS_CREDITO FILTRANDO POR FECHA PARA EL MODAL DE CORTE.
app.get('/api/credit-payments', async (req, res) => {
  try {
    const payments = await listCreditPaymentsByDate(req.query.date, req.query.userId);
    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener pagos de credito' });
  }
});

app.get('/api/credit-payments/history', async (req, res) => {
  try {
    const payments = await listCreditPaymentsHistory(req.query.limit);
    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener historico general de abonos' });
  }
});

app.get('/api/credit-payments/customer/:customerId', async (req, res) => {
  try {
    const payments = await listCreditPaymentsByCustomer(req.params.customerId);
    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener historico de abonos' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA getInvoicesSummary() UBICADO EN server/data-access.js.
// DEVUELVE LOS DATOS DE LAS TARJETAS DE LA PAGINA FACTURAS.
app.get('/api/invoices/summary', async (_req, res) => {
  try {
    const summary = await getInvoicesSummary();
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener resumen de facturas' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA getInvoiceDetails() UBICADO EN server/data-access.js.
// CONSULTA EL DETALLE DE PRODUCTOS DE UNA FACTURA PARA EXPORTAR PDF.
app.get('/api/invoices/:invoiceId/details', async (req, res) => {
  try {
    const lines = await getInvoiceDetails(req.params.invoiceId);
    return res.json({ lines });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener detalle de factura' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA annulInvoice() UBICADO EN server/data-access.js.
// ANULA LA FACTURA Y RESTABLECE EL STOCK DE SUS PRODUCTOS EN dbo.inventario.
app.post('/api/invoices/:invoiceId/annul', async (req, res) => {
  try {
    const result = await annulInvoice(req.params.invoiceId, req.body?.userId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al anular factura' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA activateInvoice() UBICADO EN server/data-access.js.
// ACTIVA UNA FACTURA ANULADA Y DESCUENTA NUEVAMENTE EL STOCK EN dbo.inventario.
app.post('/api/invoices/:invoiceId/activate', async (req, res) => {
  try {
    const result = await activateInvoice(req.params.invoiceId, req.body?.userId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al activar factura' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA getDashboardSalesSummary() UBICADO EN server/data-access.js.
// CONSULTA VENTA_EFECTIVO, VENTA_TRANSFERENCIA Y VENTA_CREDITO PARA LAS TARJETAS DEL DASHBOARD.
app.get('/api/dashboard/sales-summary', async (_req, res) => {
  try {
    const summary = await getDashboardSalesSummary();
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener resumen de ventas' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA CARGA EL MODULO DE VENTAS Y RENTABILIDAD CON KPIS, GRAFICOS, KARDEX Y ALERTAS.
app.get('/api/analytics/sales-profitability', async (_req, res) => {
  try {
    const analytics = await getSalesProfitabilityAnalytics({ year: _req.query.year, month: _req.query.month });
    return res.json(analytics);
  } catch (error) {
    console.error('Error al consultar ventas y rentabilidad:', error);
    return res.status(500).json({ message: 'Error al obtener ventas y rentabilidad' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA getDashboardSalesTrend() UBICADO EN server/data-access.js.
// CONSULTA LAS TRES TABLAS DE VENTAS Y AGRUPA POR DIA, SEMANA O MES PARA EL GRAFICO DEL DASHBOARD.
app.get('/api/dashboard/sales-trend', async (req, res) => {
  try {
    const trend = await getDashboardSalesTrend(req.query.period);
    return res.json({ trend });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener tendencia de ventas' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA getSalesDropAlert() UBICADO EN server/data-access.js.
// COMPARA LAS VENTAS DE HOY CONTRA AYER A LA MISMA HORA PARA ALERTA OPERATIVA.
app.get('/api/dashboard/sales-drop-alert', async (_req, res) => {
  try {
    const alert = await getSalesDropAlert();
    return res.json({ alert });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener alerta de caida de ventas' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA getSalesTotalByPeriod() UBICADO EN server/data-access.js.
// CONSULTA EL TOTAL DE VENTAS DE UN MES Y ANO ESPECIFICO PARA LA HOJA COSTOS.
app.get('/api/costs/sales-period-total', async (req, res) => {
  try {
    const summary = await getSalesTotalByPeriod(req.query.year, req.query.month);
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener ventas del periodo' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA getSalesByCategoryForPeriod() UBICADO EN server/data-access.js.
// CONSULTA LAS VENTAS DEL MES Y ANO SELECCIONADOS AGRUPADAS POR CATEGORIA DE PRODUCTO.
app.get('/api/costs/sales-by-category', async (req, res) => {
  try {
    const summary = await getSalesByCategoryForPeriod(req.query.year, req.query.month);
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener ventas por categoria' });
  }
});

app.get('/api/costs/cost-increase-alerts', async (_req, res) => {
  try {
    const response = await listMonthlyCostIncreaseAlerts();
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener alertas de aumento de costo' });
  }
});

app.get('/api/costs/operational', async (req, res) => {
  try {
    const response = await listOperationalCosts({ year: req.query.year, month: req.query.month });
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener costos operativos' });
  }
});

app.post('/api/costs/operational', async (req, res) => {
  try {
    const cost = await createOperationalCost(req.body || {});
    return res.status(201).json(cost);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al registrar costo operativo' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA listAuditHistory() UBICADO EN server/data-access.js.
// CONSULTA dbo.auditoria PARA MOSTRAR MOVIMIENTOS DE SISTEMA Y BD EN EL MODULO HISTORICO.
app.get('/api/history/audit', async (req, res) => {
  try {
    const history = await listAuditHistory(req.query.limit);
    return res.json({ history });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener historico de auditoria' });
  }
});

app.post('/api/history/audit', async (req, res) => {
  try {
    const result = await createAuditHistoryRecord(req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al registrar historico de auditoria' });
  }
});

app.get('/api/quotes', async (req, res) => {
  try {
    const quotes = await listQuotes(req.query.status);
    return res.json({ quotes });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener cotizaciones' });
  }
});

app.get('/api/quotes/:quoteId', async (req, res) => {
  try {
    const quote = await getQuoteDetails(req.params.quoteId);
    return res.json(quote);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener cotizacion' });
  }
});

app.post('/api/quotes', async (req, res) => {
  try {
    const quote = await createQuote(req.body || {});
    return res.status(201).json(quote);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al crear cotizacion' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA registerPurchase() UBICADO EN server/data-access.js.
// GUARDA EL HISTORICO EN dbo.COMPRA_EFECTIVO O dbo.COMPRA_CREDITO.
app.post('/api/purchases', async (req, res) => {
  try {
    const purchase = await registerPurchase(req.body || {});
    return res.status(201).json(purchase);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al registrar compra' });
  }
});

app.post('/api/inventory/quick-purchase', async (req, res) => {
  try {
    const purchase = await registerQuickInventoryPurchase(req.body || {});
    return res.status(201).json(purchase);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al registrar ingreso rapido de inventario' });
  }
});

app.post('/api/inventory/quick-reduction', async (req, res) => {
  try {
    const reduction = await registerQuickInventoryReduction(req.body || {});
    return res.status(201).json(reduction);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al rebajar inventario' });
  }
});

app.post('/api/purchases/annul', async (req, res) => {
  try {
    const result = await annulPurchase(req.body || {});
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al anular compra' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO getProducts DE server/data-access.js
// PARA CARGAR LOS PRODUCTOS Y LOS DATOS DE INVENTARIO DESDE SQL SERVER.
app.get('/api/products', async (_req, res) => {
  try {
    const products = await getProducts({ resolveProductImageUrl });

    return res.json({ products });
  } catch (error) {
    try {
      await resetPool();
      const products = await getProducts({ resolveProductImageUrl });

      return res.json({ products });
    } catch (retryError) {
      console.error('Error al obtener productos de inventario:', retryError.message || retryError);
      return res.status(500).json({ message: retryError.message || 'Error al obtener productos de inventario' });
    }
  }
});

app.get('/api/assembled-offers', async (_req, res) => {
  try {
    const offers = await listAssembledOfferCodes({ includeInactive: true, resolveProductImageUrl });
    return res.json({ offers });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener codigos armados' });
  }
});

app.post('/api/assembled-offers', async (req, res) => {
  try {
    const offer = await createAssembledOfferCode(req.body || {});
    return res.status(201).json({ offer });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error al crear codigo armado' });
  }
});

app.put('/api/assembled-offers/:offerId', async (req, res) => {
  try {
    const offer = await updateAssembledOfferCode({
      ...(req.body || {}),
      offerId: Number(req.params.offerId),
    });
    return res.json({ offer });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error al editar codigo armado' });
  }
});

app.get('/api/products/inactive', async (req, res) => {
  try {
    const products = await getInactiveProducts({
      search: req.query.search,
      resolveProductImageUrl,
    });

    return res.json(toInactiveProductsResponse(products));
  } catch (error) {
    try {
      await resetPool();
      const products = await getInactiveProducts({
        search: req.query.search,
        resolveProductImageUrl,
      });

      return res.json(toInactiveProductsResponse(products));
    } catch (retryError) {
      console.error('Error al obtener productos inactivos:', retryError.message || retryError);
      return res.status(500).json({ message: retryError.message || 'Error al obtener productos inactivos' });
    }
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const result = await createInventoryProduct(req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al crear producto' });
  }
});

app.put('/api/products/:productId/reactivate', async (req, res) => {
  try {
    const payload = parseReactivarProductoRequest(req.body || {});
    const result = await reactivateInventoryProduct({
      productId: req.params.productId,
      ...payload,
      resolveProductImageUrl,
    });

    return res.json(toReactivatedProductResponse(result));
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al reactivar producto' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA CARGA EL DETALLE PROFESIONAL DE INVENTARIO DE UN PRODUCTO.
// INCLUYE LOTES FEFO Y MOVIMIENTOS RECIENTES PARA EL MODAL DE INVENTARIO.
app.get('/api/products/:productId/inventory-detail', async (req, res) => {
  try {
    const detail = await getProductInventoryDetail(req.params.productId, { resolveProductImageUrl });
    return res.json(detail);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al obtener detalle del producto' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA updateInventoryStockLevels() UBICADO EN server/data-access.js.
// ACTUALIZA stock, stock_minimo Y stock_maximo EN dbo.inventario DESDE EL MODAL DE INVENTARIO.
app.put('/api/products/:productId/inventory', async (req, res) => {
  const {
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
  } = req.body || {};

  try {
    const result = await updateInventoryStockLevels({
      productId: req.params.productId,
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
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al actualizar inventario' });
  }
});

app.put('/api/products/:productId/status', async (req, res) => {
  const { active, userId, user } = req.body || {};

  try {
    const result = await updateProductActiveStatus({
      productId: req.params.productId,
      active,
      userId,
      user,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al actualizar estado del producto' });
  }
});

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
