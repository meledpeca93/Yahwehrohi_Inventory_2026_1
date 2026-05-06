require('dotenv').config();

const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { getPool } = require('./db');
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
  saveAttendanceMark,
  listSuppliers,
  loginUser,
  previewDailyCut,
  registerCreditPayment,
  registerPurchase,
  registerSale,
  updateInventoryStockLevels,
} = require('./data-access');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: ['http://localhost:4200', 'http://127.0.0.1:4200'] }));
app.use(express.json());

const imageAssetsPrefix = 'assets/img/';
const imageAssetsPath = path.join(__dirname, '..', 'src', 'img');

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

function resolveProductImageUrl(imageUrl) {
  if (!imageUrl || !imageUrl.toLowerCase().startsWith(imageAssetsPrefix)) {
    return imageUrl;
  }

  const fileName = imageUrl.slice(imageAssetsPrefix.length);
  const matchingFile = findImageAssetFile(fileName);

  return matchingFile ? `/api/product-images/${encodeURIComponent(matchingFile)}` : imageUrl;
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

app.get('/api/product-images/:fileName', (req, res) => {
  const matchingFile = findImageAssetFile(req.params.fileName);

  if (!matchingFile) {
    return res.status(404).json({ message: 'Imagen de producto no encontrada' });
  }

  return res.sendFile(path.join(imageAssetsPath, matchingFile));
});

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
    const result = await annulInvoice(req.params.invoiceId);
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
    const result = await activateInvoice(req.params.invoiceId);
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

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO registerSale DE server/data-access.js
// PARA INSERTAR LAS LINEAS DE LA VENTA EN LA TABLA VENTA.
// RECIBE user, userId, paymentTypeId, customerId Y lines DESDE src/app/app.ts, PROCEDIMIENTO requestCreateSale().
app.post('/api/sales', async (req, res) => {
  const { user, userId, paymentTypeId, customerId, lines } = req.body || {};

  try {
    const sale = await registerSale({ user, userId, paymentTypeId, customerId, lines });
    return res.status(201).json(sale);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al registrar la venta' });
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

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA EL PROCEDIMIENTO getProducts DE server/data-access.js
// PARA CARGAR LOS PRODUCTOS Y LOS DATOS DE INVENTARIO DESDE SQL SERVER.
app.get('/api/products', async (_req, res) => {
  try {
    const products = await getProducts({ resolveProductImageUrl });

    return res.json({ products });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener productos de inventario' });
  }
});

// PROCEDIMIENTO UBICADO EN server/server.js
// ESTA RUTA EJECUTA updateInventoryStockLevels() UBICADO EN server/data-access.js.
// ACTUALIZA stock, stock_minimo Y stock_maximo EN dbo.inventario DESDE EL MODAL DE INVENTARIO.
app.put('/api/products/:productId/inventory', async (req, res) => {
  const { stock, minStock, maxStock } = req.body || {};

  try {
    const result = await updateInventoryStockLevels({
      productId: req.params.productId,
      stock,
      minStock,
      maxStock,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Error al actualizar inventario' });
  }
});

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
