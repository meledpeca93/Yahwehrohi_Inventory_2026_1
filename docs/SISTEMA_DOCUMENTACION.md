# Yahweh Rohi Inventory - Documentacion Operativa

Este documento ordena las secciones del sistema y deja trazabilidad entre pantalla, datos, conexiones, procedimientos y consultas de base de datos.

## Estructura Del Proyecto

| Ruta | Funcion que realiza | Datos que recopila o genera | Conexiones o procedimientos |
| --- | --- | --- | --- |
| `src/app/app.html` | Plantilla principal Angular. Contiene todas las vistas por `activePage()`. | Captura formularios, muestra tablas, tarjetas, modales y graficos. | Llama metodos de `src/app/app.ts` mediante eventos Angular. |
| `src/app/app.ts` | Estado de UI, validaciones, carga de datos, transformaciones y acciones de usuario. | Signals/computed para inventario, ventas, compras, creditos, asistencia, planilla, costos y dashboard. | Usa `HttpClient` contra `server/server.js` o `window.electronAPI` expuesto por Electron. |
| `src/app/app.css` | Estilos de vistas, tablas, modales, graficos y estados visuales. | No genera datos; define presentacion. | Se aplica a `app.html`. |
| `server/server.js` | API HTTP Express. | Recibe requests REST y devuelve JSON. | Llama funciones de `server/data-access.js`. |
| `electron/main.js` | Handlers IPC para version desktop. | Recibe llamadas desde preload/UI y devuelve JSON. | Llama las mismas funciones de `server/data-access.js`. |
| `electron/preload.js` | Puente seguro Electron hacia Angular. | Expone `window.electronAPI`. | Invoca handlers definidos en `electron/main.js`. |
| `server/data-access.js` | Acceso central a SQL Server. | Ejecuta SELECT/INSERT/UPDATE/DELETE/procedimientos y mapea resultados. | Usa `getPool()` de `server/db.js`. |
| `server/db.js` | Configuracion de conexion SQL Server. | Pool de conexion MSSQL. | Lee `.env`: `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. |
| `database/migrations` | Scripts SQL de estructura, procedimientos y triggers. | Crea tablas, procedimientos y auditoria. | Se ejecutan manualmente en SQL Server. |

## Flujo De Conexion

1. UI Angular ejecuta un metodo en `src/app/app.ts`.
2. Si corre en Electron, usa `window.electronAPI`; si corre web, usa `HttpClient`.
3. Electron (`electron/main.js`) o Express (`server/server.js`) llaman a `server/data-access.js`.
4. `server/data-access.js` usa `server/db.js` para ejecutar consultas en SQL Server.
5. La respuesta vuelve a Angular y se muestra en `src/app/app.html`.

## Secciones Del Sistema

| Seccion | Ubicacion en UI | Funcion que realiza | Datos que recopila o genera | Conexion/procedimientos | Donde se muestra |
| --- | --- | --- | --- | --- | --- |
| Inventario | `app.html`, `activePage() === 'inventory-sheet'` | Lista productos activos e inventario; permite actualizar niveles. | Producto, codigo, imagen, categoria, stock, min/max, costo, precio, proveedor, venta mes anterior. | `getProducts()` y `updateInventoryStockLevels()` en `server/data-access.js`; API `/api/products`, `PUT /api/products/:productId/inventory`; IPC `products:list`, `products:update-inventory`. | Tabla de inventario, modales de edicion y tarjetas de stock. |
| Stock sin existencia | `app.html`, `activePage() === 'inventory-out-of-stock'` | Filtra productos con stock bajo o agotado. | Datos derivados de inventario cargado. | Usa `products()` cargado por `getProducts()`. | Vista de productos agotados/bajo stock. |
| Dashboard | `app.html`, `activePage() === 'dashboard'` | Muestra resumen ejecutivo, graficos de ventas/compras y alerta de caida de ventas. | Totales de inventario, ventas, compras, tendencias, alerta contra referencia diaria. | `loadDashboardSalesSummary()`, `loadDashboardSalesTrend()`, `loadSalesDropAlert()`, `loadPurchases()`; API `/api/dashboard/*`; IPC `dashboard:*`. | Tarjetas KPI, graficos Chart.js y boton/tooltip de ventas. |
| Facturacion | `app.html`, `activePage() === 'billing'` | Registra ventas, clientes, carrito, formas de pago, corte y alertas. | Carrito, cliente, forma de pago, factura, ventas por linea, corte diario, alertas. | `registerSale()`, `getNextInvoiceNumber()`, `listCustomers()`, `createOpeningCut()`, `createDailyCut()`; API `/api/sales`, `/api/invoices/next`, `/api/daily-cuts`. | Formulario de venta, carrito, totales, modales de caja y ventas del dia. |
| Facturas | `app.html`, `activePage() === 'invoices'` | Consulta facturas, detalle, anulacion/reactivacion y grafico de ventas. | Factura, cliente, forma de pago, estado, articulos, utilidad, detalle por linea. | `listInvoices()`, `listTodayInvoices()`, `getInvoiceDetails()`, `annulInvoice()`, `activateInvoice()`, `getDashboardSalesTrend()`. | Tabla de facturas, modales de detalle/exportacion y grafico de tendencia. |
| Compras | `app.html`, `activePage() === 'purchases'` | Registra compras y consulta historico por proveedor/factura. | Proveedor, producto, cantidad, costo, tipo de pago, factura, estado de compra. | `listPurchases()`, `registerPurchase()`, `listSuppliers()`; API `/api/purchases`, `/api/suppliers`; IPC `purchases:*`. | Vista de compras, formulario de compra, grafico de compras. |
| Creditos | `app.html`, `activePage() === 'credits'` | Lista creditos por cliente y pagos/abonos asociados. | Cliente, facturas a credito, saldo, estado, pagos por fecha/usuario. | `listCredits()`, `listCreditPaymentsByDate()`; API `/api/credits`, `/api/credit-payments`; IPC `credits:list`, `credit-payments:list`. | Tabla agrupada por cliente y modales/reportes PDF. |
| Asistencia | `app.html`, `activePage() === 'attendance'` | Lista empleados y registra asistencia diaria. | Usuario/empleado, fecha, entrada, salida, semana, estado, observacion. | `listAttendanceUsers()`, `saveAttendanceMark()`; API `/api/attendance/users`, `/api/attendance/mark`; IPC `attendance:*`. | Tabla de asistencia y formularios de marca. |
| Planilla | `app.html`, `activePage() === 'payroll'` | Calcula y muestra salarios por empleado/semana. | Horas normales/extra, bonos, totales semanales, top empleados y grafico. | `listAttendanceUsers()` y vista/procedimiento `VW_ASISTENCIA_HORAS`/`sp_calcular_planilla` segun migracion. | Tarjetas, tabla semanal y grafico de planilla. |
| Generar planilla | `app.html`, `activePage() === 'payroll-generate'` | Permite simular/generar horas por turno y calcular pago. | Horas por empleado/dia/turno, tarifas y total generado. | Datos locales de asistencia cargados por `listAttendanceUsers()`. | Matriz de generacion y resumen de pago. |
| Costos | `app.html`, `activePage() === 'costs'` | Analiza costos, ventas por periodo/categoria, costos operativos y alertas de aumento. | Costos de inventario, utilidad potencial, costos operativos, utilidad neta estimada, ventas por categoria e historial de costos. | `getSalesTotalByPeriod()`, `getSalesByCategoryForPeriod()`, `listMonthlyCostIncreaseAlerts()`, `listOperationalCosts()`, `createOperationalCost()`, `executeMonthlyCostIncreaseProcedure()`. | Tarjetas de costos, formulario de costos operativos, tabla de gastos, graficos y tabla de alertas. |
| Historial | `app.html`, `activePage() === 'history'` | Muestra movimientos locales/historicos operativos. | Movimientos derivados de ventas/compras/inventario segun estado local. | Datos en signals de `app.ts`; no tiene endpoint dedicado. | Tabla/lista de historial. |

## Auditoria

La auditoria de base de datos se instala con `database/migrations/005_install_auditoria_triggers_sql_server.sql`.

Funcion que realiza:
- Crea triggers `AFTER INSERT, UPDATE, DELETE` para todas las tablas de usuario excepto `dbo.auditoria`.
- Registra cada movimiento en `dbo.auditoria`.

Datos que genera:
- `dato_anterior`: columnas concatenadas como `columna=valor_anterior`.
- `dato_nuevo`: columnas concatenadas como `columna=valor_nuevo`.
- Si existen columnas auxiliares en `dbo.auditoria`, tambien llena tabla, accion, fecha, usuario, id usuario y clave del registro.

Conexiones/procedimientos:
- Procedimiento instalador: `dbo.sp_instalar_triggers_auditoria`.
- Contexto desde Node: `setAuditContext()` en `server/data-access.js`.
- Usa `SESSION_CONTEXT('audit_user_id')` y `SESSION_CONTEXT('audit_user')` cuando la operacion viene de la app.

## Graficos

Los graficos usan Chart.js en `src/app/app.ts`.

| Grafico | Canvas | Datos | Carga/refresh |
| --- | --- | --- | --- |
| Ventas dashboard | `#salesTrendCanvas` | `salesTrendData()` desde `getDashboardSalesTrend()` | `updateSalesTrendChart()` y `scheduleVisibleChartsRefresh()`. |
| Ventas facturas | `#invoicesSalesTrendCanvas` | Misma tendencia de ventas | `updateInvoicesSalesTrendChart()`. |
| Compras | `#purchasesTrendCanvas` | `purchaseRows` desde `listPurchases()` | `updatePurchasesTrendChart()`. |
| Planilla | `#payrollTrendCanvas` | `payrollTrendChartSeries()` desde asistencia | `updatePayrollTrendChart()`. |
| Costos distribucion | `#costsDistributionCanvas` | `costDistributionSeries()` | `updateCostsDistributionChart()`. |
| Costos evolucion | `#costsEvolutionCanvas` | `costMonthlyTrend()` | `updateCostsEvolutionChart()`. |
| Costos categoria | `#costsCategoryCanvas` | `costCategoryComparisonSeries()` | `updateCostsCategoryChart()`. |

## Costos Operativos Y Costo Real

La migracion `database/migrations/006_create_operational_costs_sql_server.sql` agrega:

- `dbo.COSTO_OPERATIVO`: registra gastos de energia, transporte, alquiler, internet, empaque, mantenimiento, comisiones y otros. Cada gasto queda asociado a una factura de compra existente mediante `ID_COMPRA`, `TIPO_COMPRA` y `NUM_FACT`, tomando datos de `dbo.COMPRA_EFECTIVO` o `dbo.COMPRA_CREDITO`.
- Columnas opcionales en `dbo.COMPRA_EFECTIVO` y `dbo.COMPRA_CREDITO`: `COSTO_TRANSPORTE_TOTAL`, `OTROS_COSTOS_DIRECTOS`, `COSTO_ADICIONAL_UNIDAD` y `COSTO_REAL_UNITARIO`.

Calculo usado en compras:

```text
costo_adicional_unidad = (transporte + otros_costos_directos) / unidades_del_viaje
costo_real_unitario = costo_producto_unitario + costo_adicional_unidad
```

Ese costo real se usa al registrar la compra y actualizar el costo promedio del producto en inventario.

Notas de mantenimiento:
- Al cambiar de pagina se recrea el chart si cambia el canvas.
- Se ejecuta `resize()` antes de `update()` para corregir dimensiones al volver a una vista.
