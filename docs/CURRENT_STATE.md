# Current State

## Implementado

- App Angular standalone con UI principal en `src/app/app.ts/html/css`.
- Backend Express en `server/server.js` con SQL Server en `server/data-access.js`.
- Electron con IPC expuesto por `electron/preload.js` y handlers en `electron/main.js`.
- Desarrollo de escritorio con `npm run desktop:dev`: Angular usa `ng serve` con live reload y Electron se reinicia automaticamente cuando cambian archivos de `electron/` o `server/`.
- Boton `Actualizar` del Dashboard revalida conexion, conserva la sesion local y recarga datos de la vista actual sin forzar una recarga destructiva de la ventana.
- Login contra `dbo.usuario` y signal `currentUser`.
- Facturacion parcialmente modularizada:
  - `src/app/modules/facturacion/services/facturacion-api.service.ts`
  - `server/modules/facturacion/*`
  - `GET /api/billing/products`
  - `POST /api/sales`
- Facturacion filtra productos activos y no debe vender inactivos.
- Catalogo ligero de Facturacion incluye `description` para productos normales y ofertas ensambladas, manteniendo compatibilidad con el frontend monolitico.
- Codigos armados se gestionan desde Inventario en una vista propia, se guardan en `dbo.CODIGO_ARMADO_OFERTA*`, no se mezclan como filas normales de inventario y aparecen en Facturacion solo cuando estan activos, vigentes, con componentes activos y stock disponible.
- Codigos armados soportan `IMAGEN_URL`; el campo se ingresa como nombre/ruta de imagen y se normaliza con la misma resolucion de imagenes de productos normales.
- Facturacion muestra cintas diagonales en tarjetas: `NUEVO` cyan para productos creados hace menos de 45 dias y `OFERTA` roja para codigos armados facturables.
- Registro de venta descuenta inventario/lotes y devuelve `updatedProducts`.
- Inventario activo con alta, edicion, detalle, inactivacion logica, consulta de inactivos, reactivacion, creacion de codigos armados, compra rapida, rebaja rapida y alertas de vencimiento.
- FEFO con `dbo.PRODUCTO_LOTE` y `dbo.VENTA_LOTE_DETALLE`.
- Auditoria flexible con `dbo.auditoria`, `insertAuditRecord` y triggers instalables por migracion.
- Compras, creditos, cortes/caja, caja chica, movimientos financieros, planillas/asistencia, cotizaciones, dashboard y reportes analiticos tienen endpoints y UI existentes.
- Configuracion incluye pestaña `Respaldo` para respaldos/restauracion SQL Server:
  - servicios en `server/modules/database-backup/backup.service.js`;
  - rutas HTTP `GET/PUT/POST /api/database-backups*`;
  - IPC Electron `database-backups:*`;
  - respaldos `.bak` en carpeta configurable, por defecto `database-backups/`;
  - respaldo manual, tarea automatica programada, validacion `RESTORE VERIFYONLY`, respaldo obligatorio `Pre-Restauración` antes de restaurar y retencion diferenciada.
- Herramienta externa `YR Recovery Tool` en `recovery/yr-recovery-tool.js` con lanzador `YR-Recovery-Tool.cmd`, comandos `npm run recovery` y `npm run health-check`, diagnostico frontend/backend/SQL Server/logs, reparacion segura y checkpoints Git.

## En desarrollo

- Extraccion modular pendiente del inventario monolitico hacia archivos separados.

## Pendiente

- Extraer mas modulos fuera de `App` cuando se retome la arquitectura modular progresiva.
- Evaluar mover Configuracion fuera del monolito Angular cuando continue la modularizacion.

## Problemas conocidos

- `src/app/app.ts` y `src/app/app.html` son monoliticos y concentran muchas responsabilidades.
- No hay middleware central de permisos verificado en rutas HTTP; reactivacion valida rol en su propia operacion.
- `GET /api/products` sigue devolviendo solo activos; inactivos usan `GET /api/products/inactive`.
- Hay muchos cambios sin commit en el worktree previos a esta documentacion, incluidas imagenes y archivos de servidor/frontend.
- `rg` no esta disponible en esta maquina; usar `Select-String` o instalar herramienta equivalente.
- Los cambios de frontend en desarrollo dependen de `ng serve`; los cambios de backend/Electron requieren ejecutar la app con `npm run desktop:dev` para que el watcher reinicie Electron.
- Ultima verificacion de arranque: `npm.cmd run build` compila correctamente; usar `npm.cmd` en PowerShell si `npm.ps1` esta bloqueado por ExecutionPolicy.
- Las ofertas/codigos armados que no aparecen en Facturacion deben revisarse desde Inventario > Codigos armados; la vista muestra motivo como vencida, pendiente de inicio, producto componente inactivo, sin stock u oferta desactivada.
- Facturacion mezcla ofertas usando el diagnostico completo de `listAssembledOfferCodes({ includeInactive: true })` y luego filtra solo ofertas facturables; evita que un filtro temprano por `SYSDATETIME()` o estado incompleto las oculte antes de explicar el motivo.

## No modificar sin revisar

- Flujo optimizado de Facturacion: `GET /api/billing/products` y `POST /api/sales` con `updatedProducts`.
- Filtro `p.activo = 1` en Facturacion.
- Relacion `producto.codigo` con `inventario.codigo`.
- Logica FEFO de `PRODUCTO_LOTE` y `VENTA_LOTE_DETALLE`.
- Auditoria con `setAuditContext` e `insertAuditRecord`.
- Auditoria de respaldos/restauraciones usa `createAuditHistoryRecord` con tabla logica `RESPALDO_BASE_DATOS`.
- Resolucion/cache de imagenes y miniaturas.
- Migraciones existentes en `database/migrations/`.
- `YR Recovery Tool` no debe restaurar base de datos; solo diagnostica SQL Server y muestra el ultimo `.bak`. La restauracion de BD sigue en el modulo de Backup/Restore.

## Reactivacion implementada

- Consulta HTTP: `GET /api/products/inactive?search=texto`.
- IPC Electron: `window.electronAPI.getInactiveProducts(search)`.
- Reactivacion HTTP: `PUT /api/products/:productId/reactivate`.
- IPC Electron: `window.electronAPI.reactivateInventoryProduct(payload)`.
- DTO: `server/modules/inventario/inventario.dto.js`.
- Transaccion: `reactivateInventoryProduct` en `server/data-access.js`.
- UI: boton `Productos inactivos`, ventana modal de busqueda y modal de reingreso en `src/app/app.html`.
- Stock de reingreso reemplaza `dbo.inventario.stock`; no suma al stock anterior.
- Lotes FEFO activos anteriores del producto se marcan `AGOTADO` y se crea un lote nuevo `REACT-*`.
- Movimiento: `INVENTARIO_LOG.ACCION_REALIZADA = REACTIVACION_PRODUCTO`.
- Auditoria: registra costo/precio/stock anterior y nuevo mediante `insertAuditRecord`.
