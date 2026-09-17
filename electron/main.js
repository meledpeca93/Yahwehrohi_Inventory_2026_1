const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath, pathToFileURL } = require('url');
const Tesseract = require('tesseract.js');
require('dotenv').config({ override: true });

const { getPool } = require('../server/db');
const {
  activateInvoice,
  annulInvoice,
  annulPurchase,
  createAssembledOfferCode,
  createDailyCut,
  createFinancialMovement,
  createInventoryProduct,
  createProductBarcode,
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
  getBillingProductAvailability,
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
  listProductBarcodes,
  listQuotes,
  listTodayInvoices,
  listSuppliers,
  loginUser,
  previewDailyCut,
  registerCreditPayment,
  registerPurchase,
  registerQuickInventoryPurchase,
  registerQuickInventoryReduction,
  registerSale,
  reactivateInventoryProduct,
  saveAttendanceMark,
  savePayrollWeek,
  updateDailyCutCashManagement,
  updatePettyCashRecord,
  setPrimaryProductBarcode,
  updateProductActiveStatus,
  updateProductBarcodeStatus,
  updateInventoryStockLevels,
} = require('../server/data-access');
const {
  toInactiveProductsResponse,
  toReactivatedProductResponse,
} = require('../server/modules/inventario/inventario.dto');
const {
  createBackup,
  listBackups,
  runAutomaticBackup,
  saveBackupConfig,
  scheduleAutomaticBackups,
  restoreBackup,
  validateBackupForRestore,
} = require('../server/modules/database-backup/backup.service');

const imageAssetsPrefix = 'assets/img/';
const imageAssetsPath = path.join(__dirname, '..', 'src', 'img');
const legacyProductImagesPath = path.join(
  process.env.USERPROFILE || 'C:\\Users\\InversionesYR',
  'Documents',
  'Vanguard Software Group',
  'Sistema punto de venta VSG - Imagenes Productos',
);
const isDev = !app.isPackaged && process.env.ELECTRON_DEV === 'true';
let imageAssetFileNamesCache = null;
let imageAssetDirectoryMtimeMs = 0;
let imageAssetsWatcherStarted = false;

function invalidateImageAssetFileNamesCache() {
  imageAssetFileNamesCache = null;
  imageAssetDirectoryMtimeMs = 0;
}

function watchImageAssetsDirectory() {
  if (imageAssetsWatcherStarted || !fs.existsSync(imageAssetsPath)) {
    return;
  }

  imageAssetsWatcherStarted = true;

  try {
    fs.watch(imageAssetsPath, { recursive: true }, invalidateImageAssetFileNamesCache);
  } catch {
    // Directory mtime below still refreshes the cache when fs.watch is unavailable.
  }
}

function getImageAssetFileNames() {
  if (!fs.existsSync(imageAssetsPath)) {
    invalidateImageAssetFileNamesCache();
    return [];
  }

  watchImageAssetsDirectory();

  const directoryMtimeMs = fs.statSync(imageAssetsPath).mtimeMs;

  if (imageAssetFileNamesCache && imageAssetDirectoryMtimeMs === directoryMtimeMs) {
    return imageAssetFileNamesCache;
  }

  imageAssetFileNamesCache = fs.readdirSync(imageAssetsPath, { recursive: true })
    .filter((assetFileName) => fs.statSync(path.join(imageAssetsPath, assetFileName)).isFile())
    .map((assetFileName) => String(assetFileName).replace(/\\/g, '/'));
  imageAssetDirectoryMtimeMs = directoryMtimeMs;

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

function resolveProductImagePath(imageUrl) {
  const localImageFile = resolveLocalProductImageFile(imageUrl);

  if (localImageFile) {
    return pathToFileURL(localImageFile).toString();
  }

  if (!imageUrl || !imageUrl.toLowerCase().startsWith(imageAssetsPrefix)) {
    return imageUrl;
  }

  const fileName = imageUrl.slice(imageAssetsPrefix.length);
  const matchingFile = findImageAssetFile(fileName);

  return matchingFile ? pathToFileURL(path.join(imageAssetsPath, matchingFile)).toString() : imageUrl;
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const windowWidth = Math.max(Math.min(1440, workArea.width), 1200);
  const windowHeight = Math.max(Math.min(920, workArea.height), 760);

  const mainWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: windowWidth,
    height: windowHeight,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:4200');
    if (process.env.ELECTRON_OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'YahwehRohi-Inventory', 'browser', 'index.html'));
}

ipcMain.handle('db:health', async () => {
  try {
    await getPool();
    return { ok: true, database: 'connected' };
  } catch (error) {
    return { ok: false, message: error.message || 'No se pudo conectar a SQL Server' };
  }
});

ipcMain.handle('system-health:get', async () => {
  return getSystemHealth();
});

ipcMain.handle('database-backups:list', async () => {
  return listBackups();
});

ipcMain.handle('database-backups:save-config', async (_event, payload) => {
  const role = String(payload?.user?.rol || payload?.user?.role || '').toLowerCase();

  if (!role.includes('admin') && !role.includes('administrador')) {
    throw new Error('Solo usuarios administrativos pueden configurar respaldos.');
  }

  const config = saveBackupConfig(payload?.config || {});
  await createAuditHistoryRecord({
    tableName: 'RESPALDO_BASE_DATOS',
    action: 'CONFIGURAR_RESPALDOS',
    recordKey: config.backupDir,
    userId: payload?.user?.id || null,
    user: payload?.user?.nombre || payload?.user?.usuario || 'Sistema',
    newData: JSON.stringify(config),
  });

  return { config };
});

ipcMain.handle('database-backups:manual', async (_event, payload) => {
  const backup = await createBackup({
    user: payload?.user || null,
    audit: createAuditHistoryRecord,
  });
  return { backup, message: 'Respaldo generado correctamente.' };
});

ipcMain.handle('database-backups:run-automatic', async () => {
  const backup = await runAutomaticBackup({ audit: createAuditHistoryRecord });
  return { backup, skipped: !backup };
});

ipcMain.handle('database-backups:validate', async (_event, fileName) => {
  return validateBackupForRestore(fileName);
});

ipcMain.handle('database-backups:restore', async (_event, payload) => {
  if (payload?.confirmation !== 'CONFIRMO RESTAURAR') {
    throw new Error('La segunda confirmacion no coincide.');
  }

  const restore = await restoreBackup({
    fileName: payload?.fileName,
    user: payload?.user || null,
    audit: createAuditHistoryRecord,
  });
  return { restore, message: 'Base de datos restaurada correctamente.' };
});

ipcMain.handle('auth:login', async (_event, credentials) => {
  const usuario = credentials?.usuario?.trim();
  const pass = credentials?.pass;

  if (!usuario || !pass) {
    throw new Error('Usuario y contrasena son requeridos');
  }

  const user = await loginUser(usuario, pass);

  if (!user) {
    throw new Error('Credenciales invalidas o usuario inactivo');
  }

  return { user };
});

ipcMain.handle('auth:users', async () => {
  const users = await listActiveUsers();
  return { users };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listAttendanceUsers() UBICADO EN server/data-access.js.
// CONSULTA dbo.usuario, dbo.ASISTENCIA Y dbo.VW_ASISTENCIA_HORAS PARA ASISTENCIA Y PLANILLA.
ipcMain.handle('attendance:list', async () => {
  const users = await listAttendanceUsers();
  return { users };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA saveAttendanceMark() UBICADO EN server/data-access.js.
// CREA O ACTUALIZA LA MARCA DIARIA DE ASISTENCIA POR USUARIO Y FECHA.
ipcMain.handle('attendance:save-mark', async (_event, payload) => {
  const mark = await saveAttendanceMark(payload || {});
  return { mark };
});

ipcMain.handle('payroll:save-week', async (_event, payload) => {
  return savePayrollWeek(payload || {});
});

ipcMain.handle('payroll:records', async () => {
  const records = await listPayrollRecords();
  return { records };
});

ipcMain.handle('customers:list', async () => {
  const customers = await listCustomers();
  return { customers };
});

ipcMain.handle('suppliers:list', async () => {
  const suppliers = await listSuppliers();
  return { suppliers };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listExpiringProducts() UBICADO EN server/data-access.js.
// CONSULTA dbo.PRODUCTO_PROXIMO_VENCER PARA EL MODAL DE ALERTAS EN FACTURACION.
ipcMain.handle('products:expiring', async () => {
  const alerts = await listExpiringProducts();
  return { alerts };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listPurchases() UBICADO EN server/data-access.js.
// CONSULTA dbo.COMPRA_EFECTIVO Y dbo.COMPRA_CREDITO PARA LA HOJA COMPRAS.
ipcMain.handle('purchases:list', async () => {
  const purchases = await listPurchases();
  return { purchases };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listCredits() UBICADO EN server/data-access.js.
// listCredits CONSULTA dbo.VENTA_CREDITO PARA ALIMENTAR LA PAGINA DE CREDITOS.
ipcMain.handle('credits:list', async () => {
  const credits = await listCredits();
  return { credits };
});

ipcMain.handle('credits:payment-create', async (_event, payload) => {
  return { payment: await registerCreditPayment(payload || {}) };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getNextInvoiceNumber() UBICADO EN server/data-access.js.
// getNextInvoiceNumber CONSULTA dbo.FACTURA PARA MOSTRAR MAX(ID_FACT) + 1 EN FACTURACION.
ipcMain.handle('invoices:next', async () => {
  const nextInvoiceNumber = await getNextInvoiceNumber();
  return { nextInvoiceNumber };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listInvoices() UBICADO EN server/data-access.js.
// CONSULTA FACTURAS PARA LA PAGINA FACTURAS.
ipcMain.handle('invoices:list', async () => {
  const invoices = await listInvoices();
  return { invoices };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listTodayInvoices() UBICADO EN server/data-access.js.
// CONSULTA dbo.FACTURA FILTRADA POR FECHA ACTUAL PARA EL MODAL VENTAS DEL DIA.
ipcMain.handle('invoices:today', async () => {
  const invoices = await listTodayInvoices();
  return { invoices };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listDailyCuts() UBICADO EN server/data-access.js.
// CONSULTA dbo.CORTE_DIARIO PARA EL MODAL DE CORTE.
ipcMain.handle('daily-cuts:list', async (_event, payload) => {
  const cuts = await listDailyCuts(payload?.dateFrom, payload?.dateTo, payload?.userId);
  return { cuts };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA previewDailyCut() UBICADO EN server/data-access.js.
// CALCULA EL CORTE SIN INSERTAR EN dbo.CORTE_DIARIO.
ipcMain.handle('daily-cuts:preview', async (_event, payload) => {
  const cut = await previewDailyCut(payload?.date, payload?.userId);
  return { cut };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA createDailyCut() UBICADO EN server/data-access.js.
// GENERA UN CORTE EN dbo.CORTE_DIARIO.
ipcMain.handle('daily-cuts:create', async (_event, payload) => {
  const cut = await createDailyCut(payload?.date, payload?.physicalCashCount, payload?.userId);
  return { cut };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA createOpeningCut() UBICADO EN server/data-access.js.
// GUARDA EL INICIO DE CAJA EN dbo.CORTE_DIARIO.
ipcMain.handle('daily-cuts:opening', async (_event, payload) => {
  const cut = await createOpeningCut(payload?.date, payload?.initialCash, payload?.userId);
  return { cut };
});

ipcMain.handle('daily-cuts:update-cash-management', async (_event, payload) => {
  const cut = await updateDailyCutCashManagement(payload?.id, payload || {});
  return { cut };
});

ipcMain.handle('daily-cuts:delete-cash-management', async (_event, payload) => {
  return deleteDailyCutCashManagement(payload?.id, payload?.userId);
});

ipcMain.handle('petty-cash:list', async () => {
  const records = await listPettyCashRecords();
  return { records };
});

ipcMain.handle('petty-cash:create', async (_event, payload) => {
  const record = await createPettyCashRecord(payload || {});
  return { record };
});

ipcMain.handle('petty-cash:update', async (_event, payload) => {
  const record = await updatePettyCashRecord(payload?.id, payload || {});
  return { record };
});

ipcMain.handle('petty-cash:delete', async (_event, payload) => {
  return deletePettyCashRecord(payload?.id, payload?.userId);
});

ipcMain.handle('financial-movements:list', async (_event, payload) => {
  return listFinancialMovements(payload || {});
});

ipcMain.handle('financial-movements:create', async (_event, payload) => {
  return { movement: await createFinancialMovement(payload || {}) };
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('app:update-system', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window || window.isDestroyed()) {
    throw new Error('No se encontro una ventana activa para actualizar.');
  }

  await getPool();

  return {
    ok: true,
    mode: isDev ? 'development' : 'production',
    message: isDev
      ? 'Sistema actualizado. Los cambios de interfaz se aplican con live reload; los cambios de backend reinician Electron automaticamente.'
      : 'Sistema actualizado.',
  };
});

ipcMain.handle('reports:export-html-pdf', async (event, payload) => {
  const html = String(payload?.html || '').trim();
  const defaultFileName = String(payload?.defaultFileName || 'reporte.pdf').replace(/[<>:"/\\|?*]+/g, '-');
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);

  if (!html) {
    throw new Error('No hay contenido para exportar.');
  }

  const saveResult = await dialog.showSaveDialog(sourceWindow || undefined, {
    title: 'Guardar PDF',
    defaultPath: defaultFileName.toLowerCase().endsWith('.pdf') ? defaultFileName : `${defaultFileName}.pdf`,
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true };
  }

  const pdfWindow = new BrowserWindow({
    width: 1123,
    height: 794,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, {
      baseURLForDataURL: pathToFileURL(`${path.join(__dirname, '..')}${path.sep}`).toString(),
    });

    await pdfWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const images = Array.from(document.images || []);
        if (images.length === 0) {
          resolve();
          return;
        }

        let pending = images.length;
        const finish = () => {
          pending -= 1;
          if (pending <= 0) {
            resolve();
          }
        };

        images.forEach((image) => {
          if (image.complete) {
            finish();
            return;
          }

          image.addEventListener('load', finish, { once: true });
          image.addEventListener('error', finish, { once: true });
        });

        setTimeout(resolve, 6000);
      });
    `);

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      landscape: true,
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'custom',
        top: 0.31,
        bottom: 0.31,
        left: 0.31,
        right: 0.31,
      },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Electron genero un PDF vacio. Intenta guardar en otra carpeta o revisa permisos del archivo.');
    }

    fs.writeFileSync(saveResult.filePath, pdfBuffer);

    const stats = fs.statSync(saveResult.filePath);
    if (!stats.size) {
      throw new Error('El archivo PDF se guardo con 0 KB. Revisa permisos o selecciona otra ruta.');
    }

    return {
      canceled: false,
      filePath: saveResult.filePath,
      size: stats.size,
    };
  } finally {
    if (!pdfWindow.isDestroyed()) {
      pdfWindow.close();
    }
  }
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listCreditPaymentsByDate() UBICADO EN server/data-access.js.
// CONSULTA dbo.PAGOS_CREDITO FILTRANDO POR FECHA.
ipcMain.handle('credit-payments:list', async (_event, payload) => {
  const payments = await listCreditPaymentsByDate(payload?.date, payload?.userId);
  return { payments };
});

ipcMain.handle('credit-payments:history', async (_event, limit) => {
  const payments = await listCreditPaymentsHistory(limit);
  return { payments };
});

ipcMain.handle('credit-payments:customer-history', async (_event, customerId) => {
  const payments = await listCreditPaymentsByCustomer(customerId);
  return { payments };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getInvoicesSummary() UBICADO EN server/data-access.js.
// DEVUELVE LAS TARJETAS DE LA PAGINA FACTURAS.
ipcMain.handle('invoices:summary', async () => {
  return getInvoicesSummary();
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getInvoiceDetails() UBICADO EN server/data-access.js.
// CONSULTA DETALLE PARA EXPORTAR PDF DE FACTURA.
ipcMain.handle('invoices:details', async (_event, invoiceId) => {
  const lines = await getInvoiceDetails(invoiceId);
  return { lines };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA annulInvoice() UBICADO EN server/data-access.js.
// ANULA FACTURA Y DEVUELVE STOCK AL INVENTARIO.
ipcMain.handle('invoices:annul', async (_event, payload) => {
  return annulInvoice(payload?.invoiceId ?? payload, payload?.userId);
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA activateInvoice() UBICADO EN server/data-access.js.
// ACTIVA FACTURA ANULADA Y DESCUENTA STOCK DEL INVENTARIO.
ipcMain.handle('invoices:activate', async (_event, payload) => {
  return activateInvoice(payload?.invoiceId ?? payload, payload?.userId);
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getDashboardSalesSummary() UBICADO EN server/data-access.js.
// CONSULTA VENTA_EFECTIVO, VENTA_TRANSFERENCIA Y VENTA_CREDITO PARA LAS TARJETAS DEL DASHBOARD.
ipcMain.handle('dashboard:sales-summary', async () => {
  return getDashboardSalesSummary();
});

ipcMain.handle('analytics:sales-profitability', async (_event, payload) => {
  return getSalesProfitabilityAnalytics(payload || {});
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getDashboardSalesTrend() UBICADO EN server/data-access.js.
// CONSULTA LAS TRES TABLAS DE VENTAS PARA EL GRAFICO DEL DASHBOARD.
ipcMain.handle('dashboard:sales-trend', async (_event, period) => {
  const trend = await getDashboardSalesTrend(period);
  return { trend };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getSalesDropAlert() UBICADO EN server/data-access.js.
// COMPARA LAS VENTAS DE HOY VS AYER A LA MISMA HORA PARA LA ALERTA OPERATIVA.
ipcMain.handle('dashboard:sales-drop-alert', async () => {
  return { alert: await getSalesDropAlert() };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getSalesTotalByPeriod() UBICADO EN server/data-access.js.
// CONSULTA EL TOTAL DE VENTAS DE UN PERIODO ESPECIFICO PARA LA HOJA COSTOS.
ipcMain.handle('costs:sales-period-total', async (_event, payload) => {
  return getSalesTotalByPeriod(payload?.year, payload?.month);
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getSalesByCategoryForPeriod() UBICADO EN server/data-access.js.
// CONSULTA LAS VENTAS DEL PERIODO AGRUPADAS POR CATEGORIA PARA LA HOJA COSTOS.
ipcMain.handle('costs:sales-by-category', async (_event, payload) => {
  return getSalesByCategoryForPeriod(payload?.year, payload?.month);
});

ipcMain.handle('costs:cost-increase-alerts', async () => {
  return listMonthlyCostIncreaseAlerts();
});

ipcMain.handle('costs:operational-list', async (_event, payload) => {
  return listOperationalCosts(payload || {});
});

ipcMain.handle('costs:operational-create', async (_event, payload) => {
  return createOperationalCost(payload || {});
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listAuditHistory() UBICADO EN server/data-access.js.
// CONSULTA dbo.auditoria PARA MOSTRAR EL HISTORICO REAL DE MOVIMIENTOS.
ipcMain.handle('history:audit', async (_event, limit) => {
  return { history: await listAuditHistory(limit) };
});

ipcMain.handle('history:audit-create', async (_event, payload) => {
  return createAuditHistoryRecord(payload || {});
});

ipcMain.handle('products:list', async () => {
  const products = await getProducts({ resolveProductImageUrl: resolveProductImagePath });
  return { products };
});

ipcMain.handle('products:inactive-list', async (_event, search) => {
  const products = await getInactiveProducts({
    search,
    resolveProductImageUrl: resolveProductImagePath,
  });
  return toInactiveProductsResponse(products);
});

ipcMain.handle('billing:products', async () => {
  const products = await getBillingProducts({ resolveProductImageUrl: resolveProductImagePath });
  return { products };
});

ipcMain.handle('billing:products-availability', async (_event, productIds) => {
  const products = await getBillingProductAvailability(productIds);
  return { products };
});

ipcMain.handle('assembled-offers:list', async () => {
  const offers = await listAssembledOfferCodes({ includeInactive: true, resolveProductImageUrl: resolveProductImagePath });
  return { offers };
});

ipcMain.handle('assembled-offers:create', async (_event, payload) => {
  const offer = await createAssembledOfferCode(payload || {});
  return { offer };
});

ipcMain.handle('assembled-offers:update', async (_event, payload) => {
  const offer = await updateAssembledOfferCode(payload || {});
  return { offer };
});

ipcMain.handle('products:create', async (_event, payload) => {
  try {
    const result = await createInventoryProduct(payload || {});
    return {
      ...result,
      product: {
        ...result.product,
        imageUrl: resolveProductImagePath(result.product.imageUrl),
      },
    };
  } catch (error) {
    console.error('Error controlado al crear producto:', error);
    throw new Error(error?.message || 'No se pudo crear el producto. La conexion con la base de datos sigue disponible.');
  }
});

ipcMain.handle('products:barcodes-list', async (_event, productId) => {
  const barcodes = await listProductBarcodes(productId);
  return { barcodes };
});

ipcMain.handle('products:barcodes-create', async (_event, payload) => {
  return createProductBarcode(payload || {});
});

ipcMain.handle('products:barcodes-primary', async (_event, payload) => {
  return setPrimaryProductBarcode(payload || {});
});

ipcMain.handle('products:barcodes-status', async (_event, payload) => {
  return updateProductBarcodeStatus(payload || {});
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER CARGA LOTES FEFO Y MOVIMIENTOS RECIENTES PARA EL MODAL DE DETALLE DE INVENTARIO.
ipcMain.handle('products:inventory-detail', async (_event, productId) => {
  const detail = await getProductInventoryDetail(productId);
  return {
    ...detail,
    product: {
      ...detail.product,
      imageUrl: resolveProductImagePath(detail.product.imageUrl),
    },
  };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA updateInventoryStockLevels() UBICADO EN server/data-access.js.
// ACTUALIZA LOS CAMPOS DE STOCK DEL PRODUCTO DESDE EL MODAL DE INVENTARIO.
ipcMain.handle('products:update-inventory', async (_event, payload) => {
  try {
    const result = await updateInventoryStockLevels(payload || {});
    return {
      ...result,
      imageUrl: resolveProductImagePath(result.imageUrl),
    };
  } catch (error) {
    console.error('Error controlado al actualizar inventario:', error);
    throw new Error(error?.message || 'No se pudo actualizar el inventario. La conexion con la base de datos sigue disponible.');
  }
});

ipcMain.handle('products:update-status', async (_event, payload) => {
  try {
    return updateProductActiveStatus(payload || {});
  } catch (error) {
    console.error('Error controlado al actualizar estado de producto:', error);
    throw new Error(error?.message || 'No se pudo actualizar el estado del producto.');
  }
});

ipcMain.handle('products:reactivate', async (_event, payload) => {
  try {
    const result = await reactivateInventoryProduct({
      ...(payload || {}),
      resolveProductImageUrl: resolveProductImagePath,
    });
    return toReactivatedProductResponse(result);
  } catch (error) {
    console.error('Error controlado al reactivar producto:', error);
    throw new Error(error?.message || 'No se pudo reactivar el producto.');
  }
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER RECIBE LA VENTA DESDE window.electronAPI.createSale() EN electron/preload.js.
// MANDA A LLAMAR registerSale() UBICADO EN server/data-access.js,
// DONDE ESTA LA CONSULTA INSERT INTO VENTA_EFECTIVO, VENTA_CREDITO O VENTA_TRANSFERENCIA.
ipcMain.handle('sales:create', async (_event, payload) => {
  return registerSale(payload || {});
});

ipcMain.handle('quotes:list', async (_event, status) => {
  const quotes = await listQuotes(status);
  return { quotes };
});

ipcMain.handle('quotes:details', async (_event, quoteId) => {
  return getQuoteDetails(quoteId);
});

ipcMain.handle('quotes:create', async (_event, payload) => {
  return createQuote(payload || {});
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA registerPurchase() UBICADO EN server/data-access.js.
// GUARDA COMPRAS EN dbo.COMPRA_EFECTIVO O dbo.COMPRA_CREDITO.
ipcMain.handle('purchases:create', async (_event, payload) => {
  return registerPurchase(payload || {});
});

ipcMain.handle('inventory:quick-purchase', async (_event, payload) => {
  return registerQuickInventoryPurchase(payload || {});
});

ipcMain.handle('inventory:quick-reduction', async (_event, payload) => {
  return registerQuickInventoryReduction(payload || {});
});

ipcMain.handle('purchases:annul', async (_event, payload) => {
  return annulPurchase(payload || {});
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER PROCESA OCR LOCAL CON tesseract.js EN NODE/ELECTRON.
// NO USA APIS EXTERNAS Y NO MANDA CONSULTAS A LA BASE DE DATOS.
ipcMain.handle('purchases:ocr-invoice', async (_event, payload) => {
  const bytes = payload?.bytes;

  if (!Array.isArray(bytes) || bytes.length === 0) {
    throw new Error('Imagen requerida para OCR.');
  }

  const imageBuffer = Buffer.from(Uint8Array.from(bytes));
  if (imageBuffer.length === 0) {
    throw new Error('La imagen llego vacia al OCR.');
  }

  const spaLanguage = require('@tesseract.js-data/spa');
  const worker = await Tesseract.createWorker('spa', 1, {
    cacheMethod: 'none',
    gzip: true,
    langPath: spaLanguage.langPath,
  });

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });
    const result = await worker.recognize(imageBuffer);
    return { text: result.data.text || '' };
  } finally {
    await worker.terminate();
  }
});

app.whenReady().then(() => {
  scheduleAutomaticBackups({ audit: createAuditHistoryRecord });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
