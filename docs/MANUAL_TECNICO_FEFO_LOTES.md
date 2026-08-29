# Manual tecnico: lotes, vencimientos y FEFO

Este documento describe el mantenimiento tecnico del flujo de lotes FEFO implementado en el sistema Yahweh Rohi Inventory.

FEFO significa "First Expired, First Out": el sistema descuenta primero los productos con fecha de vencimiento mas cercana.

## Objetivo

El objetivo del flujo FEFO es:

- Registrar cada compra como un lote independiente.
- Guardar fecha de vencimiento por lote cuando aplique.
- Alimentar automaticamente las alertas de productos proximos a vencer.
- Descontar ventas desde los lotes con vencimiento mas cercano.
- Mantener trazabilidad entre factura, producto, lote y cantidad vendida.
- Restaurar el mismo lote cuando una factura se anula.

## Archivos principales

- `database/migrations/012_create_fefo_lot_structure.sql`
  Crea las tablas de lotes y movimientos de venta por lote.

- `server/data-access.js`
  Contiene la logica de compras, ventas, anulaciones, reactivaciones y alertas.

- `src/app/app.ts`
  Maneja el estado del formulario de compras y envia lote/vencimiento al backend.

- `src/app/app.html`
  Muestra los campos `Lote` y `Vencimiento` en el detalle de compras.

- `src/electron-api.d.ts`
  Define los tipos usados por Electron para compras y alertas.

## Tablas nuevas

### dbo.PRODUCTO_LOTE

Guarda el inventario separado por lote.

Campos importantes:

- `ID_LOTE`: identificador interno del lote.
- `ID_PRODUCTO`: producto relacionado.
- `CODIGO_PRODUCTO`: codigo/SKU del producto.
- `NUM_LOTE`: numero de lote.
- `FECHA_INGRESO`: fecha de entrada del lote.
- `FECHA_VENCIMIENTO`: fecha de vencimiento, puede ser `NULL`.
- `CANTIDAD_INICIAL`: cantidad original ingresada al lote.
- `CANTIDAD_DISPONIBLE`: cantidad disponible actual.
- `COSTO_UNITARIO`: costo unitario del lote.
- `ID_COMPRA`: id de la compra que genero el lote.
- `TABLA_COMPRA`: tabla origen de compra, por ejemplo `dbo.COMPRA_EFECTIVO`.
- `NUM_FACT`: numero de factura de compra.
- `ESTADO`: `ACTIVO` o `AGOTADO`.
- `ORIGEN`: `COMPRA`, `MIGRACION_INVENTARIO` o `AJUSTE_STOCK_EXISTENTE`.

### dbo.VENTA_LOTE_DETALLE

Guarda la trazabilidad de que lote se uso en cada venta.

Campos importantes:

- `ID_FACT`: factura de venta.
- `TABLA_VENTA`: tabla donde se guardo la venta.
- `ID_VENTA`: id de la linea de venta.
- `ID_PRODUCTO`: producto vendido.
- `ID_LOTE`: lote descontado.
- `CANTIDAD`: cantidad descontada de ese lote.
- `ACCION`: `VENTA` o `ANULADO`.
- `USUARIO`: usuario que realizo la venta.

## Inventario inicial

El inventario existente se convirtio en lotes iniciales.

Cada producto activo con stock mayor a cero recibio un lote:

```sql
NUM_LOTE = 'INICIAL-' + codigo_producto
ORIGEN = 'MIGRACION_INVENTARIO'
FECHA_VENCIMIENTO = NULL
```

Esto permite empezar a usar FEFO sin perder el stock actual.

Los lotes iniciales no generan alertas de vencimiento porque no tienen fecha de vencimiento.

## Flujo de compra

Cuando se registra una compra:

1. El usuario selecciona proveedor, factura, fecha y productos.
2. Cada producto tiene campos editables:
   - `Lote`
   - `Vencimiento`
3. Si el usuario no escribe lote, el sistema propone uno con factura, SKU y fecha.
4. El backend inserta la compra en `COMPRA_EFECTIVO` o `COMPRA_CREDITO`.
5. El backend actualiza `dbo.inventario`.
6. El backend crea un registro en `dbo.PRODUCTO_LOTE`.

Validacion recomendada despues de una compra:

```sql
SELECT *
FROM dbo.PRODUCTO_LOTE
WHERE NUM_FACT = 'NUMERO_FACTURA_COMPRA'
ORDER BY ID_LOTE DESC;
```

## Flujo de venta

Cuando se realiza una venta:

1. El cajero factura de forma normal.
2. El backend guarda la factura en `dbo.FACTURA`.
3. El backend guarda las lineas en la tabla de venta correspondiente:
   - `dbo.VENTA_EFECTIVO`
   - `dbo.VENTA_CREDITO`
   - `dbo.VENTA_TRANSFERENCIA`
4. Por cada producto vendido, el sistema busca lotes activos con stock disponible.
5. Los lotes se ordenan asi:
   - primero lotes con fecha de vencimiento mas cercana;
   - despues lotes sin vencimiento;
   - si hay empate, el lote mas antiguo primero.
6. El sistema descuenta la cantidad desde `PRODUCTO_LOTE`.
7. El sistema registra el detalle en `VENTA_LOTE_DETALLE`.
8. El sistema descuenta el stock total visible en `dbo.inventario`.

Consulta para validar una factura:

```sql
SELECT
  vld.ID_FACT,
  vld.TABLA_VENTA,
  vld.ID_VENTA,
  p.codigo,
  p.nombre,
  pl.NUM_LOTE,
  pl.FECHA_VENCIMIENTO,
  vld.CANTIDAD,
  vld.ACCION
FROM dbo.VENTA_LOTE_DETALLE vld
INNER JOIN dbo.PRODUCTO_LOTE pl
  ON pl.ID_LOTE = vld.ID_LOTE
INNER JOIN dbo.producto p
  ON p.id_producto = vld.ID_PRODUCTO
WHERE vld.ID_FACT = 123
ORDER BY p.nombre, pl.FECHA_VENCIMIENTO;
```

## Anulacion de factura

Cuando se anula una factura:

1. El sistema valida que la factura exista.
2. Identifica la tabla de venta usada.
3. Devuelve el stock total a `dbo.inventario`.
4. Busca en `VENTA_LOTE_DETALLE` los lotes usados por esa factura.
5. Devuelve la cantidad exactamente al mismo lote.
6. Cambia `VENTA_LOTE_DETALLE.ACCION` de `VENTA` a `ANULADO`.
7. Cambia `ID_ESTADO_VENTA` a `3`.

Consulta para validar anulacion:

```sql
SELECT *
FROM dbo.VENTA_LOTE_DETALLE
WHERE ID_FACT = 123;
```

Debe mostrar `ACCION = 'ANULADO'`.

## Reactivacion de factura

Cuando se reactiva una factura anulada:

1. El sistema toma las lineas anuladas.
2. Vuelve a descontar por FEFO.
3. Crea nuevos registros en `VENTA_LOTE_DETALLE`.
4. Descuenta nuevamente `dbo.inventario`.
5. Restaura el estado de venta:
   - credito: `2`
   - efectivo o transferencia: `4`

## Alertas de vencimiento

Las alertas ya no dependen de columnas manuales en `dbo.inventario`.

Ahora se alimentan desde:

```sql
dbo.PRODUCTO_LOTE
```

Procedimiento:

```sql
EXEC dbo.sp_recalcular_productos_proximos_vencer;
```

Criterios:

- lote activo;
- cantidad disponible mayor a cero;
- fecha de vencimiento no nula;
- vencimiento entre hoy y los proximos 30 dias.

Consulta:

```sql
SELECT *
FROM dbo.PRODUCTO_PROXIMO_VENCER
ORDER BY DIAS_PARA_VENCER ASC, NOMBRE_PRODUCTO ASC;
```

## Validaciones de mantenimiento

### Comparar stock total contra lotes

Esta consulta debe devolver diferencias cercanas a cero.

```sql
SELECT
  p.id_producto,
  p.codigo,
  p.nombre,
  CAST(ISNULL(i.stock, 0) AS DECIMAL(18, 2)) AS stock_inventario,
  CAST(ISNULL(SUM(CASE WHEN l.ESTADO = 'ACTIVO' THEN l.CANTIDAD_DISPONIBLE ELSE 0 END), 0) AS DECIMAL(18, 2)) AS stock_lotes,
  CAST(
    ISNULL(i.stock, 0) -
    ISNULL(SUM(CASE WHEN l.ESTADO = 'ACTIVO' THEN l.CANTIDAD_DISPONIBLE ELSE 0 END), 0)
    AS DECIMAL(18, 2)
  ) AS diferencia
FROM dbo.producto p
INNER JOIN dbo.inventario i
  ON i.id_inventario = p.id_producto
LEFT JOIN dbo.PRODUCTO_LOTE l
  ON l.ID_PRODUCTO = p.id_producto
WHERE p.activo = 1
GROUP BY p.id_producto, p.codigo, p.nombre, i.stock
HAVING ABS(
  ISNULL(i.stock, 0) -
  ISNULL(SUM(CASE WHEN l.ESTADO = 'ACTIVO' THEN l.CANTIDAD_DISPONIBLE ELSE 0 END), 0)
) > 0.01
ORDER BY p.nombre;
```

### Ver lotes activos de un producto

```sql
SELECT
  ID_LOTE,
  NUM_LOTE,
  FECHA_INGRESO,
  FECHA_VENCIMIENTO,
  CANTIDAD_INICIAL,
  CANTIDAD_DISPONIBLE,
  COSTO_UNITARIO,
  ESTADO,
  ORIGEN
FROM dbo.PRODUCTO_LOTE
WHERE ID_PRODUCTO = 123
ORDER BY
  CASE WHEN FECHA_VENCIMIENTO IS NULL THEN 1 ELSE 0 END,
  FECHA_VENCIMIENTO ASC,
  FECHA_INGRESO ASC,
  ID_LOTE ASC;
```

### Ver productos proximos a vencer

```sql
EXEC dbo.sp_recalcular_productos_proximos_vencer;

SELECT
  CODIGO,
  NOMBRE_PRODUCTO,
  NUM_LOTE,
  STOCK,
  FECHA_VENCIMIENTO,
  DIAS_PARA_VENCER
FROM dbo.PRODUCTO_PROXIMO_VENCER
ORDER BY DIAS_PARA_VENCER ASC;
```

## Reglas tecnicas importantes

- No descontar `PRODUCTO_LOTE` manualmente sin descontar tambien `dbo.inventario`.
- No cambiar `CANTIDAD_DISPONIBLE` directamente si ya existen ventas asociadas.
- Si se corrige un lote manualmente, registrar el motivo fuera del sistema o crear una tabla de ajustes formal en una futura mejora.
- No eliminar lotes con movimientos en `VENTA_LOTE_DETALLE`.
- Para productos sin fecha de vencimiento, dejar `FECHA_VENCIMIENTO = NULL`.
- Para productos perecederos, siempre capturar vencimiento al registrar compra.
- Si se agrega una nueva tabla de venta, tambien debe agregarse al resolvedor de tablas en `server/data-access.js`.

## Puntos de codigo a revisar en mantenimiento

Funciones clave en `server/data-access.js`:

- `ensureFefoLotObjects`
- `insertPurchaseLot`
- `allocateSaleLotsFefo`
- `restoreInvoiceLotsForAnnulment`
- `registerPurchase`
- `registerSale`
- `annulInvoice`
- `activateInvoice`
- `ensureExpiringProductsObjects`
- `refreshExpiringProducts`
- `listExpiringProducts`

Funciones clave en `src/app/app.ts`:

- `updatePurchaseDraftLineLot`
- `updatePurchaseDraftLineExpiry`
- `withDefaultPurchaseLot`
- `buildDefaultPurchaseLot`
- `savePurchaseHistory`

## Pruebas recomendadas despues de cambios

Ejecutar:

```bash
node --check server/data-access.js
npm.cmd run build
```

Validar en base de datos:

```sql
SELECT
  (SELECT COUNT(*) FROM dbo.PRODUCTO_LOTE) AS lotes,
  (SELECT CAST(ISNULL(SUM(CANTIDAD_DISPONIBLE), 0) AS DECIMAL(18,2)) FROM dbo.PRODUCTO_LOTE WHERE ESTADO = 'ACTIVO') AS stock_lotes,
  (SELECT CAST(ISNULL(SUM(stock), 0) AS DECIMAL(18,2)) FROM dbo.inventario i INNER JOIN dbo.producto p ON p.id_producto = i.id_inventario WHERE p.activo = 1) AS stock_inventario,
  (SELECT COUNT(*) FROM dbo.VENTA_LOTE_DETALLE) AS movimientos_lote;
```

## Flujo de prueba manual

1. Registrar una compra de un producto con dos lotes y vencimientos diferentes.
2. Vender una cantidad menor o igual al primer lote.
3. Confirmar que se desconto el lote con vencimiento mas cercano.
4. Vender una cantidad mayor al primer lote.
5. Confirmar que el sistema distribuyo el descuento entre dos lotes.
6. Anular la factura.
7. Confirmar que las cantidades volvieron a los mismos lotes.
8. Ejecutar alertas de vencimiento.
9. Confirmar que aparecen los lotes con vencimiento dentro de 30 dias.

## Mejoras futuras recomendadas

- Crear modulo visual de Kardex por lote.
- Agregar historial de ajustes manuales de lote.
- Permitir editar vencimiento/lote solo con permiso administrativo.
- Mostrar lote sugerido en facturacion para usuarios tecnicos.
- Agregar reporte de lotes proximos a vencer por proveedor.
- Agregar politica de bloqueo para vender productos vencidos.
