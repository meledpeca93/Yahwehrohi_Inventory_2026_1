# Modules

## Facturacion

- Controles de presentación de tablas modales: `src/app/features/shared/modal-table/modal-table-state.ts` (búsqueda, ordenamiento, selección/CSV, paginación y densidad); no modifica registros ni servicios de negocio.

- Responsabilidad: catalogo de productos vendibles, carrito, cotizaciones a venta, registro de ventas, actualizacion visual de stock, facturas y anulaciones/activaciones.
- Frontend: secciones `billing` e `invoices` en `src/app/app.ts/html`; servicio `src/app/modules/facturacion/services/facturacion-api.service.ts`.
- Backend modular: `server/modules/facturacion/*`.
- Acceso a datos: `getBillingProducts`, `getBillingProductAvailability`, `registerSale`, `getNextInvoiceNumber`, `listInvoices`, `listTodayInvoices`, `getInvoiceDetails`, `annulInvoice`, `activateInvoice`.
- Endpoints: `GET /api/billing/products`, `POST /api/billing/products/availability`, `POST /api/sales`, `GET /api/invoices/next`, `GET /api/invoices`, `GET /api/invoices/today`, `GET /api/invoices/summary`, `GET /api/invoices/:invoiceId/details`, `POST /api/invoices/:invoiceId/annul`, `POST /api/invoices/:invoiceId/activate`.
- Dependencias: productos activos, codigos de barra de producto, inventario, lotes FEFO, clientes, usuarios, formas de pago, cotizaciones.
- Estado: implementado y parcialmente modularizado. Importante: despues de vender se actualizan solo los productos afectados con `updatedProducts`.

## Inventario

- Responsabilidad: productos, stock, costos, precios, minimos/maximos, lotes, vencimientos, ajustes rapidos, rebajas e inactivacion logica.
- Frontend: pagina `inventory-sheet`, pagina `inventory-out-of-stock`, modales en `src/app/app.ts/html/css`.
- Backend: funciones en `server/data-access.js`.
- Endpoints: `GET /api/products`, `GET /api/products/inactive`, `POST /api/products`, `GET /api/products/expiring`, `GET /api/products/:productId/inventory-detail`, `GET/POST /api/products/:productId/barcodes`, `PUT /api/products/:productId/barcodes/:barcodeId/primary`, `PUT /api/products/:productId/barcodes/:barcodeId/status`, `PUT /api/products/:productId/inventory`, `PUT /api/products/:productId/status`, `PUT /api/products/:productId/reactivate`, `POST /api/inventory/quick-purchase`, `POST /api/inventory/quick-reduction`.
- Dependencias: `dbo.producto`, `dbo.PRODUCTO_CODIGO_BARRA`, `dbo.inventario`, `dbo.PRODUCTO_LOTE`, `dbo.INVENTARIO_LOG`, auditoria, compras y ventas.
- Estado: implementado para activos e inactivos. Reactivacion usa el mismo producto historico, movimiento de inventario y lote FEFO nuevo.

## Compras

- Responsabilidad: registro de compras, ingreso de mercaderia, costos, proveedores, anulacion de compras, OCR de facturas.
- Frontend: pagina `purchases` y flujos OCR en `src/app/app.ts/html`; Tesseract.js.
- Backend: `registerPurchase`, `listPurchases`, `annulPurchase`, `registerQuickInventoryPurchase`.
- Endpoints: `GET /api/purchases`, `POST /api/purchases`, `POST /api/purchases/annul`, `POST /api/inventory/quick-purchase`.
- Dependencias: proveedores, productos, inventario, lotes FEFO, auditoria.
- Estado: implementado.

## Creditos

- Responsabilidad: consulta de creditos, abonos, saldos por cliente, historial de pagos y asignacion de abonos.
- Frontend: pagina `credits`, cortes diarios y caja usan informacion de creditos.
- Backend: `listCredits`, `registerCreditPayment`, `listCreditPaymentsByDate`, `listCreditPaymentsHistory`, `listCreditPaymentsByCustomer`.
- Endpoints: `GET /api/credits`, `POST /api/credits/payments`, `GET /api/credit-payments`, `GET /api/credit-payments/history`, `GET /api/credit-payments/customer/:customerId`.
- Dependencias: clientes, ventas a credito, `CREDITO_ABONO_DETALLE`, caja/cortes.
- Estado: implementado con migraciones recientes para clientes/abonos.

## Planillas

- Submodulos: Planillas y Asistencia.

- Responsabilidad: usuarios/empleados, marcas de asistencia, calculo y guardado de planillas semanales.
- Frontend: paginas `attendance`, `payroll`, `payroll-generate`; panel de usuario en el menu lateral para registrar marcas desde selector de usuario.
- Backend: `listAttendanceUsers`, `saveAttendanceMark`, `savePayrollWeek`, `listPayrollRecords`.
- Endpoints: `GET /api/attendance/users`, `POST /api/attendance/mark`, `POST /api/payroll/week`, `GET /api/payroll/records`.
- Dependencias: `dbo.usuario`, `dbo.PLANILLA`, tabla de asistencia usada por queries actuales.
- Estado: implementado. Desde el submenu de usuario se puede registrar entrada y salida del dia para el usuario seleccionado; planilla sigue consumiendo horas desde asistencia cuando existen ambas marcas.

## Clientes

- Responsabilidad: catalogo de clientes para facturacion, creditos y cortes.
- Backend: `listCustomers`.
- Endpoint: `GET /api/customers`.
- Dependencias: `dbo.cliente`, ventas, creditos.
- Estado: consulta implementada. No se verifico formulario CRUD completo en esta inspeccion.

## Proveedores

- Responsabilidad: catalogo de proveedores para compras.
- Backend: `listSuppliers`.
- Endpoint: `GET /api/suppliers`.
- Dependencias: compras.
- Estado: consulta implementada. No se verifico formulario CRUD completo en esta inspeccion.

## Reportes, dashboard y analitica

- Responsabilidad: resumen de ventas, tendencias, rentabilidad, costos por categoria, alertas de caida de ventas, exportacion PDF/HTML.
- Frontend: `dashboard`, `sales-profitability`, `costs`.
- Backend: `getDashboardSalesSummary`, `getDashboardSalesTrend`, `getSalesDropAlert`, `getSalesProfitabilityAnalytics`, `getSalesTotalByPeriod`, `getSalesByCategoryForPeriod`, `listMonthlyCostIncreaseAlerts`.
- Endpoints: `/api/dashboard/*`, `/api/analytics/sales-profitability`, `/api/costs/*`.
- Estado: implementado; varias consultas son pesadas y no deben cargarse desde Facturacion.

## Historico

- Responsabilidad: historial/auditoria de movimientos operativos y consulta de cambios registrados.
- Frontend: pagina `history` en `src/app/app.ts/html`.
- Backend: `listAuditHistory`, `createAuditHistoryRecord`.
- Endpoints: `GET /api/history/audit`, `POST /api/history/audit`.
- IPC Electron: `history:audit`, `history:audit-create`.
- Dependencias: `dbo.auditoria`, contexto de auditoria y registros generados por modulos como Inventario, Facturacion, Respaldos y Restauracion.
- Estado: implementado. Debe tratarse como modulo propio cuando se diagnostiquen problemas de carga o rendimiento del historico.

## Usuarios y seguridad

- Responsabilidad: login, listado de usuarios activos, contexto de usuario para auditoria.
- Backend: `loginUser`, `listActiveUsers`.
- Endpoints: `POST /api/auth/login`, `GET /api/auth/users`.
- Dependencias: `dbo.usuario`, auditoria.
- Estado: implementado. No hay middleware central de permisos verificado.

## Configuracion

- Responsabilidad: preferencias visuales, menu, tablas, inventario, dashboard, notificaciones, sistema y respaldo/restauracion de base de datos.
- Frontend: settings dentro de `src/app/app.html` controlado por `SettingsTabId` y signals.
- Persistencia: preferencias generales en local/localStorage; configuracion e historial de respaldos en `server/modules/database-backup/storage/*.json`.
- Backend respaldo BD: `server/modules/database-backup/backup.service.js` y `backup.routes.js`.
- Endpoints respaldo BD: `GET /api/database-backups`, `GET /api/database-backups/config`, `PUT /api/database-backups/config`, `POST /api/database-backups/manual`, `POST /api/database-backups/run-automatic`, `POST /api/database-backups/validate`, `POST /api/database-backups/restore`.
- Dependencias respaldo BD: SQL Server, `BACKUP DATABASE`, `RESTORE VERIFYONLY`, `RESTORE DATABASE`, `server/db.js`, auditoria.
- Estado: implementado en UI monolitica. Restauracion exige usuario administrador, doble confirmacion en UI y respaldo `Pre-Restauración` antes de modificar la base.

## Finanzas

- Submodulos: Costos, Caja chica, Finanzas, Ventas y Rentabilidad.

- Responsabilidad: apertura/cierre de caja, cortes diarios, caja chica, movimientos financieros, costos operativos y analisis de ventas/rentabilidad.
- Frontend: paginas `costs`, `financial-movements`, `petty-cash`, `sales-profitability` y flujos de apertura/cierre.
- Backend: `createOpeningCut`, `previewDailyCut`, `createDailyCut`, `listDailyCuts`, `updateDailyCutCashManagement`, `deleteDailyCutCashManagement`, `listPettyCashRecords`, `createPettyCashRecord`, `updatePettyCashRecord`, `deletePettyCashRecord`, `listFinancialMovements`, `createFinancialMovement`, `getSalesProfitabilityAnalytics`, `getSalesTotalByPeriod`, `getSalesByCategoryForPeriod`, `listMonthlyCostIncreaseAlerts`.
- Endpoints: `/api/daily-cuts*`, `/api/petty-cash*`, `/api/financial-movements`, `/api/analytics/sales-profitability`, `/api/costs/*`.
- Estado: implementado.

## Cotizaciones

- Responsabilidad: guardar cotizaciones y facturarlas despues.
- Backend: `ensureQuoteObjects`, `listQuotes`, `getQuoteDetails`, `createQuote`; `registerSale` puede marcar cotizacion como `FACTURADA`.
- Endpoints: `GET /api/quotes`, `GET /api/quotes/:quoteId`, `POST /api/quotes`.
- Tablas: `dbo.COTIZACION`, `dbo.COTIZACION_DETALLE`.
- Estado: implementado.

## Salud del sistema e imagenes

- Responsabilidad: estado DB/disco/imagenes y servir assets de producto.
- Backend: `getSystemHealth`, resolucion de imagenes en `server/server.js` y `electron/main.js`.
- Endpoints: `GET /api/health`, `GET /api/system-health`, `GET /api/product-images/:fileName`, `GET /api/product-images-local/:encodedPath`, `GET /api/product-image-thumbnails/:source/:fileRef`.
- Estado: implementado.
