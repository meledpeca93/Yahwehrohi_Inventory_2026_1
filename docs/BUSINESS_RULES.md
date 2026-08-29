# Business Rules

## Facturacion

- Solo se deben vender productos activos (`dbo.producto.activo = 1`).
- El catalogo de Facturacion usa `getBillingProducts`, que filtra `p.activo = 1`.
- Los codigos armados facturables se agregan al catalogo desde `dbo.CODIGO_ARMADO_OFERTA` y sus componentes reales; no se crean registros nuevos en `dbo.producto` ni `dbo.inventario`.
- Un codigo armado solo aparece en Facturacion si esta activo, dentro de vigencia, sin componentes inactivos y con disponibilidad mayor que cero.
- Registrar una venta descuenta `dbo.inventario.stock`.
- Vender un codigo armado descuenta stock de cada producto componente, incluidas regalias, y registra trazabilidad en `dbo.VENTA_OFERTA_DETALLE`.
- Si FEFO esta disponible, la venta descuenta lotes desde `dbo.PRODUCTO_LOTE` por vencimiento/ingreso.
- Al registrar venta, el backend devuelve `updatedProducts` para actualizar solo el stock afectado en pantalla.
- No recargar `GET /api/products` despues de cada venta.
- Facturas anuladas usan `ID_ESTADO_VENTA = 3` y restauran stock/lotes.

## Inventario

- El listado normal de inventario usa `GET /api/products` y devuelve activos.
- Los codigos armados se consultan desde una vista propia de Inventario usando `GET /api/assembled-offers`; no aparecen como productos normales porque no tienen stock propio.
- La disponibilidad de un codigo armado es el minimo entero posible segun stock/cantidad requerida de cada componente.
- La consulta de inactivos usa `GET /api/products/inactive` y pertenece solo a Inventario.
- Inactivar producto usa `PUT /api/products/:productId/status` con `active: false`.
- Inactivar no elimina registros de `dbo.producto`, `dbo.inventario`, ventas, compras, lotes ni auditoria.
- Tras inactivar, el frontend remueve el producto del signal `products`.
- Edicion de inventario actualiza codigo, nombre, imagen, categoria, stock, min/max, costo, precio, unidad y bandera decimal.
- Edicion registra auditoria y `INVENTARIO_LOG` como `AJUSTE_INVENTARIO`.

## Productos activos/inactivos

- Estado logico comprobado: `dbo.producto.activo`.
- Activo: aparece en inventario normal y facturacion.
- Inactivo: no aparece en inventario normal ni facturacion.
- Inactivos se pueden consultar y buscar por codigo, nombre o categoria desde Inventario.

## Reactivacion de productos

- Solicitud funcional actual: reactivar sin crear otro producto, usando el mismo `id_producto` y `codigo`.
- Debe pedir nuevo costo, nuevo precio de venta y stock de reingreso mayor que 0.
- Debe registrar movimiento de inventario y preservar historial.
- Requiere usuario autenticado con rol que contenga `admin`, `administrador` o `inventario`.
- Stock de reingreso reemplaza el stock anterior; no se suma.
- Lotes FEFO activos anteriores se cierran como `AGOTADO` y se crea lote nuevo de reactivacion.
- Movimiento requerido: `REACTIVACION_PRODUCTO` en `INVENTARIO_LOG`.

## Stock

- `dbo.inventario.stock` es el stock maestro usado por catalogos.
- `dbo.PRODUCTO_LOTE.CANTIDAD_DISPONIBLE` soporta FEFO.
- `ensureProductLotCoverage` crea lote de ajuste si hay stock maestro sin cobertura FEFO.
- Rebaja rapida valida cantidad mayor que 0 y no permite rebajar mas que el stock actual.
- Compra rapida valida cantidad mayor que 0 y costo mayor que 0.

## Costos y precios

- `precio_costo` y `precio_venta` viven en `dbo.inventario`.
- El frontend calcula precio por porcentaje de utilidad cuando se edita `profitPercentage`.
- Al editar precio se registra alerta/auditoria manual `CAMBIO_PRECIO` si el precio cambio.
- Valores numericos de producto se validan como numeros finitos y no negativos en creacion/edicion normal.

## Codigos de producto

- `codigo` identifica producto y conecta `dbo.producto` con `dbo.inventario`.
- Creacion rechaza codigo activo con mensaje especifico.
- Si el codigo existe inactivo, el formulario ofrece abrir el flujo de reactivacion.
- No se deben duplicar codigos para resolver reingresos historicos.

## Compras

- Compra normal y compra rapida incrementan inventario.
- Compra rapida crea proveedor/factura interna segun funciones `ensureQuickInventorySupplier` y `getNextQuickInventoryInvoiceNumber`.
- Compras alimentan lotes FEFO con `insertPurchaseLot`.
- Anulacion de compras existe en `annulPurchase`.

## Creditos

- Ventas a credito impactan saldos consultados por `listCredits`.
- Abonos se registran con `registerCreditPayment`.
- Abonos pueden tener forma de pago normalizada.
- Saldos de cliente se recalculan con `recalculateCustomerCreditBalance`.

## Auditoria

- Las escrituras importantes pasan usuario actual cuando esta disponible.
- `setAuditContext` usa `SESSION_CONTEXT` para que triggers SQL puedan identificar usuario.
- Si existe `dbo.auditoria`, `insertAuditRecord` inserta registros adaptandose a columnas disponibles.

## Respaldo y restauracion de base de datos

- Solo usuarios con rol que contenga `admin` o `administrador` pueden generar respaldos, configurar respaldo automatico o restaurar la base.
- Los respaldos se guardan como `.bak` dentro del directorio autorizado configurado; no se permite restaurar archivos fuera de ese directorio.
- El nombre de respaldo usa fecha y hora; si el archivo ya existe, se agrega sufijo incremental para no sobrescribir.
- Antes de restaurar, el sistema valida existencia, acceso, tamano, integridad con `RESTORE VERIFYONLY` y compatibilidad del nombre de base.
- Toda restauracion requiere doble confirmacion en la interfaz.
- Antes de ejecutar `RESTORE DATABASE`, se debe crear un respaldo `Pre-Restauración` de la base actual.
- Si falla el respaldo `Pre-Restauración`, la restauracion se cancela sin modificar la base actual.
- Si la restauracion falla despues de iniciar, se conserva el respaldo `Pre-Restauración`, se registra el error y no se reintenta automaticamente.
- La retencion limpia respaldos normales antiguos segun `maxBackups`; los respaldos `Pre-Restauración` tienen retencion especial y se conservan al menos los ultimos configurados por el backend.
