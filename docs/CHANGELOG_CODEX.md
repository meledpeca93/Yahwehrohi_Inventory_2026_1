# Changelog Codex

## 2026-09-10

- Se ajusto el modal `Agregar marca` para hacerlo mas compacto/cuadrado, aumentar el texto del selector de usuarios, convertir los botones de entrada/salida en controles mas altos y mostrar una notificacion temporal tipo Facturacion al guardar o rechazar una marca.

## 2026-09-05

- Se implemento soporte de multiples codigos de barra por producto con `dbo.PRODUCTO_CODIGO_BARRA` y migracion de respaldo `database/migrations/023_create_product_barcodes.sql`.
- Inventario conserva su tabla principal y agrega boton/modal `Codigos de barra` para listar, agregar, marcar principal y activar/desactivar codigos asociados.
- Facturacion ahora puede encontrar productos por codigo principal o alternativo activo, manteniendo una sola linea por `productId` y descuento de stock por producto.
- Se agregaron rutas HTTP e IPC Electron para consultar/agregar/actualizar codigos de barra de producto.
- Se corrigio el foco despues de cerrar modales de Inventario relacionados con productos/codigos para que los buscadores de Inventario y Facturacion vuelvan a permitir seleccionar y escribir.
- Se evito que el autofoco de Facturacion acumule temporizadores y robe foco despues de abrir varias veces `Productos inactivos`; ahora respeta clics recientes sobre inputs/selects/botones.
- Verificacion: `node --check server/data-access.js`, `node --check server/server.js`, `node --check electron/main.js` y `npm.cmd run build` exitosos; el build mantiene advertencias existentes de presupuesto CSS y CommonJS de `tesseract.js`.

## 2026-09-04

- Se ajusto Facturacion para mantener el foco en el buscador de productos durante el flujo de venta con escaner de codigos de barra, recuperandolo al entrar al modulo, agregar productos, cerrar modales principales y terminar/intentar una venta.
- Se corrigio el foco del buscador de Facturacion para permitir escritura manual: ya no se recupera foco en cada `blur` ni se selecciona el texto cuando el input ya esta activo.
- Se hicieron colapsables los grupos laterales `Planillas` y `Finanzas` para aprovechar mejor el espacio del menu.
- El modal `Agregar marca` ahora incluye selector de usuario, carga Seydi por defecto cuando existe y permite registrar entrada/salida para el usuario seleccionado.
- El boton de cierre del modal de marcas se ajusto como control superior derecho tipo ventana, con estado hover rojo.
- Se corrigio el modal de marcas para mostrar primero y seleccionar por defecto al usuario logeado; Seydi queda solo como respaldo si el usuario actual no aparece en asistencia.
- Se anclo el boton cerrar del modal de marcas a la esquina superior derecha con posicion absoluta.
- Se agrego panel de usuario en el menu lateral con avatar circular, nombre autenticado y submenu para `Agregar marca` y `Cerrar sesion`.
- `Agregar marca` abre un modal compacto con `Agregar entrada` y `Agregar salida`; ambas opciones guardan marcas del usuario autenticado en `dbo.ASISTENCIA`.
- `saveAttendanceMark` ahora acepta marcas parciales, conserva la marca existente del dia y mantiene el calculo de horas cuando ya existen entrada y salida validas.
- Verificacion: `npm.cmd run build` exitoso con advertencias existentes de presupuesto CSS y CommonJS de `tesseract.js`.

## 2026-09-03

- Se mejoro la tabla de auditoria del modulo Historico: filas con alto uniforme, columnas de stock anterior/nuevo, fondo visual por tipo de accion y modal de detalle completo al hacer doble clic sobre una fila.
- Se agrego barra visible de opciones en la tabla de Historico, siguiendo la referencia: filtros por accion, tabla, fecha, usuario y busqueda por nombre/texto, selector `Mostrar`, paginacion inferior y orden ascendente/descendente desde todas las columnas.
- Se documento `Historico` como modulo propio en `docs/MODULES.md`, separandolo de Reportes/Dashboard para futuros diagnosticos de carga y auditoria.
- Se optimizo la prevalidacion de venta en Facturacion: antes de facturar ya no recarga todo el catalogo ligero, sino que consulta solo la disponibilidad de los productos/ofertas del carrito mediante `POST /api/billing/products/availability` e IPC `billing:products-availability`.
- Se optimizo la resolucion de imagenes para Facturacion e Inventario con cache invalidable de `src/img`, evitando reescanear cientos de archivos por producto/oferta y manteniendo deteccion de imagenes nuevas durante la sesion.
- Se corrigio la resolucion de imagenes de productos para volver a leer `src/img` al momento de resolver el archivo, evitando cerrar y abrir la app cuando se agrega una imagen nueva por nombre y extension.

## 2026-08-30

- Se agrego modo web separado `npm run web:dev` para que Angular/Vite escuche en todas las interfaces activas (`0.0.0.0:4200`) usando el proxy `/api` hacia `127.0.0.1:3000`, sin cambiar el flujo de escritorio.

- Se corrigio el orden de descuento FEFO en ventas: ahora `registerSale` asegura cobertura de lotes antes de descontar el stock maestro, evitando rechazos cuando inventario si tiene unidades. El mensaje de cero stock queda reservado para stock real en 0.
- Se ajusto Facturacion para permitir vender las ultimas unidades disponibles (`stock = cantidad`) y dejar el producto en cero despues de la venta; la restriccion aplica solo si el stock inicial ya es cero o si la cantidad supera el disponible.

## 2026-08-29

- Se reorganizo el menu lateral: Asistencia queda como submodulo de Planillas, y Costos, Caja chica, Finanzas y Ventas y Rentabilidad quedan como submodulos de Finanzas.
- Se corrigio el flujo de Facturacion para revalidar stock antes de invocar `sales:create`, refrescar el catalogo tras errores de stock insuficiente y ajustar el carrito con el stock real.

## 2026-08-28

- Se igualo el fondo del grafico de Creditos al estilo oscuro con gradiente del grafico de Facturas.

- Se implemento `YR Recovery Tool` como herramienta externa:
  - CLI `recovery/yr-recovery-tool.js` y lanzador `YR-Recovery-Tool.cmd`;
  - menu de diagnostico, reparacion segura, inicio/reinicio, logs, SQL Server, checkpoints Git y restauracion estable;
  - comando `npm run health-check`;
  - documentacion `RECOVERY.md`;
  - logs en `recovery/logs/` y metadata en `recovery/checkpoints.json`.
- Se validaron build, health-check, simulacion de fallo de compilacion, reparacion segura y checkpoint/rollback en sandbox.

- Se corrigio Facturacion para conservar `createdAt/createdBy` del catalogo ligero y volver a mostrar `NUEVO` en productos normales con menos de 45 dias.

- Se corrigio el arranque de desarrollo para evitar errores temporales de proxy `ECONNREFUSED` en `/api/*`:
  - `proxy.conf.json` ahora apunta a `http://127.0.0.1:3000`;
  - `npm run desktop:dev` levanta o reutiliza el API HTTP y espera `/api/health` antes de abrir Electron.

- Se corrigio la imagen grande del modal Ver detalle de Inventario: `app-product-image` ahora respeta `fullSize` tambien en dimensiones del host y deja de limitar esa vista a miniatura.

- Se restauro la cinta diagonal `NUEVO` en cyan para productos con menos de 45 dias en Facturacion, reutilizando `isNewProduct`.
- Se agrego cinta diagonal roja `OFERTA` para codigos armados activos/facturables en tarjetas de Facturacion y miniaturas de la vista de codigos armados en Inventario.
- Se agrego imagen a codigos armados:
  - campo `Imagen` en el modal de crear/editar codigo armado;
  - columna `IMAGEN_URL` en `dbo.CODIGO_ARMADO_OFERTA`;
  - normalizacion de rutas con la misma logica de imagenes de productos;
  - visualizacion de imagen o placeholder en tarjetas de Facturacion.
- Se verifico `npm.cmd run build` y `node --check` en archivos backend tocados.

- Se corrigio el bloqueo de arranque causado por errores TypeScript en Facturacion/ofertas ensambladas:
  - se agrego `createEmptyAssembledOfferDraft()` en `src/app/app.ts`;
  - `GET /api/billing/products` vuelve a exponer `description` en servidor, DTO y servicio Angular;
  - se verifico `npm.cmd run build` exitosamente.

- Se agrego en Inventario el boton `Crear codigo armado` y un modal para guardar codigos armados desde productos activos.
- Los botones principales de la cabecera de Inventario ahora usan el mismo estilo visual de `Agregar producto`.
- Se agregaron firmas Electron para `getAssembledOffers` y `createAssembledOffer`; se verifico `npm.cmd run build`.

- Se completo el flujo de codigos armados:
  - Inventario ahora abre `Codigos armados` con listado, busqueda por codigo/nombre/componente, estados y motivo de no visibilidad;
  - el formulario de creacion/edicion usa modal de busqueda de productos por codigo y nombre, evitando duplicados;
  - detalle muestra componentes, regalias, stock por producto y maximo posible de ofertas;
  - Facturacion muestra distintivo `OFERTA` y permite buscar ofertas por componentes;
  - se agrego `PUT /api/assembled-offers/:offerId` e IPC `assembled-offers:update` usando las mismas tablas existentes.
- Diagnostico: antes no se veian en Inventario porque no son productos reales y no existia vista propia; en Facturacion solo aparecen si pasan filtros de activo, vigencia, componentes activos y stock.
- Se ajusto `getBillingProducts()` para mezclar ofertas desde el listado diagnosticado completo y filtrar despues por `ACTIVO`, stock y componentes activos, evitando ocultarlas por el filtro SQL temprano de vigencia.

- Se implemento modulo de Respaldo y Restauracion de base de datos en Configuracion:
  - pestaña `Respaldo` en `src/app/app.html`;
  - señales/metodos Angular para listar, configurar, generar, validar y restaurar respaldos;
  - servicio separado `server/modules/database-backup/backup.service.js`;
  - router HTTP `server/modules/database-backup/backup.routes.js`;
  - IPC Electron `database-backups:*`;
  - export de configuracion SQL en `server/db.js`.
- El respaldo usa `BACKUP DATABASE`, nombres con fecha/hora y evita sobrescribir con sufijo incremental.
- La restauracion valida archivo autorizado, integridad SQL Server y compatibilidad; exige doble confirmacion en UI y genera respaldo `Pre-Restauración` antes de ejecutar `RESTORE DATABASE`.
- La retencion conserva respaldos normales segun configuracion y mantiene retencion especial para respaldos `Pre-Restauración`.
- Se probaron respaldo manual real, ejecucion automatica real, validacion de `.bak`, respaldo de emergencia, restauracion real y reconexion SQL Server.

- Se ajusto Facturacion para recargar `loadTodayInvoices()` despues de cada venta normal cuando la pagina de Facturacion esta activa, manteniendo sincronizadas las tarjetas `Efectivo hoy` y `Credito hoy` con el modal `Ventas del dia`.

- Se corrigio el mecanismo de actualizacion en desarrollo:
  - `npm run desktop:dev` ahora inicia Angular con `proxy.conf.json` y reinicia Electron al detectar cambios en `electron/` o `server/`;
  - se agrego `npm run start:api:dev` con `node --watch` para desarrollo del backend HTTP;
  - el handler `app:update-system` ya no recarga la ventana desde IPC, solo valida ventana activa y conexion SQL Server;
  - el boton `Actualizar` conserva la sesion, recarga datos de la vista actual y muestra errores recuperables.
- Se ajustaron presupuestos de build Angular al tamano real del monolito actual para permitir compilacion de produccion.

- Se implemento consulta y reactivacion de productos inactivos en Inventario:
  - `GET /api/products/inactive`;
  - `PUT /api/products/:productId/reactivate`;
  - handlers Electron `products:inactive-list` y `products:reactivate`;
  - DTO `server/modules/inventario/inventario.dto.js`;
  - panel `Productos inactivos` y modal de reactivacion en Angular.
- La reactivacion conserva el mismo `id_producto` y codigo, valida costo/precio/stock mayores que 0, exige rol de administracion de Inventario, actualiza costo/precio/stock, registra `REACTIVACION_PRODUCTO` en `INVENTARIO_LOG`, registra auditoria y crea lote FEFO nuevo.
- El alta de productos ahora distingue codigo activo vs codigo inactivo; si el codigo pertenece a un inactivo, el frontend ofrece reactivar y el backend devuelve mensaje especifico.
- Se ajusto la consulta de productos inactivos para abrirse como ventana modal sobre Inventario en lugar de mostrarse como panel incrustado.

- Se documento la arquitectura modular progresiva existente en `docs/ARQUITECTURA_MODULAR_PROGRESIVA.md`.
- Se verifico que Facturacion ya tiene una primera separacion modular:
  - servicio Angular `FacturacionApiService`;
  - router/controlador/servicio/repositorio/DTO en `server/modules/facturacion`;
  - catalogo ligero `GET /api/billing/products`;
  - venta `POST /api/sales` con `updatedProducts`.
- Se confirmo que el catalogo normal de Inventario sigue en `GET /api/products` y solo devuelve productos activos.
- Se analizo el flujo solicitado de reactivacion de productos inactivos:
  - estado logico actual: `dbo.producto.activo`;
  - inactivos no aparecen en Facturacion;
  - falta vista/busqueda de inactivos;
  - falta endpoint/IPC/DTO de reactivacion;
  - la reactivacion debe reutilizar `INVENTARIO_LOG`, auditoria y FEFO.
- Se crearon documentos operativos para continuidad entre chats:
  - `AGENTS.md`
  - `docs/ARCHITECTURE.md`
  - `docs/MODULES.md`
  - `docs/DATABASE.md`
  - `docs/BUSINESS_RULES.md`
  - `docs/PERFORMANCE.md`
  - `docs/CURRENT_STATE.md`
  - `docs/CHANGELOG_CODEX.md`
