# Business Rules

## Facturacion

- Solo se deben vender productos activos (`dbo.producto.activo = 1`).
- El catalogo de Facturacion usa `getBillingProducts`, que filtra `p.activo = 1`.
- Los codigos armados facturables se agregan al catalogo desde `dbo.CODIGO_ARMADO_OFERTA` y sus componentes reales; no se crean registros nuevos en `dbo.producto` ni `dbo.inventario`.
- Un producto normal puede encontrarse en Facturacion por su `producto.codigo` principal o por cualquier codigo activo en `dbo.PRODUCTO_CODIGO_BARRA`.
- Si se escanean varios codigos del mismo producto, el carrito incrementa la misma linea por `productId`; precio, costo, imagen, stock y descuento salen siempre del producto original.
- Un codigo armado solo aparece en Facturacion si esta activo, dentro de vigencia, sin componentes inactivos y con disponibilidad mayor que cero.
- Registrar una venta descuenta `dbo.inventario.stock`.
- Vender un codigo armado descuenta stock de cada producto componente, incluidas regalias, y registra trazabilidad en `dbo.VENTA_OFERTA_DETALLE`.
- Si FEFO esta disponible, la venta descuenta lotes desde `dbo.PRODUCTO_LOTE` por vencimiento/ingreso.
- Antes de descontar `dbo.inventario.stock`, `registerSale` debe llamar `ensureProductLotCoverage` para que FEFO cubra el stock maestro vigente.
- Al registrar venta, el backend devuelve `updatedProducts` para actualizar solo el stock afectado en pantalla.
- No recargar `GET /api/products` despues de cada venta.
- Antes de registrar una venta, el frontend debe revalidar `GET /api/billing/products` para evitar enviar carritos con stock vencido por ventas o ajustes recientes.
- Si SQL Server rechaza una venta por stock insuficiente, el frontend debe refrescar el catalogo de Facturacion y ajustar/eliminar lineas del carrito segun el stock real.
- Vender exactamente el stock disponible esta permitido, aunque el resultado de la venta deje el producto en 0.
- El mensaje de articulo en cero debe mostrarse solo cuando el stock real antes de la venta sea 0; si hay stock positivo pero la cantidad lo supera, el mensaje debe pedir ajustar cantidad.
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
- El boton `Codigos de barra` de cada fila de Inventario abre un modal independiente para listar codigos, agregar alternativos, marcar principal y activar/desactivar alternativos sin agregar columnas a la tabla principal.
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
- `dbo.PRODUCTO_CODIGO_BARRA` permite varios codigos por producto, pero cada `CODIGO_BARRA` debe ser unico en todo el sistema.
- Debe existir un solo codigo principal activo por producto; el principal se mantiene sincronizado con `producto.codigo` para compatibilidad.
- No se puede desactivar el codigo principal; primero se debe marcar otro codigo activo como principal.
- Los codigos armados no pueden reutilizar codigos de producto ni codigos alternativos registrados.
- Creacion rechaza codigo activo con mensaje especifico.
- Si el codigo existe inactivo, el formulario ofrece abrir el flujo de reactivacion.
- No se deben duplicar codigos para resolver reingresos historicos.

## Compras

- Compra normal y compra rapida incrementan inventario.
- Compra rapida crea proveedor/factura interna segun funciones `ensureQuickInventorySupplier` y `getNextQuickInventoryInvoiceNumber`.
- Compras alimentan lotes FEFO con `insertPurchaseLot`.
- Anulacion de compras existe en `annulPurchase`.

## Creditos

- La ficha de clientes a crédito muestra saldos pendientes calculados por el servicio existente; excluye clientes sin saldo mayor a 0,005. Búsqueda visual no reduce el saldo total del cliente ni el de la cartera.
- El filtro «Sin abonos > 2 meses» es por cliente: último abono positivo del historial completo; si no existen pagos, fecha de la primera factura pendiente. Se comparan dos meses calendario, ajustando el día al último válido del mes. Historial fallido, fecha inválida o importes abonados sin comprobante fechado se consideran desconocidos, nunca ausencia de abonos.
- No se calcula mora sin vencimiento pactado. El contrato actual no ofrece vencimientos ni fechas de último abono por cada factura (el histórico puede agrupar varias); se muestra antigüedad por factura y actividad por cliente explícitamente.
- Preparar abono abre el formulario existente; la asignación sigue siendo automática a las facturas más antiguas. No hay selección manual nueva ni guardado al abrir el formulario.

- Ventas a credito impactan saldos consultados por `listCredits`.
- Abonos se registran con `registerCreditPayment`.
- Abonos pueden tener forma de pago normalizada.
- Saldos de cliente se recalculan con `recalculateCustomerCreditBalance`.

## Asistencia y planilla

- Desde el menu de usuario del lateral se puede registrar una marca diaria para el usuario seleccionado en el modal.
- El selector de usuario del modal usa Seydi como valor inicial si existe en usuarios activos de asistencia; si no existe, usa el usuario autenticado o el primer usuario disponible.
- `Agregar entrada` registra solo `HORA_ENTRADA` cuando el usuario seleccionado aun no tiene entrada del dia.
- `Agregar salida` requiere una entrada previa del mismo dia para el usuario seleccionado, debe ser mayor que la entrada y completa `HORA_SALIDA`.
- Un dia solo queda disponible para calculo de horas cuando `dbo.ASISTENCIA` tiene entrada y salida validas; `VW_ASISTENCIA_HORAS` excluye marcas incompletas.
- El submenu de usuario conserva el flujo existente de `Cerrar sesion`; solo mueve el acceso visual al cierre de sesion.

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

## Consulta analítica de Facturas (26/09/2026)

- La fecha de referencia inicia en el día local de apertura de la aplicación. Día, semana (lunes a domingo), mes y Todo delimitan los resultados; fecha, búsqueda, pago y estado se aplican antes de paginar.
- Indicadores, gráfica y distribución por pago usan todos los resultados filtrados. Monto activo y crédito facturado excluyen facturas anuladas según el estado existente. Crédito facturado no equivale a deuda pendiente.
- La gráfica agrupa por hora en Día, por fecha en Semana/Mes y por mes en Todo. No ubica facturas sin fecha válida; estas sí pueden consultarse en Todo.
- La exportación superior incluye todos los resultados filtrados, incluso anuladas si están visibles; su alcance se indica en el reporte. Exportación individual y por grupos conservan los flujos existentes.
- La vista plana pagina facturas; la agrupada pagina días. El resumen mensual sigue siendo histórico e independiente de los filtros superiores. Ambas tablas ofrecen 10/25/50/100 registros por página; la mensual pagina meses de forma independiente, sin alterar los totales ni la variación contra el mes anterior.
- Seleccionar una factura carga una vista previa de hasta cinco líneas; el detalle completo conserva todas las líneas. La anulación/activación mantiene sus validaciones y efectos existentes.

- Facturas permite filtrar clientes por ID (o nombre si no existe ID). El filtro afecta los indicadores, la gráfica y la exportación de resultados. La ordenación ascendente/descendente se aplica antes de paginar; en grupos se mantiene la agrupación. Ordenar meses no cambia la comparación contra el mes cronológico anterior.

## Borradores de compras (interfaz)

- Recepción rápida es la vista inicial; los estados Por preparar/Por recibir/Por revisar son organización manual de borradores locales, no estados contables ni confirmación de envío al proveedor.
- Guardar, cambiar de vista y retomar pendientes no escriben inventario. Confirmar ingreso utiliza el registro de compra existente; se bloquea el doble clic mientras guarda.
- Borradores separados por usuario en localStorage de este navegador. Guardar conserva líneas, proveedor, factura, fecha, forma de pago, costos, lotes y vencimientos; no conserva el archivo/foto OCR. Se informa si el guardado falla y se mantiene el formulario.
- No se implementa saldo de unidades pendientes contra un pedido ni recepciones parciales enlazadas: el formulario registra únicamente lo recibido. No hay sincronización de borradores entre equipos.

- Programar un pedido exige proveedor, productos y fecha prevista; esta fecha es independiente de la fecha de compra. Sigue siendo un borrador local sin envío al proveedor ni ingreso de inventario.
- La ficha de compra ingresada utiliza los documentos agrupados del historial real, no los valores del borrador. Los documentos anulados se distinguen como tales. El detalle expone los campos disponibles en el contrato de compras; no inventa adjuntos ni lotes ausentes del histórico.

## Usuarios y permisos (05/10/2026)

Administrador gestiona usuarios y tiene acceso completo. Operador inicia con gestión de módulos excepto Usuarios y lectura en Configuración; Consulta inicia con lectura excepto Usuarios. El administrador puede ajustar cada módulo por usuario a sin acceso, lectura o gestión; Usuarios sigue reservado al perfil Administrador. Cambiar de perfil en el formulario restablece sus valores base. Baja lógica conserva historial; puede reactivarse mediante edición. No se permite quitar el propio acceso administrativo ni dejar sin administrador activo. Cambiar contraseña o desactivar revoca sesiones; otros cambios se comprueban en la siguiente petición. Sesiones duran 12 horas; contraseña nueva entre 8 y 128 caracteres. Las restricciones anteriores por rol de ciertas operaciones se mantienen.

## Restauración de sesión y apertura de caja (086)

- Restaurar una sesión de acceso no equivale a restaurar un turno de caja. Tanto el login como la restauración consultan los cortes del usuario con permiso de escritura en Facturación.
- Si no existe un corte en estado Abierto (1), se solicita el dinero inicial; un turno abierto se conserva aunque atraviese medianoche. No se cierran turnos ni se crean cortes en cero automáticamente.
- Tras guardar el corte de salida, se elimina la sesión local y se espera la finalización de la solicitud de logout antes de cerrar Electron. La sesión se limpia localmente incluso si falla la revocación remota.
