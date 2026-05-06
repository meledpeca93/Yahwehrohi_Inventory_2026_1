const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const { getPool } = require('../server/db');
const {
  activateInvoice,
  annulInvoice,
  createDailyCut,
  createOpeningCut,
  createOperationalCost,
  listMonthlyCostIncreaseAlerts,
  getDashboardSalesSummary,
  getDashboardSalesTrend,
  getSalesByCategoryForPeriod,
  getSalesDropAlert,
  getSalesTotalByPeriod,
  getInvoiceDetails,
  getInvoicesSummary,
  getNextInvoiceNumber,
  getProducts,
  listActiveUsers,
  listAuditHistory,
  listAttendanceUsers,
  listCredits,
  listCreditPaymentsByDate,
  listDailyCuts,
  listCustomers,
  listExpiringProducts,
  listInvoices,
  listPurchases,
  listOperationalCosts,
  listTodayInvoices,
  listSuppliers,
  loginUser,
  previewDailyCut,
  registerCreditPayment,
  registerPurchase,
  registerSale,
  saveAttendanceMark,
  updateInventoryStockLevels,
} = require('../server/data-access');

const imageAssetsPrefix = 'assets/img/';
const imageAssetsPath = path.join(__dirname, '..', 'src', 'img');
const isDev = !app.isPackaged;

function findImageAssetFile(fileName) {
  const safeFileName = path.basename(fileName || '');

  if (!safeFileName || !fs.existsSync(imageAssetsPath)) {
    return null;
  }

  const assetFileNames = fs.readdirSync(imageAssetsPath);
  const exactFile = assetFileNames.find((assetFileName) => assetFileName === safeFileName);

  if (exactFile) {
    return exactFile;
  }

  return assetFileNames.find((assetFileName) => assetFileName.toLowerCase() === safeFileName.toLowerCase()) || null;
}

function resolveProductImagePath(imageUrl) {
  if (!imageUrl || !imageUrl.toLowerCase().startsWith(imageAssetsPrefix)) {
    return imageUrl;
  }

  const fileName = imageUrl.slice(imageAssetsPrefix.length);
  const matchingFile = findImageAssetFile(fileName);

  return matchingFile ? path.join(imageAssetsPath, matchingFile) : imageUrl;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:4200');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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

ipcMain.handle('app:quit', () => {
  app.quit();
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA listCreditPaymentsByDate() UBICADO EN server/data-access.js.
// CONSULTA dbo.PAGOS_CREDITO FILTRANDO POR FECHA.
ipcMain.handle('credit-payments:list', async (_event, payload) => {
  const payments = await listCreditPaymentsByDate(payload?.date, payload?.userId);
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
ipcMain.handle('invoices:annul', async (_event, invoiceId) => {
  return annulInvoice(invoiceId);
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA activateInvoice() UBICADO EN server/data-access.js.
// ACTIVA FACTURA ANULADA Y DESCUENTA STOCK DEL INVENTARIO.
ipcMain.handle('invoices:activate', async (_event, invoiceId) => {
  return activateInvoice(invoiceId);
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA getDashboardSalesSummary() UBICADO EN server/data-access.js.
// CONSULTA VENTA_EFECTIVO, VENTA_TRANSFERENCIA Y VENTA_CREDITO PARA LAS TARJETAS DEL DASHBOARD.
ipcMain.handle('dashboard:sales-summary', async () => {
  return getDashboardSalesSummary();
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

ipcMain.handle('products:list', async () => {
  const products = await getProducts({ resolveProductImageUrl: resolveProductImagePath });
  return { products };
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA updateInventoryStockLevels() UBICADO EN server/data-access.js.
// ACTUALIZA LOS CAMPOS DE STOCK DEL PRODUCTO DESDE EL MODAL DE INVENTARIO.
ipcMain.handle('products:update-inventory', async (_event, payload) => {
  return updateInventoryStockLevels(payload || {});
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER RECIBE LA VENTA DESDE window.electronAPI.createSale() EN electron/preload.js.
// MANDA A LLAMAR registerSale() UBICADO EN server/data-access.js,
// DONDE ESTA LA CONSULTA INSERT INTO VENTA_EFECTIVO, VENTA_CREDITO O VENTA_TRANSFERENCIA.
ipcMain.handle('sales:create', async (_event, payload) => {
  return registerSale(payload || {});
});

// PROCEDIMIENTO UBICADO EN electron/main.js
// ESTE HANDLER EJECUTA registerPurchase() UBICADO EN server/data-access.js.
// GUARDA COMPRAS EN dbo.COMPRA_EFECTIVO O dbo.COMPRA_CREDITO.
ipcMain.handle('purchases:create', async (_event, payload) => {
  return registerPurchase(payload || {});
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
