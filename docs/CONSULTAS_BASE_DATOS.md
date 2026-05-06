# Consultas De Base De Datos Documentadas

Este documento resume las consultas principales ubicadas en `server/data-access.js`, los datos que generan y el punto donde se muestran o usan en el sistema.

## Autenticacion Y Usuarios

| Funcion | Tablas/procedimientos | Consulta/operacion | Datos que genera | Donde se usa/muestra |
| --- | --- | --- | --- | --- |
| `loginUser(usuario, pass)` | `dbo.usuario` | `SELECT TOP 1` usuario activo y `UPDATE ultimo_acceso`. | Usuario autenticado: id, nombre, usuario, rol. | Login, sesion actual, pill de usuario y operaciones con `currentUser()`. |
| `listActiveUsers()` | `dbo.usuario` | `SELECT` usuarios activos. | Lista de usuarios. | Catalogo/seleccion interna de usuarios. |
| `executeMonthlyCostIncreaseProcedure(userId)` | `dbo.sp_registrar_aumentos_costo_ultimo_mes` | Ejecuta procedimiento almacenado. | Historial y alertas mensuales de aumento de costo. | Costos y alertas. |

## Asistencia Y Planilla

| Funcion | Tablas/procedimientos | Consulta/operacion | Datos que genera | Donde se usa/muestra |
| --- | --- | --- | --- | --- |
| `listAttendanceUsers()` | `dbo.usuario`, `dbo.ASISTENCIA`, `dbo.VW_ASISTENCIA_HORAS` | Consulta empleados y su historial. | Usuario, entrada, salida, estado, horas, semanas. | Paginas Asistencia, Planilla y Generar planilla. |
| `saveAttendanceMark()` | `dbo.ASISTENCIA` | `UPDATE` si existe marca diaria; si no, `INSERT`. | Marca de asistencia por empleado/fecha. | Tabla de asistencia y calculos de planilla. |

## Inventario Y Productos

| Funcion | Tablas/procedimientos | Consulta/operacion | Datos que genera | Donde se usa/muestra |
| --- | --- | --- | --- | --- |
| `getProducts()` | `dbo.producto`, `dbo.inventario`, `VENTA_*` | `SELECT` productos activos con inventario y ventas del mes anterior. | Producto, stock, costo, precio, categoria, proveedor, venta previa. | Inventario, facturacion, compras, stock bajo y selects de producto. |
| `updateInventoryStockLevels()` | `dbo.inventario`, `dbo.producto` | `UPDATE` stock, minimo y maximo por `id_producto`. | Inventario actualizado. | Modal de inventario y tarjetas de stock. |
| `ensureExpiringProductsObjects()` | `dbo.PRODUCTO_PROXIMO_VENCER` | Crea objetos si faltan. | Soporte de alertas de vencimiento. | Alertas de productos proximos a vencer. |
| `refreshExpiringProducts()` | `dbo.sp_recalcular_productos_proximos_vencer` | Ejecuta recalculo. | Productos vencidos/proximos a vencer. | Modal de alertas en facturacion. |
| `listExpiringProducts()` | `dbo.PRODUCTO_PROXIMO_VENCER` | `SELECT` alertas activas. | Producto, stock, fecha vencimiento y prioridad. | Boton/modal de vencimientos. |

## Clientes, Proveedores Y Compras

| Funcion | Tablas/procedimientos | Consulta/operacion | Datos que genera | Donde se usa/muestra |
| --- | --- | --- | --- | --- |
| `listCustomers()` | `dbo.cliente` | `SELECT` clientes. | Cliente, contacto, direccion, saldo. | Facturacion y creditos. |
| `listSuppliers()` | Tablas de proveedores | `SELECT` proveedores activos. | Proveedor, telefono, direccion. | Compras. |
| `listPurchases()` | `COMPRA_EFECTIVO`, `COMPRA_CREDITO`, producto/proveedor/usuario/estado | `UNION ALL` de compras por forma de pago. | Historico de compras, producto, costo, usuario, proveedor. | Pagina Compras, Dashboard compras, Costos. |
| `registerPurchase()` | `COMPRA_EFECTIVO` o `COMPRA_CREDITO` | `INSERT` por linea de compra. | Compra guardada con producto, cantidad, costo, usuario, proveedor y factura. | Formulario de compras e historico. |

## Ventas, Facturas Y Creditos

| Funcion | Tablas/procedimientos | Consulta/operacion | Datos que genera | Donde se usa/muestra |
| --- | --- | --- | --- | --- |
| `resolveSaleCustomerId()` | `dbo.cliente` | Busca o crea `Cliente final`. | `ID_CLIENTE` para facturas/ventas. | Registro de venta. |
| `getNextInvoiceNumber()` | `dbo.FACTURA` | `SELECT ISNULL(MAX(ID_FACT), 0) + 1`. | Siguiente numero de factura. | Formulario de facturacion. |
| `registerSale()` | `dbo.FACTURA`, `VENTA_EFECTIVO`, `VENTA_CREDITO`, `VENTA_TRANSFERENCIA` | `INSERT` factura y lineas de venta. | Factura, ventas, utilidad, cliente, estado y forma de pago. | Facturacion, facturas, dashboard, creditos. |
| `listInvoices()` | `dbo.FACTURA`, cliente, usuario, tipo pago, estado venta, `VENTA_*` | Consulta facturas con totales y estados. | Facturas, articulos, total, utilidad, cliente. | Pagina Facturas. |
| `listTodayInvoices()` | `dbo.FACTURA`, `VENTA_*` | Consulta ventas del dia. | Ventas actuales por factura. | Modal Ventas del dia. |
| `getInvoiceDetails(invoiceId)` | `dbo.FACTURA`, `VENTA_*`, producto/estado | Detalle por linea de factura. | Productos vendidos, cantidad, precio, total y estado. | Modal detalle/exportacion de factura. |
| `getInvoicesSummary()` | `dbo.FACTURA`, `VENTA_*` | Agregados de facturas. | Resumen financiero de facturas. | Tarjetas de facturas. |
| `annulInvoice(invoiceId)` | `VENTA_*`, `dbo.inventario` | `UPDATE` estado de venta y devuelve stock. | Factura anulada e inventario ajustado. | Accion de anular factura. |
| `activateInvoice(invoiceId)` | `VENTA_*`, `dbo.inventario` | `UPDATE` estado de venta y descuenta stock. | Factura activada e inventario ajustado. | Accion de activar factura. |
| `listCredits()` | `VENTA_CREDITO`, clientes, facturas, pagos | Consulta creditos agrupables por cliente. | Saldo, facturas abiertas, lineas credito. | Pagina Creditos. |
| `listCreditPaymentsByDate()` | `dbo.PAGOS_CREDITO` | Consulta pagos por fecha/usuario. | Abonos de creditos. | Corte diario y modales de pagos. |

## Dashboard

| Funcion | Tablas/procedimientos | Consulta/operacion | Datos que genera | Donde se usa/muestra |
| --- | --- | --- | --- | --- |
| `getDashboardSalesSummary()` | `VENTA_EFECTIVO`, `VENTA_TRANSFERENCIA`, `VENTA_CREDITO`, `COMPRA_*` | Totales mensuales/acumulados. | Venta contado/transferencia, credito, compras y etiquetas de mes. | KPI del Dashboard. |
| `getDashboardSalesTrend(period)` | `VENTA_EFECTIVO`, `VENTA_CREDITO`, `VENTA_TRANSFERENCIA` | Agrega ventas por dia/semana/mes y forma de pago. | Serie para grafico de ventas. | Graficos del Dashboard y Facturas. |
| `getSalesDropAlert()` | `VENTA_EFECTIVO`, `VENTA_CREDITO`, `VENTA_TRANSFERENCIA` | Resume ventas por dia, compara hoy contra ayer o ultimo dia con ventas. | Total hoy, referencia, fecha referencia, porcentaje faltante y severidad. | Boton/tooltip de Ventas y modal de caida de ventas. |

## Costos

| Funcion | Tablas/procedimientos | Consulta/operacion | Datos que genera | Donde se usa/muestra |
| --- | --- | --- | --- | --- |
| `getSalesTotalByPeriod(year, month)` | `VENTA_*` | Suma ventas por periodo. | Total de venta mensual/periodo. | Tarjetas de Costos. |
| `getSalesByCategoryForPeriod(year, month)` | `VENTA_*`, `dbo.producto`, `dbo.inventario` | Suma costo/venta por categoria. | Comparativo costo vs venta. | Grafico/tabla de Costos por categoria. |
| `listMonthlyCostIncreaseAlerts()` | `dbo.ALERTA_AUMENTO_COSTO_MENSUAL` | Consulta alertas del ultimo periodo. | Producto, costo anterior/actual, aumento y porcentaje. | Tabla de alertas de costos. |

## Cortes De Caja

| Funcion | Tablas/procedimientos | Consulta/operacion | Datos que genera | Donde se usa/muestra |
| --- | --- | --- | --- | --- |
| `listDailyCuts()` | `dbo.CORTE_DIARIO`, `dbo.usuario` | Lista cortes por fecha/usuario. | Corte, estado, usuario, caja, ventas y ganancia. | Modales de corte. |
| `calculateDailyCutTotals()` | `dbo.FACTURA`, `VENTA_*`, `PAGOS_CREDITO`, `CORTE_DIARIO` | Calcula ventas, abonos, efectivo y ganancia. | Totales de caja por usuario/fecha. | Preview y cierre de caja. |
| `createOpeningCut()` | `dbo.CORTE_DIARIO` | `INSERT` corte abierto. | Caja inicial y estado abierto. | Apertura de turno. |
| `previewDailyCut()` | No escribe; usa calculos de corte. | Calcula corte temporal. | Resumen previo de cierre. | Modal de cierre. |
| `createDailyCut()` | `dbo.CORTE_DIARIO` | Cierra corte abierto con `UPDATE` e inserta corte cerrado. | Corte final del turno. | Cierre de caja/logout. |

## Auditoria De Base De Datos

| Objeto | Ubicacion | Funcion | Datos que genera |
| --- | --- | --- | --- |
| `dbo.sp_instalar_triggers_auditoria` | `database/migrations/005_install_auditoria_triggers_sql_server.sql` | Genera triggers por tabla de usuario. | Triggers `tr_auditoria_<tabla>`. |
| `tr_auditoria_<tabla>` | SQL Server | Registra `INSERT`, `UPDATE`, `DELETE`. | Filas en `dbo.auditoria` con `dato_anterior` y `dato_nuevo`. |
| `setAuditContext()` | `server/data-access.js` | Define usuario de app para la sesion SQL. | `SESSION_CONTEXT('audit_user_id')` y `SESSION_CONTEXT('audit_user')`. |

## Regla Para Nuevas Consultas

Cuando se agregue una consulta nueva:

1. Agregar comentario encima de la funcion en `server/data-access.js`.
2. Indicar tablas/procedimientos usados.
3. Indicar datos que genera o modifica.
4. Indicar endpoint en `server/server.js` e IPC en `electron/main.js` si aplica.
5. Actualizar este documento con la pantalla donde se muestra.
