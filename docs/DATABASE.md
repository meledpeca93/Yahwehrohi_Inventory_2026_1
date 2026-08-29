# Database

Este archivo registra solo estructuras comprobadas en codigo o migraciones.

## Conexion

- SQL Server mediante `mssql`.
- Acceso central desde `server/data-access.js`.
- Transacciones con `new sql.Transaction(pool)`.

## Producto e inventario

- `dbo.producto`
  - Campos usados: `id_producto`, `codigo`, `nombre`, `descripcion`, `imagen_url`, `activo`, `creado_por`, `creado_en`, `actualizado_por`, `actualizado_en`.
  - `activo = 1` indica producto disponible para inventario normal y facturacion.
  - `activo = 0` indica inactivacion logica.
- `dbo.inventario`
  - Campos usados: `id_inventario`, `id_pd`, `codigo`, `precio_costo`, `precio_venta`, `precio_mayoreo`, `unidad_medida`, `stock`, `stock_minimo`, `stock_maximo`, `categoria`, `proveedor`, `NUM_LOTE`, `permite_decimal`, `creado_por`, `creado_en`, `actualizado_por`, `actualizado_en`.
  - Listados principales hacen join `inventario.codigo = producto.codigo`.
  - La migracion FEFO inicial usa `i.id_inventario = p.id_producto` para migrar lotes iniciales.

## Stock y FEFO

- `dbo.PRODUCTO_LOTE`
  - Creada en `ensureFefoLotObjects` y `database/migrations/012_create_fefo_lot_structure.sql`.
  - Campos: `ID_LOTE`, `ID_PRODUCTO`, `CODIGO_PRODUCTO`, `NUM_LOTE`, `FECHA_INGRESO`, `FECHA_VENCIMIENTO`, `CANTIDAD_INICIAL`, `CANTIDAD_DISPONIBLE`, `COSTO_UNITARIO`, `ID_COMPRA`, `TABLA_COMPRA`, `NUM_FACT`, `ESTADO`, `ORIGEN`, `CREADO_POR`, `CREADO_EN`, `ACTUALIZADO_EN`.
  - Estados comprobados: `ACTIVO`, `AGOTADO`.
  - Ventas descuentan por FEFO usando lotes activos con cantidad disponible.
- `dbo.VENTA_LOTE_DETALLE`
  - Campos: `ID_VENTA_LOTE`, `ID_FACT`, `TABLA_VENTA`, `ID_VENTA`, `ID_PRODUCTO`, `ID_LOTE`, `CANTIDAD`, `ACCION`, `FECHA_HORA`, `USUARIO`.
  - Se usa para rastrear descuento/restauracion por factura.
- `dbo.PRODUCTO_PROXIMO_VENCER`
  - Tabla auxiliar para alertas de vencimiento.
  - Recalculada por `dbo.sp_recalcular_productos_proximos_vencer`.

## Movimientos y auditoria

- `dbo.INVENTARIO_LOG`
  - Insertado por `insertInventoryLogRecord`.
  - Campos usados: `ACCION_REALIZADA`, `ID_PD`, `CANT_PD`, `STOCK_ANT`, `STOCK_ACT`, `PRECIO_COSTO`, `ID_USER`, `FECHA_HORA`, `ID_CLIENTE`, `ID_TP`.
  - Acciones comprobadas: `ALTA_PRODUCTO`, `AJUSTE_INVENTARIO`, `REACTIVACION_PRODUCTO`, acciones `REBAJA_*`.
- `dbo.auditoria`
  - Estructura flexible detectada dinamicamente por `getAuditColumns`.
  - `insertAuditRecord` escribe columnas existentes comunes: tabla, accion, fecha, usuario, id_usuario, clave, dato_anterior, dato_nuevo.
  - Migracion `005_install_auditoria_triggers_sql_server.sql` crea procedimiento `dbo.sp_instalar_triggers_auditoria` para instalar triggers de auditoria en tablas de usuario.

## Ventas

- Tablas usadas:
  - `dbo.FACTURA`
  - `dbo.VENTA_EFECTIVO`
  - `dbo.VENTA_CREDITO`
  - `dbo.VENTA_TRANSFERENCIA`
  - `dbo.ESTADO`
- Campos frecuentes en ventas: `ID_VENTA`, `ID_VTR`, `ID_FACT`, `ID_PD`, `CANT_PD`, `PRECIO_COSTO`, `PRECIO_VENTA`, `UTILIDAD`, `USUARIO`, `FECHA_HORA`, `ID_ESTADO_VENTA`, `ID_CLIENTE`, `ID_TP`.
- `ID_ESTADO_VENTA = 3` representa linea/factura anulada en queries revisadas.
- `registerSale` actualiza inventario, descuenta lotes FEFO y devuelve `updatedProducts`.

## Codigos armados / ofertas

- `dbo.CODIGO_ARMADO_OFERTA`
  - Creada o ajustada por `ensureOfferObjects` y `database/migrations/022_create_assembled_offer_codes.sql`.
  - Campos usados: `ID_OFERTA`, `CODIGO`, `NOMBRE`, `DESCRIPCION`, `IMAGEN_URL`, `PRECIO_OFERTA`, `FECHA_INICIO`, `FECHA_FIN`, `ACTIVO`, `CREADO_POR`, `CREADO_EN`, `ACTUALIZADO_EN`.
  - `IMAGEN_URL` guarda la misma referencia de imagen usada por productos normales, normalizada a `assets/img/...` cuando corresponde.
- `dbo.CODIGO_ARMADO_OFERTA_DETALLE`
  - Componentes reales de la oferta: `ID_DETALLE`, `ID_OFERTA`, `ID_PRODUCTO`, `CANTIDAD`, `ES_REGALIA`, `PRECIO_REFERENCIA`, `CREADO_EN`.
- `dbo.VENTA_OFERTA_DETALLE`
  - Rastro de componentes descontados por venta de oferta; no representa stock propio de la oferta.

## Compras

- Tablas usadas:
  - `dbo.COMPRA_EFECTIVO`
  - `dbo.COMPRA_CREDITO`
- Campos frecuentes: `ID_CEFECT`, `ID_CCD`, `ID_PD`, `CANT_PD`, `PRECIO_COSTO`, `ID_USUARIO`, `ID_PROVEEDOR`, `NUM_FACT`, `FECHA_HORA`, `ID_ESTADO_COMPRA`.
- Compras alimentan `dbo.inventario.stock` y lotes en `dbo.PRODUCTO_LOTE`.
- `annulPurchase` existe para anulacion.

## Reactivacion de productos

- No crea registros nuevos en `dbo.producto`.
- Actualiza el mismo `id_producto` en `dbo.producto` a `activo = 1`.
- Actualiza `dbo.inventario` del mismo producto: `stock`, `precio_costo`, `precio_venta`, `actualizado_por`, `actualizado_en`.
- Cierra lotes FEFO activos previos del producto con `ESTADO = 'AGOTADO'` y `CANTIDAD_DISPONIBLE = 0`.
- Inserta un lote nuevo en `dbo.PRODUCTO_LOTE` con `TABLA_COMPRA = 'REACTIVACION_PRODUCTO'`.
- Inserta movimiento en `dbo.INVENTARIO_LOG` con `ACCION_REALIZADA = 'REACTIVACION_PRODUCTO'`.
- Inserta auditoria con valores anteriores y nuevos de stock, costo y precio.

## Creditos

- Creditos consultan ventas a credito y cliente.
- `dbo.CREDITO_ABONO_DETALLE`
  - Creada por `ensureCreditPaymentAllocationsTable`.
  - Usada para distribuir abonos.
- Migracion `018_add_credit_payment_method.sql` agrega soporte de forma de pago de abonos.
- Funciones relacionadas: `listCredits`, `registerCreditPayment`, `recalculateCustomerCreditBalance`.

## Cotizaciones

- `dbo.COTIZACION`
  - Campos: `ID_COTIZACION`, `NUM_COTIZACION`, `ID_CLIENTE`, `CLIENTE_NOMBRE`, `ID_TP`, `SUBTOTAL`, `UTILIDAD_ESTIMADA`, `ESTADO`, `ID_FACT`, `USUARIO`, `ID_USUARIO`, `NOTA`, `FECHA_HORA`, `ACTUALIZADO_EN`.
- `dbo.COTIZACION_DETALLE`
  - Campos: `ID_COTIZACION_DETALLE`, `ID_COTIZACION`, `ID_PRODUCTO`, `CODIGO_PRODUCTO`, `PRODUCTO_NOMBRE`, `CANTIDAD`, `PRECIO_COSTO`, `PRECIO_VENTA`, `UTILIDAD`, `TOTAL_LINEA`, `FECHA_HORA`.

## Respaldo y restauracion SQL Server

- No agrega tablas nuevas al esquema de negocio.
- Usa la base configurada en `server/db.js` mediante variables `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT` y `DB_TRUST_SERVER_CERTIFICATE`.
- Generacion: `BACKUP DATABASE [DB_NAME] TO DISK = @backup_path WITH INIT, CHECKSUM, STATS = 10`.
- Validacion: `RESTORE VERIFYONLY FROM DISK = @backup_path WITH CHECKSUM` y `RESTORE HEADERONLY`.
- Restauracion: conecta a `master`, cierra el pool actual, cambia la base a `SINGLE_USER WITH ROLLBACK IMMEDIATE`, ejecuta `RESTORE DATABASE [DB_NAME] FROM DISK = @backup_path WITH REPLACE, CHECKSUM`, vuelve a `MULTI_USER` y reconecta.
- Configuracion e historial operativo se guardan fuera de SQL Server en `server/modules/database-backup/storage/`.
- Archivos `.bak` se guardan en la ruta configurable, por defecto `database-backups/`.

## Planilla y caja

- `dbo.PLANILLA` se crea o ajusta desde `ensurePayrollTableSupportsDecimals`.
- `dbo.COSTO_OPERATIVO` se crea desde `ensureOperationalCostsTable`.
- `dbo.MOVIMIENTO_FINANCIERO` se crea desde `ensureFinancialMovementsTable`.
- `dbo.CAJA_CHICA_DIARIA` se crea desde `ensurePettyCashTable`.
- `dbo.CORTE_DIARIO` se usa para cortes; `ensureDailyCutShiftColumns` agrega `FECHA_APERTURA` y `FECHA_CIERRE` si faltan.
