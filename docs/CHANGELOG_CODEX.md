# Changelog Codex

## 2026-09-22

- Detalle de factura: tema claro y tabla con búsqueda, estado, ordenamiento, selección y paginación 10/25/50; conserva PDF, anulación y totales. Cambio 005.

- Ventas del día: filtros con etiquetas internas, sin Actualizar ni fila permanente de resultados; leyenda temporal inferior de 3,5 s y selección contextual.

- Confirmación de anulación con diálogo nativo estilizado, datos de factura, Cancelar/Anular, carga y errores; se conserva la operación de backend.

- Ventas del día: tabla clara con búsqueda, filtros, ordenamiento, selección/CSV y paginación 10/25/50. Datos y operaciones existentes conservados; edición en línea pendiente de precisar campos. Cambio 004.

## 2026-09-21

- Pantalla cliente: columnas alineadas, resumen con Recibido, bienvenida e iniciales ante imágenes fallidas. Mejora visual del cambio 003.

- Pantalla cliente: encabezado compacto, líneas sin SKU y resaltado temporal del producto agregado; actualizado cambio 003.

- Pantalla cliente: tema claro coherente con Facturación, tarjetas y totales renovados, responsive y movimiento reducido; datos y actualización intactos. Cambio 003.

- Facturación: columna Ítem consecutiva y detalle paginado, cinco filas iniciales y selector 5/10/15/30/45/60/100; navegación centrada y sin scroll vertical interno. Totales calculados sobre toda la factura, páginas limitadas al eliminar y posición independiente por factura.

- Categorías: desplegable blanco con texto gris oscuro, diez opciones por página, navegación y selección que conserva el filtro; cierre al seleccionar, clic fuera o Escape.

- Facturacion: selector de tamaño de página 15/30/45/60/100 y navegación centrada con primera/última, reinicio de página al cambiar tamaño.

- Facturacion: control de contracción en Más acciones; catálogo expandido con ocho columnas en escritorio y adaptación conservada en tablet/móvil.

- Facturacion: formulario contraíble desde el catálogo para ampliar productos al ancho disponible; estado de factura conservado, botón accesible para restaurarlo.

- Facturacion: montos rapidos en cuadrícula lateral y resumen compacto a la derecha; colores y tipografia de Recibido/Vuelto unificados con Subtotal, incluido vuelto positivo.

- Facturacion: resumen de cobro vertical sin utilidad estimada visible; montos rapidos debajo de Vuelto, alineados a la derecha. Sin cambios de calculo.

- Facturacion: corregido contraste de iconos en pestañas inactivas y centrado del encabezado Cantidad. Actualizado cambio 002.

- Facturacion: numero visible antes del icono en cada pestaña de factura abierta; sin cambios funcionales.

- Facturacion: pestañas de facturas abiertas con icono y numero en tooltip/nombre accesible, conservando seleccion y cierre. Registro 002 actualizado.

- Facturacion: encabezados comunes para el detalle, campo de precio ampliado y mayor separacion de columnas/eliminar; sin etiquetas repetidas ni cambios de logica. Actualizado cambio 002.

- Facturacion: restauradas dimensiones de los iconos de acción y redistribuido el espacio de la barra a favor del nombre del cliente, con acciones agrupadas a la derecha.

- Facturacion: líneas del carrito en una sola fila compacta, con nombre completo en tooltip y controles funcionales conservados; actualizado cambio 002.

- Facturacion: Cliente/Proveedor y número de factura integrados en la barra de acciones; eliminada la fila superior, conservando cotización activa y manejadores existentes. Actualizado cambio 002.
- Facturacion: selector con texto «Categoría: [selección actual]», manteniendo valores y lógica del filtro.

- Facturacion: barra de filtros sin etiquetas visibles, controles centrados verticalmente y nombres accesibles conservados; sin cambios funcionales.

- Facturacion: tres ajustes UX limitados al encabezado/catalogo: resumen colapsable con transicion de 220 ms, buscador mas prominente y acciones secundarias en desplegable nativo accesible. Metodos operativos, tarjetas y panel de factura intactos; actualizado cambio 002 en `cambios.md`.
- Facturacion: estrella de favorito activo en color `#E02D09`, sin cambiar su comportamiento. Documentado en el cambio 002.
- Facturacion: stock de las tarjetas presentado sin fondo verde, como texto neutro; indicador de margen y datos sin cambios. Actualizado el registro 002 de `cambios.md`.
- Facturacion: retirado SKU visible de tarjetas; cuadrícula de cuatro columnas en escritorio y dos en pantallas pequeñas, conservando búsqueda por código y escáner. Documentado como actualización del cambio 002 en `cambios.md`.

- Base clara para Inventory 2.0 en Login y Facturacion: paleta semantica y sombras suaves, navegacion del POS clara, colores legibles de alertas/cintas y modales. El tema guardado sigue aplicandose a los otros modulos.
- Auditoria visual: corregida prioridad CSS del metodo de pago seleccionado; indicador de guardado para el boton de cotizacion; etiquetas Precio L/Cant./Subtotal; asociacion explicita del label de contrasena; icono de busqueda visible al enfocar. Se conservan la fila de ocho iconos, tooltips, eventos, IDs, bindings y metodos TS.
- Compilacion y pruebas con datos simulados de carrito, cantidades, facturas, escaner Enter, modal, responsive y movimiento reducido; sin ventas reales, cambios de BD ni dependencias nuevas.

## 2026-09-20

- Facturacion: nueva factura, formas de pago, CSV, cotizaciones, guardar y limpiar comparten una sola fila compacta de iconos SVG con tooltip y nombre accesible; se conservan eventos y disabled/loading. Compilacion correcta.
- Primera etapa visual YahwehRohi Inventory 2.0: Login con composicion propia, campos con SVG y visibilidad de contrasena; Facturacion con paneles oscuros, buscador pill, productos, controles de cantidades, facturas abiertas, total destacado y modales renovados. Base CSS opt-in reutilizable, responsive, foco visible y movimiento reducido.
- Se conservan eventos, referencias, IDs y bindings de formularios anteriores; no se modificaron autenticacion, calculos, endpoints, stock, BD ni documentos. Sin paquetes nuevos ni operaciones Git de escritura.
- `npm run build` correcto; continúan advertencias anteriores de presupuesto de `app.css` y CommonJS de Tesseract. Pruebas de navegador aisladas con datos simulados; alcance en `docs/UI_MODERNIZATION_2_0.md`.

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

### 22/09/2026 — Inventario UI 2.0

Inventario, Kardex agotados y modales relacionados usan el tema claro de facturación mediante estilos acotados en `yr-ui.css`. Tablas principales con búsqueda reactiva, ordenamiento, páginas 10/25/50/100, selección y CSV; resultados temporales. Inactivación con diálogo nativo estilizado. Formularios y servicios de negocio conservados. Ver registro 006 de `cambios.md`. Build correcto con advertencias de presupuesto y Tesseract.

### 22/09/2026 — Formulario de producto

Alta/edición reorganizada según propuesta visual aprobada: miniatura compacta, tres grupos de campos, fila de precios y pie Cancelar/Guardar. Estilos acotados a `.yr-product-editor`, sin cambios TS/backend ni eventos de negocio. Registro 007 en `cambios.md`.

### 22/09/2026 — Limpieza visual de tabla de inventario

Código, Lote, Categoría, Vencimiento y Estado sin cápsulas ni fondos; conservados recuadros de Cantidad, Mínimo, Costo y Precio final. CSS acotado a la tabla principal. Registro 006 actualizado en `cambios.md`. Build no confirmado: dos intentos finalizaron con código 134 sin diagnóstico. Pendiente revisión visual del usuario.

### 22/09/2026 — Colores del texto de vencimiento

Restaurados los colores previos de Vencimiento en la tabla principal: neutro, ámbar y rojo según su estado; fondo transparente y sin borde. Solo CSS, sin cambios de reglas. Registro 006 actualizado. Validación de clases y precedencia; revisión visual pendiente.

### 22/09/2026 — Columnas y alineación de inventario

Retirada columna Lote de la tabla principal, códigos alineados a la derecha y encabezados centrados. Colspan ajustado a diez. Parser de Angular sin errores y estructura de diez columnas verificada; pendiente revisión visual. Actualizado registro 006 de `cambios.md`.

### 22/09/2026 — Código a la izquierda y acciones al final

Tabla principal de inventario: Código alineado a la izquierda y Acción como última columna, con encabezados centrados. Controles y eventos conservados. Plantilla Angular y orden de diez columnas verificados; pendiente revisión visual. Registro 006 actualizado.

### 22/09/2026 — Tarjetas contraíbles y columna de selección

Inventario incorpora resumen contraíble con control accesible, columna inicial estrecha para seleccionar y Acción al final. Retirado subtítulo de la tabla. Parser Angular, once columnas y TypeScript verificados; pendiente revisión visual. Registro 006 actualizado.

### 22/09/2026 — Encabezado de inventario compacto

Eliminados antetítulo y descripción del módulo. Separación vertical reducida a 12 px y grid alineado al inicio para evitar espacio sobrante, incluyendo resumen contraído. Plantilla Angular validada; revisión visual pendiente. Registro 006 actualizado.

### 22/09/2026 — Buscador ampliado y tabla sin título redundante

Eliminado título Gestión principal y espacio superior de filtros; duplicada base flexible del buscador (150 a 300 px). Plantilla Angular validada; revisión visual pendiente. Registro 006 actualizado.

### 22/09/2026 — Filtros acotados y tres alturas de fila

Corregido crecimiento de Vencimiento y aprovechado ancho de la barra. Agregados iconos Compacta/Normal/Amplia con estado accesible y estilos limitados a la tabla principal. Parser Angular y TypeScript correctos; revisión visual pendiente. Registro 006 actualizado.

### 22/09/2026 — Buscador de inventario 35% más ancho

Base flexible del buscador ampliada de 320 a 432 px. Proporción y alcance CSS revisados; pendiente revisión visual. Registro 006 actualizado.

### 22/09/2026 — Título de inventario

Título del módulo actualizado a «Control de Inventario». Texto verificado y registro 006 actualizado.

### 22/09/2026 — Retirada del filtro Lotes

Eliminados selector Lotes y lógica asociada de la tabla de inventario. Plantilla Angular y TypeScript validados. Registro 006 actualizado.

### 22/09/2026 — Productos agotados alineado con Inventario

Aplicados a Productos agotados los ajustes visuales de Inventario: encabezado compacto, resumen contraíble, buscador ampliado, tres alturas y tabla limpia con selección separada. Conservados controles existentes. Parser Angular, diez columnas y TypeScript validados; revisión visual pendiente. Registro 006 actualizado.

### 22/09/2026 — Iconos de acciones y título de agotados

Título actualizado a «Producto Agotados»; Reponer e Inventario usan iconos con etiquetas accesibles y tooltip. Eventos conservados y plantilla Angular validada. Registro 006 actualizado.

### 22/09/2026 — Unificación de tablas de Inventario

Siete tablas comparten presentación y controles de búsqueda, densidad, selección/CSV y paginación. Códigos de barra, componentes y selector reciben controles locales; acciones conservan permisos y manejadores, ahora con iconos. Compilador Angular correcto; estructura, búsqueda, ordenamiento, paginación, selección y CSV probados con datos simulados. Sin operaciones reales. Pendiente revisión visual. Registro 006 actualizado.

### 22/09/2026 — Modales de tablas sin scroll interno

Ampliado ancho de cinco modales de Inventario, eliminados mínimos rígidos de tablas y habilitado texto multilínea. Vista de registros con etiquetas en pantallas pequeñas; scroll vertical reservado al modal cuando es necesario. Angular y comprobaciones de estructura/CSS correctos; pendiente revisión visual. Registro 006 actualizado.

### 22/09/2026 — Acciones horizontales en Códigos armados

Botones Ver detalle y Editar uno al lado del otro, con separación de 6 px. Ajuste CSS acotado a esa tabla; registro 006 actualizado.

### 22/09/2026 — Capitalización uniforme de títulos

Títulos de módulos y tablas en estilo oración, conservando siglas y nombres propios; anulada transformación automática a mayúsculas. Criterio incorporado a AGENTS.md y registro 008. Pendiente revisión visual.

### 23/09/2026 — Modales de Facturación y barras en una línea

Unificados estilos y controles de ocho tablas y ventanas relacionadas. Reorganizados Movimientos, Catálogo PDF y Corte del día; preservadas operaciones existentes. Corregidas cuadrículas heredadas que separaban los botones de altura de los filtros. Nueva utilidad de presentación con siete pruebas; compilación de desarrollo y Angular correctos. Pendiente revisión visual integrada por bloqueo automático de navegador (límite de uso). Registro 009 actualizado; alineación pendiente de Códigos armados completada en registro 006.
### 25/09/2026 — Facturas con estándar visual 2.0

Facturas usa ahora el tema claro y compacto de Facturación e Inventario. Se conservaron agrupaciones, exportación y anulación; las tablas no tienen scroll interno y añaden tres alturas de filas. Validado con compilación Angular y revisión de formato; pendiente revisión visual integrada.

### 25/09/2026 — Correcciones de lectura en Facturas

El resumen superior se puede contraer. Controles, identidad del usuario y gráfico se ajustaron para evitar solapamientos y mostrar leyendas y ejes con contraste suficiente en tema claro. Compilación Angular y revisión de formato correctas; pendiente revisión visual integrada.

### 25/09/2026 — Validación reforzada de Facturas

El resumen usa un control textual y se oculta completamente al contraerse. La gráfica actualiza sus colores claros aun después de una recarga en caliente, y Facturación mensual incorpora un resumen del período más reciente.

### 25/09/2026 — Análisis de Facturas

Se añadieron filtros por texto, pago y estado al listado de facturas. Facturación mensual muestra indicadores del período reciente y variación frente al mes anterior, sin modificar registros ni cálculos de ventas.

### 25/09/2026 — Iconos Lucide en Facturas

Las acciones principales del módulo usan iconografía Lucide con etiquetas accesibles: búsqueda, limpiar, exportar, detalle, PDF y anular/reactivar. Los flujos existentes se mantienen.

### 26/09/2026 — Concepto analítico de Facturas implementado

Se aplicó el concepto aprobado: resumen y gráfica compactos, filtros sincronizados por fecha/período, lista plana paginada, agrupación opcional y detalle lateral con protección frente a respuestas tardías. El histórico mensual pasa al final y empieza contraído. Se preservan PDF, detalle completo y anulación/activación. Ver registro 028 de `cambios.md` y evidencias en `output/ui-concepts/`.

### 26/09/2026 — Carga de Facturas y recuperación de conexión

Diagnosticado Docker/SQL Server local detenido; conexión y listado recuperados sin reiniciar Electron. Añadidos Actualizar/Reintentar, reintento al cambiar fecha tras un error y mensaje de datos no disponibles en lugar de indicadores en cero. Carga principal independiente del histórico y del resumen global; siete pruebas de Facturas correctas.

### 26/09/2026 — Controles de las tablas de Facturas

Iconos para contraer, filtros alineados en una fila y paginación como Inventario en listado y tabla mensual. Se incorpora altura/paginación mensual independiente y se compacta el gráfico por pago con barras en línea. Registro 030.

### 26/09/2026 — Buscador y selector de meses de Facturas

Buscador reducido un 20% y etiqueta Meses a la izquierda del selector numérico, como Mostrar. Ajustes de presentación, sin cambios de filtros ni datos. Registro 031.

### 26/09/2026 — Tipografía de Facturas

Se retira la segunda línea bajo el cliente en Facturas emitidas y se normaliza el peso del texto mensual para mantener la jerarquía del listado principal. Registro 032.

### 26/09/2026 — Cliente y ordenamiento en Facturas

Filtro Cliente integrado con resultados e indicadores; buscador otro 25% más corto. Orden ascendente/descendente por encabezados en listado y tabla mensual, aplicado antes de paginar y preservando las variaciones históricas. Registro 033.

### 26/09/2026 — Ancho del detalle de Facturas

Panel lateral ampliado a 420 px; Cliente ocupa 140 px y permite nombres en varias líneas. Conserva adaptación a pantallas pequeñas. Registro 034.

### 26/09/2026 — Panel de factura de 540 px

Panel lateral ampliado a 540 px y contenido de Cliente reducido a 110 px, con salto de línea y adaptación móvil conservados. Registro 035.

### 26/09/2026 — Créditos centrados en clientes

Lista priorizada y ficha con facturas, artículos, abonos, PDF y preparación de pago existente. Filtro por cliente sin abonos durante más de dos meses calendario; historial fallido diferenciado y sin inventar mora donde no hay vencimientos. Registro 036.

### 26/09/2026 — Presentación de Cartera de crédito

Título simplificado, resumen contraíble con iconos, tarjetas sin «A quién atender», fecha de último abono en línea y saldo a la derecha un 15% mayor. Registro 037.

### 26/09/2026 — Alineación de tarjetas de clientes

Iniciales y saldo centrados verticalmente en la tarjeta completa, con los datos del cliente en la columna central. Registro 038.

### 26/09/2026 — Dos vistas operativas de Compras

Recepción rápida predeterminada y tablero por proveedor, con historial conservado. Borradores locales por usuario, etapas manuales, recuperación y revisión antes de confirmar. OCR de imágenes y registro de inventario existentes reutilizados. Registro 039.

### 26/09/2026 — Resumen y paneles de Recepción rápida

Indicadores reales contraíbles, compras recientes, inicio por foto/manual, pasos e iconos SVG. Carga y fallos de compras, proveedores y productos visibles. Registro 040.

### 26/09/2026 — Resumen de Compras en conjunto

Las tres tarjetas se contraen mediante un único botón junto al título, sin controles individuales. Registro 041.

### 26/09/2026 — Iconos de vistas de Compras

Selector de vistas con iconos accesibles en la misma fila que Registrar compra. Registro 042.

### 27/09/2026 — Compras: planificación y consulta integradas

Fecha prevista y estados en borradores; compras ingresadas visibles en seguimiento e historial con detalle por documento y PDF. Pago compacto mediante iconos. Registro 043.

### 27/09/2026 — Formulario compacto de Compras

Pago junto a Etapa, logística y costos en una fila, OCR junto a Buscar productos y eliminación de textos superiores. Registro 044.

### 27/09/2026 — Tarjetas de Compras compactas

Altura ajustada al texto, con menor espacio vertical en las tres tarjetas principales. Registro 045.

### 27/09/2026 — Fecha de entrega integrada

Programar pedido usa un calendario directo y muestra la fecha elegida dentro del control. Registro 046.

### 05/10/2026 — Selector de productos de Compras

Tabla clara con código separado, ordenamiento, alturas, selección/CSV y paginación sobre el catálogo completo. Conserva el flujo de agregar productos. Compilador Angular y 14 pruebas correctos; revisión visual pendiente. Registro 047.

### 05/10/2026 — Planillas UI 2.0

Tema claro, resumen contraíble, tarjetas compactas y ventanas comunes. Histórico jerárquico con búsqueda, ordenamiento, densidad, selección/CSV y paginación; cálculos conservados. Compilador Angular y nueve pruebas correctos; revisión visual pendiente. Registro 048.

### 05/10/2026 — Información de pago por hora

Desglose y tarifas de Planillas movidos a modal accesible desde icono superior; corregido texto blanco heredado en tarjetas. Compilador Angular y diff correctos. Registro 049.

### 05/10/2026 — Filtros de Planillas con iconos

Semana y mes compactados en iconos de calendario junto a las acciones, conservando selectores nativos y filtros. Registro 050.

### 05/10/2026 — Resumen y gráfico de Planillas contraíbles

El control del resumen oculta/muestra tarjetas y Tendencia de salarios en conjunto, conservando el canvas. Registro 051.

### 05/10/2026 — Campos del cálculo de Planilla alineados

Editor diario de seis columnas con campos de horas/bono de ancho uniforme y contenido centrado. Registro 052.

### 05/10/2026 — Etiquetas de horas simplificadas

El modal Calcular planilla conserva títulos de tabla y elimina etiquetas visuales repetidas sobre los campos; nombres accesibles preservados. Registro 053.

### 05/10/2026 — Tarjetas contraíbles del cálculo de Planilla

Control junto al encabezado del modal para contraer/expandir las cuatro tarjetas y ampliar el detalle. Estado independiente del resumen principal. Registro 054.

### 05/10/2026 — Empleados y resúmenes contraíbles

Retirado gráfico de pastel; control independiente para contraer/expandir ranking y resúmenes en conjunto. Registro 055.

### 05/10/2026 — Barra de Planillas con iconos

Resumen principal, Modificar, Calcular y Empleados y resúmenes se controlan con iconos en la barra superior junto a filtros e información. Registro 056.

### 05/10/2026 — Encabezado de Planillas simplificado

Título único Modulo de Planillas y control del resumen principal junto al nombre. Registro 057.

### 05/10/2026 — Espaciado compacto de Planillas

Filas ajustadas al contenido y encabezado compacto para evitar espacio sobrante al contraer paneles. Registro 058.

### 05/10/2026 — Histórico de Planillas sin subtítulo

Retirado párrafo descriptivo bajo el título del histórico. Registro 059.

### 05/10/2026 — Asistencia UI 2.0

Tema claro, título/espacios compactos, iconos y paneles contraíbles. Registro jerárquico con búsqueda, ordenamiento, densidad, selección/CSV y paginación; gráfico circular retirado y resumen CSV funcional. Compilador Angular y nueve pruebas correctos. Registro 060.

### 05/10/2026 — Asistencia sin Estadísticas

Retirada tarjeta Estadísticas y ampliado Horas por usuario a ancho completo. Registro 061.

### 05/10/2026 — Paneles de Asistencia sin huecos

Horarios y Horas por usuario se contraen desde iconos con estado activo en la barra; paneles ocultos fuera del layout. Registro 062.

### 05/10/2026 — Paneles cerrados e iconos Lucide

Planillas/Asistencia restablecen paneles y detalles cerrados al ingresar; modal de cálculo con tarjetas cerradas al abrir. Iconos SVG del alcance convertidos a Lucide. Compilador Angular y seis pruebas correctos. Registro 063.

### 05/10/2026 — Usuarios y accesos por módulo

Configuración modernizada con Usuarios: CRUD mediante baja lógica, perfiles y permisos individuales, filtros/CSV y Lucide. Sesiones y autorización HTTP/IPC; contraseñas nuevas con scrypt y protección del último administrador. Dieciséis pruebas y compilador Angular correctos; integración SQL pendiente por ESOCKET. Registro 064.

### 05/10/2026 — Acceso a Configuración

Operador y Consulta incluyen acceso de lectura a Configuración para preferencias personales; Usuarios sigue administrativo y escrituras backend requieren gestión. Icono lateral explícito Lucide Settings debajo de Histórico; denegación individual explícita conservada. Registro 065.

### 05/10/2026 — Usuarios visible en Configuración

Pestaña Usuarios siempre visible dentro de Configuración. Cuentas sin perfil Administrador ven el requisito y su perfil actual; no se consulta el directorio ni se habilita CRUD. Registro 066.

### 05/10/2026 — Edición de usuarios en modal

Formulario de alta/edición y permisos en modal superpuesto con Lucide, cierre, Escape y foco de teclado contenido; listado mantiene su tamaño, filtros y paginación. Errores visibles dentro del modal y cierre bloqueado durante guardado. Registro 067.

### 05/10/2026 — Editor de usuarios compacto

Modal con cabecera y acciones fijas, datos de cuenta en panel lateral, estado alineado y matriz compacta de permisos con botones Lucide y leyenda. Contenido desplazable y diseño adaptable a móvil; permisos y guardado conservados. Validación Angular correcta; revisión visual pendiente. Registro 068.

### 05/10/2026 — Finanzas UI 2.0

Costos, Caja chica, Finanzas y Ventas y rentabilidad usan tema claro, títulos compactos, acciones/filtros Lucide y resumen de tarjetas/gráficos contraíble junto al título. Paneles auxiliares controlados desde barra superior; todos cerrados por defecto al ingresar. Ocho tablas con búsqueda, filtros, ordenamiento, selección/CSV, densidad y páginas 10/25/50/100 sobre datasets completos; movimientos conserva jerarquía con detalles cerrados. Modales de registro/edición/baja claros. Gráfico circular de Costos retirado; ejes/paleta de gráficos legibles. Cálculos/backend/BD conservados, escritorio sin reiniciar. Registro 069; revisión visual pendiente.

### 05/10/2026 — Menú lateral moderno

Navegación con Lucide uniforme, tipografía compacta, indicador activo y jerarquía de submódulos. Acordeones animados con inert/aria-controls; transiciones respetan movimiento reducido. En modo contraído los grupos siguen visibles y abren menú/submódulos juntos; tooltips accesibles por foco y mouse. Permisos y navegación conservados; escritorio sin reiniciar. Registro 070.

### 05/10/2026 — Contraste del menú claro

Texto e iconos del menú sobre fondo blanco usan tonos oscuros; activo verde profundo y fondo suave, bordes y flechas legibles. Trazo Lucide reforzado. Ajuste CSS, sin cambios de navegación ni reinicio. Registro 071.

### 05/10/2026 — Menú oscuro uniforme

Menú lateral mantiene fondo #1f2937 y contraste claro en todos los módulos, expandido/contraído, incluido punto de venta. Menú de cuenta coherente; contenido de módulos conserva su tema. Ajuste CSS y diff verificados; escritorio sin reiniciar. Registro 072.
