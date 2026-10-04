# Current State

## Implementado

- Compras: Recepción rápida predeterminada, Seguimiento por proveedor como segunda vista y acceso al historial anterior. Reutiliza productos, costos, lotes, OCR de imágenes y registro existente; confirmación separada antes de ingresar. Borradores locales explícitos por usuario/navegador, no compartidos, con etapas manuales y recuperación. Registro 039; resumen real, paneles contraíbles e iconos en registro 040. Fecha prevista local, estados explícitos y ficha de compras ingresadas con PDF en registro 043. Pedidos compartidos, recepciones parciales vinculadas y PDF OCR siguen pendientes.

- Créditos: vista centrada en clientes con búsqueda, prioridad por saldo/tiempo sin abonar, ficha de facturas pendientes y abonos, PDF y preparación del abono existente. Historial completo por cliente con concurrencia máxima de cuatro y protección ante respuestas anteriores; fallos visibles como desconocidos. No hay vencimientos en el contrato actual: antigüedad y ausencia de pagos no se presentan como mora. Registro 036.

- Facturas: implementado el concepto analítico aprobado (registro 028). Indicadores y gráfica compactos comparten filtros de fecha, período, texto, cliente, pago y estado; listado plano inicial con páginas 10/25/50/100, agrupación opcional por día/pago y panel lateral con detalle, PDF y anulación/activación existentes. Histórico mensual al final, contraído inicialmente. El crédito facturado no representa saldo pendiente. Sin cambios de backend ni BD.

- Detalle de factura modernizado con controles de tabla y estilos de Ventas del día; no modifica líneas ni totales de ventas registradas.

- Ventas del día: búsqueda global, filtros pago/estado, ordenamiento por columna, selección con exportación CSV y paginación 10/25/50 sobre datos existentes. Edición en línea pendiente de definir campos; sin endpoints nuevos.

- Pantalla cliente: estilos claros de Inventory 2.0 aplicados a la ventana independiente; conserva datos y sincronización, con total verde suave y vuelto oscuro.

- Facturación: columna Ítem consecutiva y detalle paginado, cinco filas iniciales y selector 5/10/15/30/45/60/100; navegación centrada y sin scroll vertical interno. Totales calculados sobre toda la factura, páginas limitadas al eliminar y posición independiente por factura.

- Categorías: desplegable blanco con texto gris oscuro, diez opciones por página, navegación y selección que conserva el filtro; cierre al seleccionar, clic fuera o Escape.

- Facturacion: catálogo con tamaño de página seleccionable (15/30/45/60/100), navegación centrada y saltos a primera/última página.

- Facturacion: botón Contraer factura/Mostrar factura en Más acciones permite ampliar el catálogo al ancho disponible con ocho columnas en escritorio; formulario oculto sin desmontarlo, conservando los datos de la operación.

- Facturacion: resumen de cobro compacto a la derecha (Subtotal, Recibido, Vuelto), montos rapidos en cuadrícula 2 x 2 a la izquierda y color oscuro uniforme incluso con vuelto positivo. Validado con datos simulados en escritorio/movil; sin cambios de calculo.

- Facturacion: detalle compacto con encabezados de columnas compartidos, precio ampliado y accion eliminar separada; controles y calculos conservados.

- Facturacion: resumen superior colapsable sin recarga de datos; buscador principal de 54 px; Ventas del dia visible y cuatro opciones en Mas acciones (Pantalla cliente, Movimiento, Catalogo, Corte del dia), con cierre por seleccion, clic fuera o Escape. Se conserva la logica de foco y escaner.
- Registro de cambios de Inventory 2.0 en `cambios.md`: entradas 001 (Login) y 002 (Facturacion), con alcance, archivos, pruebas y pendientes de aprobacion. Mantener numeracion consecutiva para futuros cambios.
- Base visual 2.0 ahora clara por instruccion del usuario (2026-09-21), aplicada a Login y Facturacion. `data-theme="yr-light"` se usa solo al mostrar Facturacion; los demas modulos recuperan el tema guardado, sin cambiar preferencias. Revisados contraste, alertas, estado seleccionado del pago, etiquetas de precio/cantidad/subtotal e indicador de guardado; logica TS intacta en esta revision.
- Acciones superiores del formulario de Facturacion compactadas en una sola fila de ocho iconos SVG, con tooltips hover/focus, nombres accesibles y estados de pago/guardado preservados.
- Modernizacion visual 2.0 de Login y Facturacion en `version-2.0`: base opt-in `src/app/yr-ui.css`, tokens `--yr-*`, superficies claras, SVG lineales, foco accesible, movimiento reducido y adaptacion responsive. Login permite mostrar/ocultar contrasena; Facturacion destaca el total existente, conserva controles, cintas y eventos. El menu movil solo recibe ajustes de layout al mostrar Facturacion. Sin dependencias nuevas ni cambios de backend/BD/reglas. Detalles y validacion en `docs/UI_MODERNIZATION_2_0.md`.
- App Angular standalone con UI principal en `src/app/app.ts/html/css`.
- Backend Express en `server/server.js` con SQL Server en `server/data-access.js`.
- Electron con IPC expuesto por `electron/preload.js` y handlers en `electron/main.js`.
- Desarrollo de escritorio con `npm run desktop:dev`: asegura que el API HTTP responda en `127.0.0.1:3000`, Angular usa `ng serve` con live reload y Electron se reinicia automaticamente cuando cambian archivos de `electron/` o `server/`.
- Modo web de desarrollo separado con `npm run web:dev`: Angular/Vite escucha en todas las interfaces activas (`0.0.0.0:4200`) y usa el proxy `/api` hacia el backend HTTP local en `127.0.0.1:3000`.
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
- La resolucion de imagenes en `src/img` usa cache invalidable en HTTP y Electron, evitando escaneos repetidos en Facturacion/Inventario y permitiendo agregar una imagen por nombre y extension sin cerrar la aplicacion.
- Facturacion muestra cintas diagonales en tarjetas: `NUEVO` cyan para productos creados hace menos de 45 dias y `OFERTA` roja para codigos armados facturables.
- Facturacion mantiene el foco operativo en el buscador de productos para uso con escaner de codigos de barra al entrar al modulo, agregar productos al carrito, cerrar modales principales y terminar/intentar una venta, sin robar foco cuando el usuario esta usando otro control de formulario.
- Productos normales soportan multiples codigos de barra mediante `dbo.PRODUCTO_CODIGO_BARRA`, conservando `dbo.producto.codigo` como codigo principal compatible con `dbo.inventario.codigo`.
- Inventario mantiene la tabla principal sin columnas nuevas y agrega un boton por fila `Codigos de barra` que abre un modal para listar, agregar, activar/desactivar alternativos y marcar un codigo como principal.
- Facturacion busca por codigo principal o alternativo activo; todos los codigos asociados al mismo producto incrementan la misma linea de carrito por `productId` y el stock se descuenta por producto.
- Registro de venta descuenta inventario/lotes y devuelve `updatedProducts`.
- Las tarjetas principales de Facturacion que dependen de ventas del dia se refrescan despues de cada venta registrada mientras Facturacion esta visible, usando la misma carga de `GET /api/invoices/today` que alimenta el modal `Ventas del dia`.
- Antes de enviar una venta, Facturacion revalida solo los productos del carrito con una consulta liviana de disponibilidad y ajusta el carrito si algun producto quedo sin stock o con cantidad mayor al disponible; vender exactamente el stock disponible esta permitido y el mensaje de cero stock solo se muestra cuando el stock real es 0.
- Registro de venta asegura cobertura FEFO antes de descontar `dbo.inventario.stock`, evitando rechazar ventas validas cuando el stock maestro existe pero faltan lotes de ajuste.
- Inventario activo con alta, edicion, detalle, inactivacion logica, consulta de inactivos, reactivacion, creacion de codigos armados, compra rapida, rebaja rapida y alertas de vencimiento.
- FEFO con `dbo.PRODUCTO_LOTE` y `dbo.VENTA_LOTE_DETALLE`.
- Auditoria flexible con `dbo.auditoria`, `insertAuditRecord` y triggers instalables por migracion.
- Compras, creditos, cortes/caja, caja chica, movimientos financieros, planillas/asistencia, cotizaciones, dashboard, reportes analiticos e Historico tienen endpoints y UI existentes.
- El menu lateral muestra un boton circular de usuario con el nombre autenticado; desde su submenu se accede a `Cerrar sesion` y a `Agregar marca`.
- Los grupos laterales `Planillas` y `Finanzas` son colapsables para ahorrar espacio vertical.
- `Agregar marca` abre un modal compacto y mas cuadrado, con selector de usuario de texto grande, botones altos para entrada/salida y notificacion temporal tipo Facturacion; conserva la leyenda inferior de resultado y registra entrada o salida del dia en `dbo.ASISTENCIA`.
- Historico muestra la tabla de auditoria como resumen digerible: filas de alto uniforme, fecha/hora alineadas, columna de accion con fondo por tipo de movimiento, columnas de stock anterior/nuevo, modal de detalle completo al hacer doble clic sobre una fila, barra visible de filtros tipo tabla y paginacion con selector de cantidad visible.
- Menu lateral organiza Asistencia como submodulo de Planillas, y Costos, Caja chica, Finanzas y Ventas y Rentabilidad como submodulos de Finanzas.
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
- Los cambios de frontend en desarrollo dependen de `ng serve`; `npm run desktop:dev` levanta o reutiliza el API HTTP antes de abrir Electron, y los cambios de backend/Electron reinician Electron con el watcher. Para acceso web desde otros equipos usar `npm run web:dev` y mantener el API HTTP activo con `npm run start:api`.
- Ultima verificacion de arranque: `npm.cmd run build` compila correctamente; usar `npm.cmd` en PowerShell si `npm.ps1` esta bloqueado por ExecutionPolicy.
- Las ofertas/codigos armados que no aparecen en Facturacion deben revisarse desde Inventario > Codigos armados; la vista muestra motivo como vencida, pendiente de inicio, producto componente inactivo, sin stock u oferta desactivada.
- Facturacion mezcla ofertas usando el diagnostico completo de `listAssembledOfferCodes({ includeInactive: true })` y luego filtra solo ofertas facturables; evita que un filtro temprano por `SYSDATETIME()` o estado incompleto las oculte antes de explicar el motivo.
- Historico es modulo propio para auditoria/movimientos; no clasificar sus problemas de carga como Reportes o Dashboard.

## No modificar sin revisar

- Flujo optimizado de Facturacion: `GET /api/billing/products` y `POST /api/sales` con `updatedProducts`.
- Filtro `p.activo = 1` en Facturacion.
- Relacion `producto.codigo` con `inventario.codigo`.
- Sincronizacion del codigo principal entre `producto.codigo`, `inventario.codigo` y `PRODUCTO_CODIGO_BARRA`.
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

### 22/09/2026 — Inventario UI 2.0

Inventario, Kardex agotados y modales relacionados usan el tema claro de facturación mediante estilos acotados en `yr-ui.css`. Tablas principales con búsqueda reactiva, ordenamiento, páginas 10/25/50/100, selección y CSV; resultados temporales. Inactivación con diálogo nativo estilizado. Formularios y servicios de negocio conservados. Ver registro 006 de `cambios.md`. Build correcto con advertencias de presupuesto y Tesseract.

### 22/09/2026 — Formulario de producto

Alta/edición reorganizada según propuesta visual aprobada: miniatura compacta, tres grupos de campos, fila de precios y pie Cancelar/Guardar. Estilos acotados a `.yr-product-editor`, sin cambios TS/backend ni eventos de negocio. Registro 007 en `cambios.md`.

### 22/09/2026 — Resumen contraíble y selección de inventario

Tarjetas de inventario contraíbles desde el título, con estado independiente y contenido conservado. Tabla principal con selector en primera columna estrecha y Acción al final; subtítulo eliminado. Plantilla y TypeScript validados; revisión visual pendiente. Registro 006 en `cambios.md`.

### 22/09/2026 — Filtros y altura de filas de inventario

Barra principal usa todo el ancho, con filtros de ancho acotado y buscador doble. Tres iconos permiten elegir altura Compacta, Normal o Amplia; estado local inicial Normal. Plantilla y TypeScript validados; pendiente revisión visual.

### 22/09/2026 — Productos agotados alineado con Inventario

Productos agotados replica la presentación compacta de Inventario: tarjetas contraíbles, buscador de 432 px, tres alturas, selección inicial, Código a la izquierda, títulos centrados y recuadros solo numéricos. Acciones y datos conservados. Plantilla y TypeScript validados; revisión visual pendiente.

### 22/09/2026 — Siete tablas de Inventario unificadas

Inventario, agotados, inactivos, códigos armados, componentes, selector de productos y códigos de barra comparten estilos, selección inicial, código a la izquierda, cabeceras centradas, acciones con iconos y tres alturas. Tablas auxiliares con búsqueda, ordenamiento, selección/CSV y paginación 10/25/50/100; estado independiente y reinicio por contexto. Resumen de componentes contraíble. Validados compilador Angular y controles con datos simulados; pendiente revisión visual. Registro 006 de `cambios.md`.

### 22/09/2026 — Estándar de títulos

Títulos y cabeceras en estilo oración (mayúscula inicial), conservando nombres propios y siglas. Regla común en yr-ui.css e instrucción persistente en AGENTS.md. Registro 008 de cambios.md.

### 23/09/2026 — Modales de Facturación unificados

Ocho tablas con presentación común; seis incorporan búsqueda, ordenamiento, selección/CSV y paginación mediante `ModalTableState`. Movimientos agrupa sus nueve campos; Catálogo tiene vista previa filtrable/paginada con exportación completa y bloqueo de doble solicitud; Corte muestra historial y resumen a ancho completo. Barras de filtros y densidad en una línea, con desplazamiento de controles en pantallas estrechas. Compilación de desarrollo, Angular y siete pruebas correctos; revisión visual final pendiente. Ver registro 009 de `cambios.md`.

### 26/09/2026 — Facturas: concepto analítico aplicado

Registro 028: filtros compartidos, lista paginada y detalle lateral adaptado a móvil; gráfico compacto y resumen mensual al final. Doce pruebas y build de desarrollo correctos. Revisión aislada en Chrome con datos ficticios sin desbordamiento móvil ni errores de ejecución. Producción bloqueada por presupuesto global (2,12 MB frente a 2 MB); la suite general antigua espera una consulta inicial de clientes que ya no se ejecuta. Evidencias en `output/ui-concepts/facturas-implementado-*.png` y archivos de validación asociados.

### 26/09/2026 — Recuperación de carga de Facturas

El error «Error al obtener facturas» se reprodujo como HTTP 500, con `/api/health` fallido y conexión SQL `ESOCKET`: Docker local estaba detenido. Tras iniciar Docker, el contenedor existente de SQL Server arrancó y ambas rutas devolvieron HTTP 200 (5.132 facturas). La interfaz diferencia error de carga de resultados vacíos, ofrece Actualizar/Reintentar y vuelve a cargar al cambiar fecha/período después de un fallo. El listado ya no depende del resumen global ni de la consulta mensual. Siete pruebas de Facturas correctas. Registro 029.

### 26/09/2026 — Controles de Facturas alineados con Inventario

Registro 030: controles de contraer con iconos, filtros/agrupación/altura en una fila, paginación centrada y selector Mostrar a la izquierda en ambas tablas. Facturación mensual tiene páginas y altura independientes. Se retiran textos de resultados de las barras y se ajusta el gráfico por pago a las proporciones del concepto. Build de desarrollo y revisión en Chrome aislado correctos, incluidas alineación, paginación mensual y vista móvil.

### 26/09/2026 — Filtro Cliente y ordenamiento

Facturas incorpora filtro por cliente y ordenamiento por columnas en ambas tablas. Los indicadores y PDF respetan Cliente; la ordenación mensual es independiente del cálculo de variaciones. Buscador reducido otro 25%. Ver registro 033.
