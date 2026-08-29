# Changelog Codex

## 2026-08-28

- Se implemento `YR Recovery Tool` como herramienta externa:
  - CLI `recovery/yr-recovery-tool.js` y lanzador `YR-Recovery-Tool.cmd`;
  - menu de diagnostico, reparacion segura, inicio/reinicio, logs, SQL Server, checkpoints Git y restauracion estable;
  - comando `npm run health-check`;
  - documentacion `RECOVERY.md`;
  - logs en `recovery/logs/` y metadata en `recovery/checkpoints.json`.
- Se validaron build, health-check, simulacion de fallo de compilacion, reparacion segura y checkpoint/rollback en sandbox.

- Se corrigio Facturacion para conservar `createdAt/createdBy` del catalogo ligero y volver a mostrar `NUEVO` en productos normales con menos de 45 dias.

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
