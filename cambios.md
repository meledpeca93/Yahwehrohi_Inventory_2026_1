# Cambios — YahwehRohi Inventory 2.0

Registro numerado de los cambios realizados durante la modernización del sistema.

**Última actualización:** 21 de septiembre de 2026  
**Rama:** `version-2.0`  
**Cambios registrados:** 2

## Criterios del registro

- Agregar cada nuevo cambio con un número consecutivo, sin renumerar ni eliminar entradas anteriores.
- Documentar fecha, módulo, descripción, archivos, validaciones y pendientes.
- Los ajustes de un cambio existente se incorporan a su entrada con la fecha de actualización.
- Distinguir implementación, pruebas y aprobación del usuario. Una compilación correcta no equivale a aprobación funcional.
- Trabajar progresivamente sobre el tema claro de Inventory 2.0; replicar el diseño en otros módulos después de su revisión.

## Listado de cambios

| N.º | Cambio | Fecha | Estado |
| --- | --- | --- | --- |
| 001 | Modernización visual del Login | 20–21/09/2026 | Implementado; pendiente de aprobación del usuario |
| 002 | Modernización visual de Facturación | 20–21/09/2026 | Implementado; pendiente de aprobación del usuario |

## 001 — Modernización visual del Login

**Objetivo:** presentar un acceso más limpio, moderno y fácil de usar, conservando la autenticación existente.

### Cambios realizados

- Composición propia de YahwehRohi con tarjeta centrada, panel curvo de identidad, bordes redondeados y sombras suaves.
- Campos de usuario y contraseña con iconos SVG lineales y estados de foco.
- Control para mostrar u ocultar la contraseña.
- Botón de inicio de sesión con icono, estados hover, presión, foco, deshabilitado y mensaje de validación existente.
- Presentación de errores accesible y asociación explícita de la etiqueta de contraseña.
- Adaptación a escritorio y pantallas pequeñas; respeto a la preferencia de movimiento reducido.
- **Actualización del 21/09/2026:** adopción del tema claro como base de Inventory 2.0, sustituyendo la propuesta oscura inicial.

### Funcionalidad conservada

Selector de usuarios, captura de contraseña, envío del formulario, validaciones y autenticación. No se agregó registro de usuarios ni recuperación de contraseña. Los controles preexistentes «Recordarme» y «Olvidé mi contraseña» conservaron su comportamiento anterior.

### Archivos principales

- `src/app/app.html`: presentación del formulario y atributos accesibles.
- `src/app/app.ts`: incorporación de la hoja visual y estado para mostrar/ocultar contraseña.
- `src/app/yr-ui.css`: tokens visuales y estilos del Login.

### Validación y pendientes

- Compilación con `npm run build` correcta.
- Revisión en navegador aislado a 1440 × 1000 y 390 × 844, sin desbordamiento horizontal.
- Comprobación del control de visibilidad de contraseña.
- **Pendiente:** revisión visual del usuario y prueba con autenticación real en desarrollo.

## 002 — Modernización visual de Facturación

**Objetivo:** aprovechar mejor el espacio del POS y facilitar la lectura y operación de la factura, conservando su flujo funcional.

### Cambios realizados

- Organización mediante paneles y tarjetas con bordes suaves, espaciado uniforme y tipografía legible.
- Buscador de productos y códigos de barras tipo pill, con icono, halo y elevación sutil al enfocar.
- Tarjetas de productos con nombre visible, precio destacado, costo conservado, indicadores de stock/margen y cintas NUEVO, OFERTA y PROMOCIÓN.
- Detalle de venta con etiquetas de precio, cantidad y subtotal; controles +/− compactos y botón de eliminar con color de peligro.
- Total destacado utilizando el cálculo existente; conservación de subtotal, utilidad, recibido y vuelto.
- Navegación de facturas abiertas con indicador de selección.
- Modales con overlay, panel elevado, encabezados y botones estilizados, sin alterar sus manejadores.
- Ocho acciones en una sola fila de iconos: nueva factura, efectivo, crédito, transferencia, cargar CSV, cotizaciones, guardar cotización y limpiar.
- Tooltips con el nombre de cada opción al pasar el cursor o enfocar con teclado; nombres accesibles para lectores de pantalla.
- Estados de selección, foco, presión, deshabilitado y guardado; respeto al movimiento reducido.
- Adaptación a pantallas pequeñas, incluido el menú de navegación mientras Facturación está visible.
- **Actualización del 21/09/2026:** tema claro como base, contraste corregido en alertas y cintas, icono de búsqueda visible al enfocar y estado del método de pago seleccionado reforzado.

### Base visual reutilizable

Tokens CSS `--yr-*` para fondos, superficies, texto, acento, estados semánticos, radios y sombras. Variantes de botones primary, secondary, success, danger, ghost e icono. SVG nativo y tipografía Inter/system-ui, sin dependencias nuevas.

El tema claro se aplica al Login y Facturación. Los otros módulos conservan su presentación y tema guardado; su modernización se realizará gradualmente.

### Actualización del 21/09/2026 — Tarjetas de productos

- La estrella de los productos marcados como favoritos utiliza `#E02D09` en contorno y relleno; se conserva la acción de marcar/desmarcar.
- Se eliminó el fondo verde del stock: la cantidad disponible se presenta como texto neutro, conservando el indicador de margen.
- Se retiró el código/SKU visible de cada tarjeta para reducir información repetida.
- La cuadrícula muestra cuatro productos por fila en escritorio y dos en pantallas pequeñas.
- Se conservan nombre, imagen, costo, precio de venta, stock, margen y cintas.
- El código sigue disponible para búsqueda y escáner; no cambian datos ni eventos.

### Actualización del 21/09/2026 — Tres ajustes UX de Facturación

- Restauradas las dimensiones anteriores de los botones de la barra de factura. Cliente ocupa el espacio flexible y las acciones quedan agrupadas a la derecha junto al número de factura; el nombre puede ocupar varias líneas dentro del mismo botón si es largo.

- Líneas del carrito compactadas: nombre, precio, cantidad, subtotal y eliminar en una misma fila. Nombres largos con tooltip; en espacios estrechos el listado permite desplazamiento horizontal para conservar todos los controles. Sin cambios de cálculo ni eventos.

- Se unificó el encabezado de factura: Cliente/Proveedor es el primer botón de la barra de acciones y el número de factura se alinea a la derecha en la misma barra. Se conserva la referencia de cotización activa y los eventos originales. En móvil la barra permite desplazamiento horizontal para mantener accesibles todas las acciones.
- El filtro muestra «Categoría: Todas» o «Categoría: [categoría seleccionada]» dentro del selector. Se conserva el valor original de cada opción y el evento de filtrado.

- Se retiraron las etiquetas visibles «Buscar producto / escanear código» y «Categoría»; ambos controles quedan centrados verticalmente en su barra, con nombres accesibles conservados mediante `aria-label`.

- Resumen superior colapsable mediante botón ChevronUp/ChevronDown, nombre accesible y estado expandido. Las cuatro tarjetas mantienen datos y bindings; transición de 220 ms sin desmontarlas ni consultar otra vez al expandir.
- Buscador/escáner de 54 px y placeholder «Escanear código o buscar producto...», con foco destacado. Se conserva íntegramente la lógica existente de búsqueda, Enter y recuperación de foco.
- «Ventas del día» permanece visible; «Pantalla cliente», «Movimiento», «Catálogo» y «Corte del día» pasan a «Más acciones». Catálogo sigue abriendo su ventana propia.
- Desplegable nativo accesible por teclado, cierre al seleccionar, al pulsar fuera y con Escape; Escape devuelve foco al disparador.
- Sin cambios en tarjetas de productos, panel derecho, Total/Recibido/Vuelto ni reglas funcionales. Sin dependencias nuevas.
- Validación: compilación y navegador aislado con datos simulados; eventos y bindings previos conservados, colapso/expansión, menú, carrito y escáner revisados.

### Actualización del 21/09/2026 — Ítems y páginas de factura

- Facturación: columna Ítem consecutiva y detalle paginado, cinco filas iniciales y selector 5/10/15/30/45/60/100; navegación centrada y sin scroll vertical interno. Totales calculados sobre toda la factura, páginas limitadas al eliminar y posición independiente por factura.

### Actualización del 21/09/2026 — Lista de categorías

- Categorías: desplegable blanco con texto gris oscuro, diez opciones por página, navegación y selección que conserva el filtro; cierre al seleccionar, clic fuera o Escape.

### Actualización del 21/09/2026 — Paginación del catálogo

- Selector de 15, 30, 45, 60 y 100 productos; cambiar cantidad vuelve a la primera página.
- Navegación centrada «« ‹ página › »» con primera/anterior/siguiente/última, límites deshabilitados y etiquetas accesibles. Rango visible a la derecha. Sin cambios de inventario ni ventas.

### Actualización del 21/09/2026 — Formulario contraíble

- Botón Contraer factura/Mostrar factura dentro de Más acciones, con flecha y estado accesible. Al contraer, el catálogo ocupa todo el ancho disponible y muestra ocho productos por fila en escritorio (más de 1200 px); conserva cuatro en tablet y dos en móvil. El menú se cierra al seleccionar y devuelve el foco a Más acciones.
- Formulario conservado en el DOM, oculto y fuera de la navegación por teclado mientras está contraído; mantiene factura, cliente, cantidades y recibido.
- Validado con navegador aislado: catálogo de 655 a 1293 px al contraer; al restaurar conserva subtotal L65 y recibido L500. Compilación correcta con advertencias previas.

### Actualización del 21/09/2026 — Resumen compacto y montos laterales

- Montos rápidos en cuadrícula 2 × 2 a la izquierda, ocupando la altura del resumen; Subtotal, Recibido y Vuelto compactos a la derecha.
- Etiquetas y valores alineados a la derecha; tipografía y color unificados con Subtotal, incluso cuando Vuelto es positivo. Se elimina la fila separada de montos sin modificar cálculos ni eventos.
- Validación: compilación correcta y revisión en navegador aislado a 1440 y 390 px. Con subtotal L65 y recibido L500, vuelto L435; color oscuro uniforme en los cuatro elementos comprobados. Revisadas cantidades, escáner y seis pestañas con datos simulados.

### Actualización del 21/09/2026 — Resumen de cobro vertical

- Subtotal, Recibido y Vuelto en filas verticales; retirada Utilidad estimada de la vista de venta.
- Botones L50/L100/L200/L500 debajo de Vuelto y alineados a la derecha. Se conservan cálculos, eventos y el costo registrado en compras.

### Actualización del 21/09/2026 — Visibilidad de iconos y encabezado Cantidad

- Corregido el color heredado blanco de las pestañas inactivas: todas muestran el icono de factura, independientemente del foco o selección.
- Encabezado Cantidad centrado sobre su columna. Sin cambios en eventos ni cálculos.

### Actualización del 21/09/2026 — Icono de factura abierta

- Sustituido el texto «Factura #1» de las pestañas por el número seguido de un icono de documento («1 + icono»); etiqueta completa conservada en tooltip y nombre accesible. Pestaña compacta, manteniendo selección y cierre.

### Actualización del 21/09/2026 — Columnas del detalle de factura

- Encabezados alineados de Producto, Precio (L)/Costo (L), Cantidad, Subtotal y Acción; retiradas las etiquetas repetidas dentro de cada línea.
- Campo de precio ampliado a 96 px y columnas separadas, con espacio adicional antes de eliminar. En paneles estrechos se conserva una fila con desplazamiento horizontal.
- Conservados eventos, cantidades, precios y cálculos. Compilación correcta; continúan las advertencias previas de app.css y Tesseract.

### Funcionalidad conservada

Búsqueda, referencia y foco del escáner, Enter de códigos de barras, selección de productos, cantidades, precios, cálculos, métodos de pago, facturas abiertas, favoritos, cotizaciones, CSV y acciones existentes. No se agregaron impuestos ni descuentos inexistentes.

No se modificaron endpoints, autenticación backend, SQL Server, stock, reglas de negocio ni generación de documentos.

### Archivos principales

- `src/app/app.html`: presentación, iconos, etiquetas, atributos accesibles y tema visual condicionado a Facturación.
- `src/app/yr-ui.css`: tema claro, componentes visuales, estados y responsive.
- `src/app/app.ts`: referencia a la hoja visual agregada en la etapa inicial; sin cambios a los métodos de facturación.
- `docs/UI_MODERNIZATION_2_0.md`: auditoría técnica y alcance de las pruebas.

### Validación y pendientes

- Compilación con `npm run build` correcta.
- Comparación de eventos, referencias, IDs y bindings de formularios: conservados.
- Pruebas con datos simulados: agregar productos, aumentar/disminuir cantidades, actualizar total, crear otra factura y recuperar la anterior, introducir código + Enter y mantener el foco.
- Apertura/cierre del modal de clientes y tooltip por teclado verificados.
- Ocho iconos alineados en una sola fila tanto en escritorio como a 390 px; sin desbordamiento horizontal del documento.
- Estado de pago seleccionado y movimiento reducido comprobados.
- Advertencias previas de compilación: presupuesto de `app.css` y CommonJS de Tesseract.
- **Pendiente:** aprobación visual y pruebas reales en desarrollo con lector físico, registro de venta e impresión. No se ejecutaron ventas reales durante estas pruebas.

## 003 — Pantalla del cliente: tema claro (21/09/2026)

- Paleta clara coherente con Facturación: fondo gris suave, tarjetas blancas, texto oscuro, total verde suave y vuelto neutro legible.
- Bordes redondeados, sombras discretas, efecto hover y respeto a movimiento reducido. Diseño adaptable y totales visibles con lista desplazable.
- Se mantienen logo, cliente, factura, imágenes, códigos, cantidades, importes y mecanismo de actualización; sin cambios de cálculos ni comunicación.
- Archivo: `src/app/app.ts`, estilos de `customerDisplayHtml()`.

### Ajuste del 21/09/2026 — Jerarquía visual de pantalla cliente

- Encabezado compacto con logo, cliente y número de factura; códigos internos retirados de las líneas.
- Resaltado verde suave de 1,6 segundos al agregar un producto o aumentar su cantidad; no se reinicia al modificar recibido. Respeta movimiento reducido y conserva cálculos/sincronización.

### Ajuste del 21/09/2026 — Detalle y resumen para clientes

- Panel «Tu compra» con conteo de productos y columnas estables de cantidad/importe; filas más ligeras y tipografía jerarquizada.
- Resumen de pago con Total, Recibido y Vuelto; bienvenida al estar vacío.
- Imágenes fallidas reemplazadas por iniciales, evitando texto roto. Diseño móvil y movimiento reducido conservados.
- Cálculos y mecanismo de actualización sin modificaciones.

## 004 — Ventas del día: tabla interactiva (22/09/2026)

- Tema claro, tipografía del sistema, cabecera compacta, indicadores del día, estados discretos y foco accesible.
- Datos conservados desde `/api/invoices/today` / Electron; búsqueda global, filtros de pago/estado, ordenamiento ascendente/descendente en ocho columnas y páginas de 10/25/50.
- Selección individual o de página mediante casillas, conservada entre páginas; exportación CSV de la selección y limpieza. No ejecuta modificaciones masivas de ventas.
- Acciones Ver/PDF/Anular/Activar mantienen los manejadores y confirmaciones existentes.
- Edición en línea pendiente de definir campos con el usuario; no existe operación de edición de factura en el flujo revisado. No se simula guardar datos solo en pantalla.
- Validado con 57 facturas simuladas: páginas de 10/25/50, última página de siete registros, búsqueda, orden numérico, selección y filtros combinados; revisión visual de escritorio y móvil. No se modificaron ventas reales.
- Compilación correcta. Nueva advertencia: bundle inicial supera el presupuesto de 1,80 MB (1,81 MB); advertencias previas de app.css y Tesseract continúan.

### Ajuste del 22/09/2026 — Confirmación de anulación

- Reemplazada la confirmación del navegador por un diálogo claro con icono, factura, cliente, total y explicación del retorno al stock.
- Cancelar enfocado inicialmente; navegación contenida en diálogo nativo, Escape para cancelar y restauración de foco.
- Confirmación con estado Anulando y bloqueo de doble envío; errores mostrados dentro del diálogo. API/Electron, confirmación explícita y proceso de anulación conservados.

### Ajuste del 22/09/2026 — Filtros compactos de ventas

- Etiquetas dentro de campos: Buscar, Tipo de pago y Estado; eliminado Actualizar, manteniendo filtros reactivos inmediatos sobre los datos cargados.
- Retirada fila permanente de resultados; selección y acciones aparecen únicamente al seleccionar facturas.
- Leyenda inferior con cantidad encontrada que desaparece tras 3,5 segundos desde el último cambio. Temporizador limpiado al cerrar.

## 005 — Detalle de factura (22/09/2026)

- Réplica del tema claro, tipografía, estados discretos, indicadores compactos y botones de las ventanas anteriores.
- Búsqueda inmediata por producto/código, filtro de estado, ordenamiento de columnas, selección con casillas y páginas de 10/25/50; leyenda temporal inferior.
- PDF y Anular/Activar conservados. Totales superiores corresponden a la factura completa; no se añaden ediciones de datos registrados.
- Compilación correcta; continúa advertencia de tamaño del bundle (1,83 MB), app.css y Tesseract.

## 006 — Inventario y ventanas relacionadas (22/09/2026)

- Tema claro, tipografía uniforme, tarjetas blancas, estados discretos, foco visible e iconos con contraste en Inventario y Kardex agotados.
- Estilos compartidos en productos inactivos, códigos armados, agregar/editar producto y ventanas de detalle, lotes, códigos de barras y ajustes conectadas.
- Búsqueda y filtros reactivos con etiquetas integradas; ordenamiento por encabezados y paginación centrada de 10/25/50/100 para inventario, inactivos, códigos armados y agotados.
- Selección individual múltiple y exportación CSV de seleccionados; aviso temporal de resultados durante 3,5 segundos.
- Confirmación de inactivación mediante diálogo del sistema visual, con Cancelar enfocado y Escape. Se conserva el proceso existente de actualización del producto.
- Formularios de edición y validaciones existentes conservados; sin nuevas ediciones directas de celdas ni cambios de base de datos.
- Compilación correcta; continúan advertencias de tamaño del bundle (1,87 MB), app.css y Tesseract.

### Ajuste del 22/09/2026 — Tablas de Inventario unificadas

- Ajuste del 23/09/2026: Códigos armados con texto centrado salvo Código a la izquierda; Imagen ampliada a 88 px y miniatura centrada para evitar partir el encabezado. Barras de Inventario mantienen filtros y densidad en una sola línea. CSS validado; revisión visual pendiente.

- Ajuste del 22/09/2026: botones Ver detalle y Editar de Códigos armados alineados horizontalmente, sin salto de línea y con separación de 6 px. Archivo: `src/app/yr-ui.css`. Selector y sintaxis CSS revisados; revisión visual pendiente.

- Ajuste del 22/09/2026: modales con tablas ampliados hasta el ancho de pantalla con margen de 24 px por lado (máximo 1800 px). Tablas sin ancho mínimo forzado ni scroll interno, columnas adaptables y textos multilínea. Bajo 900 px, registros en bloques de dos columnas con etiquetas, manteniendo encabezados de ordenamiento y todos los controles. El modal conserva desplazamiento vertical cuando su contenido supera la altura disponible. Archivos: `src/app/app.html`, `src/app/yr-ui.css`. Compilador Angular, estructura y CSS validados; revisión visual pendiente.

- Alcance: siete tablas (inventario principal, agotados, inactivos, códigos armados, componentes, selector de productos y códigos de barra). Tipografía común, cabeceras centradas, Código a la izquierda, selector estrecho inicial, acciones al final con iconos, texto sin cápsulas y recuadros numéricos claros. Sin scroll vertical interno en las tablas modales; conservado el desplazamiento del diálogo y el horizontal cuando hace falta.
- Barra de búsqueda de 432 px adaptable, controles de altura Compacta/Normal/Amplia, ordenamiento por columnas de datos, páginas 10/25/50/100 con navegación centrada, selección y CSV. Los filtros propios del inventario principal se conservan; no se añaden filtros de campos inexistentes a otras tablas.
- Códigos de barra, componentes y selector incorporan búsqueda local, ordenamiento, paginación, selección y exportación. Estado aislado por tabla; selección, búsqueda y página se limpian al abrir otro contexto. Selector de componentes usa búsqueda única y conserva exclusión de productos ya añadidos y ofertas.
- Resumen del detalle de código armado contraíble, encabezados modales simplificados y acciones con nombres accesibles. Marcar código principal permanece en la última columna junto a Activar/Desactivar; mismos manejadores, permisos y bloqueos de guardado.
- Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`. Sin cambios de backend ni base de datos.
- Validaciones: `npx ngc -p tsconfig.app.json --noEmit` correcto; comprobación de las siete estructuras y sus colspan; pruebas con 57 filas simuladas de búsqueda con acentos, orden numérico ascendente/descendente, límites de página, tamaños, selección, aislamiento de densidad, reinicio de contexto y escape seguro de CSV. CSS parseado correctamente.
- Pendiente: revisión visual y aprobación del usuario; no se ejecutaron operaciones sobre datos reales.

### Ajuste del 22/09/2026 — Productos agotados con presentación de Inventario

- Ajuste posterior del 22/09/2026: título exacto «Producto Agotados» y acciones Reponer/Inventario representadas por iconos SVG, con tooltip, nombre accesible y foco visible; eventos conservados. Archivos: `src/app/app.html`, `src/app/yr-ui.css`. Parser Angular correcto; revisión visual pendiente.

- Encabezado sin antetítulo ni descripciones redundantes; tarjetas contraíbles con control accesible y estado independiente.
- Buscador de 432 px y tres iconos de altura Compacta/Normal/Amplia en la misma barra; selección en primera columna estrecha, Código segundo alineado a la izquierda y acciones al final. Encabezados centrados.
- Código, Categoría y Proveedor sin cápsulas; Stock, Mínimo, Costo y Precio final con recuadros claros. Tabla sin scroll vertical interno y celda Producto corregida a estructura de tabla.
- Conservados búsqueda, ordenamiento, selección, exportación, paginación y botones Reponer/Inventario. Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`.
- Validación: parser Angular, diez encabezados/celdas y TypeScript correctos. Pendiente revisión visual del usuario.

### Ajuste del 22/09/2026 — Tabla principal más limpia

- Ajuste del 22/09/2026: eliminado el filtro Lotes y su estado/lógica de filtrado para evitar restricciones ocultas. Se conservan búsqueda, categoría, estado y vencimiento. Archivos: `src/app/app.html` y `src/app/app.ts`. Parser Angular y TypeScript correctos; revisión visual pendiente.

- Ajuste del 22/09/2026: título del módulo cambiado a «Control de Inventario» en `src/app/app.html`. Texto verificado; pendiente revisión visual.

- Ajuste del 22/09/2026: buscador ampliado un 35%, de 320 a 432 px de base flexible, conservando adaptación a pantallas estrechas y ancho de los demás filtros. Archivo: `src/app/yr-ui.css`. Validación: proporción y selector revisados; pendiente revisión visual.

- Ajuste del 22/09/2026: barra de filtros ocupa el ancho disponible; selectores de 160 px sin crecimiento y buscador de 320 px, evitando Vencimiento expandido en otra línea cuando hay espacio. Tres botones con iconos y estado accesible para alturas Compacta/Normal/Amplia (padding vertical 4/12/20 px); Normal inicial. Adaptación con salto de línea en pantallas estrechas. Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`. Parser Angular y TypeScript correctos; revisión visual pendiente.

- Ajuste del 22/09/2026: eliminado «Gestion principal de inventario» y su contenedor; barra de filtros sin margen superior sobrante. Buscador con base flexible de 300 px (antes 150 px) y doble factor de crecimiento, adaptable a pantallas estrechas. Archivos: `src/app/app.html` y `src/app/yr-ui.css`. Plantilla Angular validada; revisión visual pendiente.

- Encabezado compacto (22/09/2026): eliminados «Hoja de inventario» y la descripción «Gestiona stock…». Separación vertical de 12 px, título sin margen y contenido alineado al inicio para evitar que el grid distribuya espacio sobrante; compensación del resumen contraído ajustada a 12 px. Archivos: `src/app/app.html` y `src/app/yr-ui.css`. Parser Angular correcto; revisión visual pendiente.

- Ajuste del 22/09/2026: selección en primera columna estrecha independiente (36 px), Acción al final y once columnas con colspan actualizado. Retirado el subtítulo de Gestión principal. Tarjetas superiores contraíbles con flecha junto al título, estado independiente de Facturación, atributos accesibles, contenido oculto fuera del foco y transición con respeto a movimiento reducido. Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`. Validación: parser Angular, estructura de once columnas y `npx tsc --noEmit -p tsconfig.app.json` correctos. Pendiente revisión visual del usuario.

- Ajuste final del 22/09/2026: Código alineado a la izquierda y Acción trasladada a la última columna, conservando encabezados centrados y todos sus controles. Validación: parser Angular y orden de las diez columnas; revisión visual pendiente.

- Ajuste posterior del 22/09/2026: retirada la columna Lote de la tabla principal, Código alineado a la derecha y todos los encabezados centrados. Archivos: `src/app/app.html` y `src/app/yr-ui.css`. Colspan actualizado a diez; plantilla validada con el parser de Angular y comprobados diez encabezados/diez celdas por producto. Pendiente revisión visual del usuario.

- Código, Categoría y Estado se muestran como texto oscuro sin fondo, borde ni cápsula. Cantidad, Mínimo, Costo y Precio final conservan sus recuadros sombreados.
- Ajuste posterior del 22/09/2026: Vencimiento recupera los colores anteriores solo en el texto (neutro para vigente/sin lote, ámbar para próximo a vencer y rojo para vencido), manteniendo fondo transparente y sin borde. Revisadas las clases existentes y la precedencia CSS; pendiente revisión visual.
- Archivo: `src/app/yr-ui.css`; selector limitado a la tabla principal, excluyendo códigos armados. Se conservan controles y datos.
- Validación: revisión de selectores y alcance. Compilación intentada dos veces (también con dos workers), interrumpida con código 134 sin diagnóstico; no se pudo confirmar el build.
- Pendiente: revisión visual y aprobación del usuario.

## 007 — Formulario de producto organizado (22/09/2026)

- Aplicada la propuesta visual aprobada: vista previa compacta con icono «Sin imagen», nombre y código.
- Campos agrupados en Datos del producto, Existencias y Precios, con nombre prioritario y costo/ganancia/precio en una fila en escritorio.
- Controles de stock con iconos y nombres accesibles, precio de venta destacado, acciones Cancelar/Guardar a la derecha; adaptación a una columna en móvil.
- Se conservan todos los eventos, campos, cálculos, restricciones al editar stock y métodos de guardado existentes. Categoría y unidad siguen siendo campos de texto para mantener su funcionamiento actual.
- Validación en Chrome aislado: 13 campos presentes, tres secciones, Guardar visible en escritorio y diseño móvil de una columna sin desbordamiento horizontal. Sin guardar datos reales.
- Compilación correcta, con advertencias existentes de presupuesto (bundle 1,88 MB), app.css y Tesseract.

## 008 — Mayúsculas y minúsculas en títulos (22/09/2026)

- Títulos de módulos, ventanas y encabezados de tablas con mayúscula inicial y resto en minúsculas. Conservadas siglas ID/PDF/CSV y nombres propios o datos dinámicos.
- Normalizados diez títulos estáticos y retirado el efecto visual de uppercase/capitalize en encabezados mediante regla CSS común. Sin cambios de datos ni acciones.
- Criterio documentado en `AGENTS.md` para futuros cambios. Archivos: `src/app/app.html`, `src/app/yr-ui.css` y `AGENTS.md`.
- Validación: compilador Angular y revisión de títulos estáticos; pendiente revisión visual y aprobación del usuario.

## 009 — Modales de Facturación y barras compactas (23/09/2026)

- Estándar de Inventario aplicado a los modales de Facturación: tema claro, títulos en estilo oración, controles alineados, tablas sin scroll interno, tipografía uniforme, estados de foco, selección inicial, acciones con iconos y tres alturas. En pantallas pequeñas las tablas se reorganizan con etiquetas por campo.
- Ocho tablas revisadas: líneas de cotizaciones, vencimientos, stock bajo, ventas del día, detalle de factura, cortes, clientes y proveedores. Las seis sin controles comunes reciben búsqueda, ordenamiento, selección/CSV y páginas 10/25/50/100. Ventas y Detalle conservan sus filtros y selección; agregadas densidades y opción de 100 filas.
- Movimientos reorganizado en tres grupos: datos del movimiento, importe/forma de pago y descripción. Conservados nueve campos, eventos, validaciones y guardado; total y acciones alineados.
- Catálogo PDF con tarjetas limpias sin superposición oscura, búsqueda, categoría, paginación, densidad y resumen contraíble. Vista previa independiente: el PDF sigue incluyendo todos los productos del catálogo. Botón con estado de preparación y bloqueo de doble exportación. Conteo de categorías basado en las categorías reales del catálogo.
- Corte del día: historial al ancho disponible, búsqueda/estado, acción accesible Ver corte y resumen debajo. Conservados fechas, totales, pagos, selección de corte y flujo de cierre.
- Ajuste solicitado en la revisión: filtros y densidades en una sola línea. Corregida prioridad CSS frente a las antiguas cuadrículas de Ventas y Detalle. Fechas/Generar corte y opciones de Cotizaciones integradas en sus barras; en pantallas estrechas la barra permite desplazarse horizontalmente, sin crear una fila exclusiva de densidad.
- Utilidad compartida de presentación en `src/app/features/shared/modal-table/modal-table-state.ts`, con estado independiente y exportación CSV escapada. Sin cambios de backend, persistencia ni operaciones reales de ventas/caja.
- Validación: compilación de desarrollo correcta; comprobación Angular final con `npx ngc -p tsconfig.app.json --noEmit`; siete pruebas de búsqueda, ordenamiento, paginación, contexto, selección y CSV; estructura de ocho tablas y nueve campos de Movimientos verificada. CSS parseado y comprobada barra flex sin salto de línea. Revisión de maquetas locales de escritorio de Movimientos y Catálogo, con correcciones de estilos heredados.
- Pendientes: validación visual final en la aplicación y aprobación del usuario. La apertura de otro navegador aislado fue rechazada por la revisión automática por límite de uso; no se completaron pruebas visuales integradas ni móviles. No se reinició la aplicación de escritorio.

## 010 — Acciones de movimiento financiero uniformes (23/09/2026)

- Los botones Cancelar y Guardar del modal Registrar movimiento financiero tienen ahora una anchura fija uniforme de 118 px, con texto sin salto ni recorte.
- Archivo: `src/app/yr-ui.css`. Sin cambios en el flujo de guardado ni en los datos financieros.
- Validación: compilación Angular sin emisión y revisión de reglas CSS.

## 011 — Jerarquía visual de Corte del día (23/09/2026)

- Reorganizado el modal en dos etapas: Historial de cortes para seleccionar el turno y Resumen del corte para analizarlo.
- El detalle ahora muestra primero ventas totales, total en caja y ganancia del día; conserva debajo todos los movimientos de caja, distribución de ventas y pagos de créditos.
- Encabezado del resumen con turno, usuario, fecha, estado y acción de cierre claramente separados. Adaptación a una columna en pantallas estrechas.
- Archivos: `src/app/app.html` y `src/app/yr-ui.css`. Sin cambios en cálculos, datos ni flujo de cierre.
- Validación: compilación Angular sin emisión y revisión de formato correctas.

## 012 — Legibilidad de tarjetas de caída de ventas (23/09/2026)

- Corregida la herencia de texto blanco de las tarjetas de alertas antiguas en el modal Caída de ventas. Etiquetas, cifras y descripciones ahora usan el color oscuro del tema sobre su superficie clara; la severidad crítica conserva énfasis rojo.
- Archivo: `src/app/yr-ui.css`. Validación: compilación Angular sin emisión y revisión de formato correctas.

## 013 — Contraste en tarjetas de alertas de inventario (23/09/2026)

- Unificada la corrección de contraste para las tarjetas de Stock bajo y alertas relacionadas: etiquetas, cifras y descripciones usan el color oscuro del tema sobre fondos claros.
- Archivo: `src/app/yr-ui.css`. Sin cambios funcionales.

## 014 — Sin desplazamiento interno en alertas de inventario (23/09/2026)

- Las ventanas de Productos con stock bajo y Productos próximos a vencer ya no limitan su alto ni crean desplazamiento interno. La tabla paginada crece dentro del flujo del modal.
- Archivo: `src/app/yr-ui.css`. Sin cambios en filtros, paginación ni datos.

## 015 — Alertas próximas a vencer sin scroll interno (23/09/2026)

- Retirado el límite de altura en la plantilla de Productos próximos a vencer y reforzado el contraste oscuro de sus tarjetas para neutralizar estilos heredados con texto blanco.
- Archivos: `src/app/app.html` y `src/app/yr-ui.css`. Sin cambios en filtros, datos ni paginación.

## 016 — Barra compacta de Historial de cortes (23/09/2026)

- Generar corte ahora tiene ancho de acción fijo de 126 px. Búsqueda, estado, fechas, acción y altura de filas usan medidas compactas para verse simultáneamente en el ancho actual del modal.
- Archivos: `src/app/app.html` y `src/app/yr-ui.css`. Sin cambios funcionales en generación o filtrado.

## 017 — Modificadores de altura alineados a la derecha (23/09/2026)

- Los controles Compacta, Normal y Amplia del Historial de cortes quedan anclados al borde derecho de su barra, conservando el resto de filtros visibles.
- Archivo: `src/app/yr-ui.css`. Sin cambios funcionales.

## 018 — Fechas completas en Historial de cortes (23/09/2026)

- Los campos Desde y Hasta se ampliaron a 140 px para mostrar la fecha completa y el selector de calendario. Generar corte se compactó a 118 px para conservar todos los controles en la misma barra.
- Archivo: `src/app/yr-ui.css`. Sin cambios funcionales.

## 019 — Selector de columnas para Inventario (23/09/2026)

- Añadido botón de engranaje en la tabla principal de Inventario. El panel permite marcar las columnas visibles, moverlas con flechas y restablecer el diseño.
- Se conservan selección, filtros, ordenamiento, paginación y acciones. La configuración se guarda localmente en el navegador y se restaura al volver a abrir la aplicación.
- Archivos: `src/app/app.html`, `src/app/app.ts` y `src/app/yr-ui.css`.

## 020 — Panel flotante de columnas (23/09/2026)

- El selector de columnas de Inventario deja de estar recortado por la barra de filtros: ahora flota por encima de la tabla con una capa y separación visual propias.
- Archivo: `src/app/yr-ui.css`. Sin cambios en las preferencias de columnas.

## 021 — Orden vertical en selector de columnas (23/09/2026)

- Las casillas y los nombres de columna se alinean a la izquierda en una cuadrícula estable. Las flechas laterales se sustituyen por un único botón ↑ para subir una posición; la primera columna no muestra botón.
- Archivos: `src/app/app.html` y `src/app/yr-ui.css`. Sin cambios en la preferencia o la tabla.

## 022 — Iconografía Lucide para configuración de columnas (23/09/2026)

- Instalada la librería oficial y gratuita `@lucide/angular`.
- El control de configuración de columnas de Inventario y sus ventanas reutilizables usa ahora el icono `Settings` de Lucide, con trazo consistente y accesible.
- Archivos: `package.json`, `package-lock.json`, `src/app/app.ts`, `src/app/app.html` y `src/app/yr-ui.css`.
- Validación: `npx ngc -p tsconfig.app.json --noEmit` y `git diff --check` correctos.

## 023 — Facturas con estándar visual 2.0 (25/09/2026)

- El módulo Facturas adopta la superficie clara y compacta de Facturación e Inventario, con encabezado, tarjetas de resumen, tendencia y tablas de contraste consistente.
- La tabla de facturas elimina su desplazamiento interno, mantiene las agrupaciones, exportaciones y acciones existentes, y añade controles Compacta, Normal y Amplia alineados a la derecha.
- Se normalizaron textos visibles: «Facturación», «Facturación mensual» y «Facturas emitidas».
- Archivos: `src/app/app.html`, `src/app/app.ts` y `src/app/yr-ui.css`.
- Validación: `npx ngc -p tsconfig.app.json --noEmit` y `git diff --check` correctos. Pendiente revisión visual integrada.

## 024 — Lectura analítica de Facturas (25/09/2026)

- El resumen superior de Facturas ya puede colapsarse desde su título para liberar espacio sin perder acceso a los indicadores.
- Se corrigieron los controles del gráfico, el ancho de la identidad del usuario y el contraste de leyendas, ejes y cuadrícula en la vista clara.
- Las filas mensuales y las agrupaciones diarias tienen jerarquía visual más suave para facilitar el análisis.
- Archivos: `src/app/app.html`, `src/app/app.ts` y `src/app/yr-ui.css`.
- Validación: `npx ngc -p tsconfig.app.json --noEmit` y `git diff --check` correctos. Pendiente revisión visual integrada.

## 025 — Validación de lectura de Facturas (25/09/2026)

- El control de resumen ahora muestra texto explícito y oculta las tarjetas mediante `display: none` al contraerse.
- La gráfica reafirma sus colores claros en cada actualización, incluso tras recarga en caliente; se ocultó el botón automático de ampliación que invadía el selector de período.
- Se añadió un resumen del período más reciente antes de la tabla mensual y se corrigieron acentos visibles.
- Archivos: `src/app/app.html`, `src/app/app.ts` y `src/app/yr-ui.css`.
- Validación: `npx ngc -p tsconfig.app.json --noEmit` y `git diff --check` correctos. Pendiente revisión visual integrada.

## 026 — Análisis y filtros de Facturas (25/09/2026)

- Facturas emitidas incorpora búsqueda por factura, cliente, usuario o teléfono, además de filtros de pago y estado con reinicio de página.
- Facturación mensual muestra los indicadores del período reciente y la variación porcentual frente al mes anterior.
- La barra de filtros, el resumen de resultados y los modificadores de altura se integran en una lectura única y compacta.
- Archivos: `src/app/app.html`, `src/app/app.ts` y `src/app/yr-ui.css`.
- Validación: `npx ngc -p tsconfig.app.json --noEmit` y `git diff --check` correctos. Pendiente revisión visual integrada.

## 027 — Iconos Lucide en Facturas (25/09/2026)

- Facturas usa iconos Lucide en búsqueda, limpieza de filtros, exportación, detalle, PDF, anulación y reactivación, con etiquetas accesibles y ayudas emergentes.
- Los iconos sustituyen texto repetitivo en acciones por fila y preservan los mismos manejadores.
- Archivos: `src/app/app.html`, `src/app/app.ts` y `src/app/yr-ui.css`.
- Validación: `npx ngc -p tsconfig.app.json --noEmit` y `git diff --check` correctos. Pendiente revisión visual integrada.

## 028 — Concepto analítico de Facturas (25–26/09/2026)

- Alcance: aplicación del concepto visual autorizado mediante «procede con los cambios». Indicadores compactos, gráfica del período, distribución por pago y lista principal con panel lateral para cliente, artículos, total y acciones.
- Fecha de referencia con Día/Semana/Mes/Todo; filtros por texto/pago/estado sincronizan indicadores, gráfica y lista antes de paginar. Montos activos excluyen anuladas; crédito facturado no es saldo pendiente.
- Vista plana inicial, páginas 10/25/50, tres alturas de fila, agrupación opcional por día/pago y resumen mensual contraído al final. Vista previa de cinco líneas con acceso al detalle completo, carga, error y reintento; respuestas tardías no sustituyen la selección actual.
- PDF superior exporta todos los resultados filtrados. Se conservan exportaciones individuales/agrupadas y validaciones de anulación/activación. Sin cambios de backend, base de datos, scripts de inicio ni reinicios de la aplicación de escritorio.
- Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`, `src/app/invoice-analysis.spec.ts` y documentación. Evidencias y revisión reproducible con datos simulados en `output/ui-concepts/`.
- Validación: 12 pruebas específicas y compartidas correctas; compilación Angular de desarrollo correcta. Chrome aislado (1600 × 1100 y 390 × 844) con datos ficticios: detalle lateral/completo, resumen contraíble, páginas 10/25, agrupaciones y búsqueda vacía correctos, sin desbordamiento de página móvil ni errores de ejecución. La suite general antigua falla al esperar `/api/customers` durante el inicio. La compilación de producción excede el presupuesto global: 2,12 MB frente al límite de 2 MB; también advierte sobre tamaño de CSS y Tesseract CommonJS. No se aumentaron presupuestos.
- Aprobación: concepto e implementación autorizados; aceptación visual final del resultado por el usuario pendiente.

## 029 — Recuperación de carga y filtro de Facturas (26/09/2026)

- Diagnóstico real: API 3000 devolvía HTTP 500 en salud y facturas; SQL local fallaba con `ESOCKET` y Docker no estaba iniciado. Al iniciar Docker, el contenedor existente `sqlserver-yr-dev` arrancó y el API recuperó 5.132 facturas con HTTP 200. El servidor web 4200 estaba detenido y se inició mediante el script existente `web:dev`.
- Interfaz: aviso de error distinguido de ausencia de ventas, indicadores ocultos durante el error, acciones Actualizar/Reintentar y recarga al cambiar fecha/período si la carga anterior falló.
- El listado utiliza su propia respuesta y no queda bloqueado por el resumen global ni por la consulta histórica. Se evitan solicitudes de carga duplicadas. Sin cambios de BD, credenciales, backend o scripts; sin reiniciar Electron.
- Archivos: `src/app/app.ts`, `src/app/app.html`, `src/app/yr-ui.css`, `src/app/invoice-analysis.spec.ts`.
- Validación: siete pruebas de Facturas correctas, incluyendo recuperación tras HTTP 500 y fallo independiente del histórico. API real de salud y facturas confirmado con HTTP 200; frontend 4200 compilado e iniciado. La base conectada tiene registros recientes hasta el 22/09/2026 (1 factura) y el 20/09/2026 (50); no hay facturas para el 26/09/2026 de la captura. Valores de conexión ocultos en el diagnóstico.
- Pendiente: confirmación visual del usuario en su navegador.

## 030 — Controles y proporciones de Facturas (26/09/2026)

- Resumen, tablas y agrupaciones usan iconos de flecha SVG para contraer/expandir, con etiquetas accesibles y ayudas emergentes.
- Búsqueda, Pago, Estado, Agrupar y altura de filas comparten una única barra. Se eliminan textos de resultados de encabezados y navegación. En móvil la barra permite desplazamiento horizontal sin dividir los controles en filas.
- Paginación igual a Inventario: Mostrar 10/25/50/100 a la izquierda, primera/anterior/página/siguiente/última centradas.
- Facturación mensual incorpora paginación y altura independientes; Meses y altura comparten la barra. Cambiar el período o tamaño reinicia la página, sin alterar la variación calculada sobre el histórico completo.
- Resumen gráfico unificado y compacto: proporción aproximada 62/38, distribución por pago con etiqueta, barra de 16 px e importe en una sola línea, siguiendo el concepto.
- Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`; comprobación visual reproducible en `output/ui-concepts/facturas-review.mjs`.
- Validación: compilador Angular y build de desarrollo correctos. Chrome aislado con datos ficticios: filtros alineados (diferencia vertical 0 px), paginación centrada, resumen gráfico de 187 px, navegación mensual 10 + 2 filas y reinicio al cambiar a 3 meses, altura mensual, iconos y vista móvil sin desbordamiento ni errores de ejecución. Capturas actualizadas en `output/ui-concepts/`.
- Pendiente: aceptación visual del usuario.

## 031 — Ancho del buscador y selector mensual (26/09/2026)

- El campo de búsqueda de Facturas emitidas usa el 80% de su ancho anterior, conservando la alineación de los demás filtros.
- Facturación mensual muestra Meses y el selector numérico en una sola línea, con ancho de 76 px como el selector Mostrar. Opciones 3/6/9/12 conservadas.
- Archivos: `src/app/yr-ui.css` y `src/app/app.html`. Sin cambios de datos o lógica.
- Validación: revisión de estilos, compilador Angular (`ngc --noEmit`) y `git diff --check` correctos. Aceptación visual del usuario pendiente.

## 032 — Texto del cliente y tipografía mensual (26/09/2026)

- Facturas emitidas muestra únicamente el nombre del cliente; se retira la línea inferior de teléfono/Sin teléfono tanto en la vista plana como en la agrupada. El teléfono sigue disponible en el panel de detalle y en la búsqueda.
- Facturación mensual utiliza peso normal en los datos, como el listado principal; conserva énfasis en encabezados, nombre del mes y total. Se elimina el peso 850 heredado de los estilos anteriores.
- Archivos: `src/app/app.html` y `src/app/yr-ui.css`. Sin cambios de datos o cálculos.
- Validación: compilador Angular (`ngc --noEmit`) y `git diff --check` correctos. Aceptación visual del usuario pendiente.

## 033 — Filtro Cliente y ordenamiento de Facturas (26/09/2026)

- Buscador reducido otro 25% respecto al ajuste previo (60% del ancho original). Nuevo filtro Cliente por identidad, integrado con búsqueda, fecha, pago, estado, indicadores y exportación; Limpiar también lo restablece.
- Encabezados de Facturas emitidas y Facturación mensual permiten alternar orden ascendente/descendente mediante flechas y `aria-sort`, como Inventario. Orden numérico para cantidades/importes y alfabético para texto, antes de paginar; cambiar orden reinicia la página.
- La vista agrupada conserva sus grupos y ordena sus facturas; ordenar Fecha también cambia el orden de los días. La tabla mensual ordena su presentación sin modificar el histórico que calcula variaciones.
- Archivos: `src/app/app.ts`, `src/app/app.html`, `src/app/yr-ui.css`, `src/app/invoice-analysis.spec.ts`. Sin cambios de backend ni BD.
- Validación: compilador Angular y `git diff --check` correctos; 11 pruebas de Facturas aprobadas, incluyendo clientes homónimos, orden numérico, orden de días y preservación de variación mensual. Aceptación visual del usuario pendiente.

## 034 — Panel de factura más ancho (26/09/2026)

- Panel lateral ampliado de 320 a 420 px y contenido de Cliente reducido a 140 px, con nombres largos en varias líneas.
- Se conserva la vista de una columna en pantallas de hasta 1200 px. Sin cambios de datos ni operaciones.
- Archivo: `src/app/yr-ui.css`.
- Validación: compilador Angular y revisión de espacios del diff; aceptación visual del usuario pendiente.

## 035 — Ampliación adicional del panel de factura (26/09/2026)

- Panel lateral ampliado de 420 a 540 px por solicitud del usuario; contenido de Cliente reducido de 140 a 110 px en Facturas emitidas, conservando nombres completos en varias líneas.
- Se mantiene la distribución de una columna hasta 1200 px. Sin cambios de lógica ni datos.
- Archivo: `src/app/yr-ui.css`.
- Validación: revisión de reglas responsive y `git diff --check` correctos. Aceptación visual pendiente.

## 036 — Créditos centrados en clientes (26/09/2026)

- Implementada la estructura del segundo concepto: lista de clientes con búsqueda por nombre/teléfono/ID, orden por saldo, actividad o nombre; ficha de saldo, facturas pendientes, artículos expandibles e historial.
- Se conservan PDF de cliente/factura, historial general, formulario de abonos y comprobantes. Preparar abono no registra pagos; la asignación automática existente se mantiene.
- Actividad calculada sobre historial completo por cliente, con hasta cuatro solicitudes simultáneas, estados desconocidos y protección ante respuestas obsoletas. Solo se carga al consultar Créditos. Filtro de más de dos meses calendario por cliente, nunca por factura sin evidencia.
- Adaptación del concepto a los datos reales: sin vencimientos no se muestran importes vencidos; sin almacenamiento compartido de seguimiento no se incorporan notas/promesas ni agenda ficticia. Estas ampliaciones requieren un contrato de datos persistente posterior.
- Archivos: `src/app/app.ts`, `src/app/app.html`, `src/app/yr-ui.css`, `src/app/credit-people.spec.ts`; comprobación aislada en `output/ui-concepts/creditos-review.mjs`.
- Validación: build de desarrollo y cuatro pruebas de lógica correctos. Chrome aislado con datos ficticios: búsqueda, selección, facturas, apertura del formulario de abono y vistas escritorio/móvil correctas, sin desbordamiento de página ni errores de ejecución. Sin cambios de backend/BD ni reinicio de la aplicación de escritorio. Aceptación visual de la implementación pendiente.

## 037 — Encabezado y tarjetas de Cartera de crédito (26/09/2026)

- Encabezado reducido a «Cartera de crédito»; resumen contraíble con botón de flecha, etiquetas accesibles e iconos de clientes, dinero, reloj e historial.
- Retirado «A quién atender». Cada tarjeta presenta etiqueta y fecha del último abono en la misma línea, separada del número de facturas.
- Días sin abonar a la izquierda y saldo a la derecha, con tamaño del importe incrementado un 15%.
- Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`. Sin cambios de cálculos ni pagos.
- Validación: compilador Angular y `git diff --check`. Aceptación visual pendiente.

## 038 — Alineación vertical de tarjetas de clientes (26/09/2026)

- Iniciales y saldo centrados sobre la altura completa de cada tarjeta; información y días sin abonar en la columna central.
- Se conserva el tamaño del saldo y el comportamiento de selección. Cambio limitado a `src/app/yr-ui.css`.
- Validación: revisión de la distribución CSS y `git diff --check` correctos; aceptación visual pendiente.

## 039 — Recepción rápida y seguimiento de Compras (26/09/2026)

- Recepción rápida como vista predeterminada y tablero de seguimiento por proveedor como segunda vista; historial previo sigue disponible.
- Formulario reutilizado en línea: proveedor, factura, fecha, pago, costos, lotes, productos y OCR de fotos existentes. Revisión explícita y confirmación para registrar inventario; bloqueo durante guardado.
- Borradores locales por usuario/navegador con etapas manuales, búsqueda y recuperación. Cambiar de vista/nueva compra conserva el trabajo existente; errores de almacenamiento mantienen formulario. La UI identifica claramente que no hay sincronización y no conserva imagen OCR.
- Alcance pendiente de los conceptos: pedidos compartidos con responsables, recepción parcial enlazada a pedidos, adjuntos persistentes y OCR PDF. El tablero implementado organiza borradores, no finge operaciones de proveedor.
- Archivos: `src/app/app.ts`, `src/app/app.html`, `src/app/yr-ui.css`, `src/app/purchase-workspace.spec.ts`; revisión aislada en `output/ui-concepts/compras-review.mjs`.
- Validación: cuatro pruebas correctas (persistencia, separación por usuario, revisión y fallo de almacenamiento); build de desarrollo y compilador Angular correctos. Chrome aislado: recepción inicial, guardado local, tablero de tres etapas, recuperación y móvil sin desbordamiento de página ni errores de ejecución. Aceptación visual pendiente. Sin cambios de backend/BD ni reinicio del escritorio.

## 040 — Información y presentación de Recepción rápida (26/09/2026)

- Franja de tarjetas contraíbles: compras confirmadas de hoy, borradores locales y fecha/proveedor de la última compra. Se excluyen anuladas; última compra usa fecha registrada, no una hora de recepción inventada.
- Paneles contraíbles para pendientes, inicio por foto/manual y últimas compras reales. Vacíos diferenciados de errores de compras, proveedores y catálogo, con reintento.
- Iconos SVG de paquete, documento, reloj, búsqueda, escáner, lápiz, adjunto, guardado, confirmación, avance y flechas; pasos de recepción y distribución visual más cercana al concepto.
- Conserva límites funcionales existentes: OCR de fotos, borradores locales y sin pedidos compartidos. No se incorporan datos del ejemplo como datos reales.
- Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`, `src/app/purchase-workspace.spec.ts`, `output/ui-concepts/compras-review.mjs`.
- Validación: build de desarrollo y cinco pruebas correctos; Chrome aislado con compras sintéticas verificó resumen, iconos, contraer/expandir, guardado, recuperación y móvil sin desbordamiento de página. Aceptación visual pendiente.

## 041 — Contraer el resumen de Compras en conjunto (26/09/2026)

- Un único botón de flecha junto al título oculta o muestra las tres tarjetas del resumen juntas; retirados controles individuales. Etiqueta accesible y estado expandido incluidos.
- Validación: compilador Angular y revisión del diff. Aceptación visual pendiente.

## 042 — Selector de vistas de Compras con iconos (26/09/2026)

- Recepción rápida, Seguimiento por proveedor e Historial usan iconos junto a Registrar compra, alineados en una misma fila y con la misma altura.
- Conservan estado activo, etiquetas accesibles y ayudas al pasar el cursor. Sin cambios de datos.
- Validación: compilador Angular y `git diff --check`; aceptación visual pendiente.

## 043 — Flujo unificado y detalle de compras ingresadas (27/09/2026)

- Pedidos pendientes muestran estado explícito (borrador, programado por recibir, recibido por validar) y fecha prevista independiente de la fecha de compra.
- Programar guarda proveedor, productos y entrega prevista en el borrador local, sin enviar pedidos ni ingresar inventario.
- Seguimiento e historial incluyen compras ingresadas/anuladas, búsqueda por proveedor/factura/usuario y filtro por estado. Informes anteriores se conservan plegados.
- Últimas compras abiertas por defecto; cada documento abre ficha con proveedor/contacto, factura, fecha, pago, usuario, líneas, cantidades, costos, total, estado y exportación PDF existente.
- Forma de pago compacta con iconos, etiquetas accesibles y texto de la selección junto a los datos de la compra.
- Validación: compilador Angular, build de desarrollo y siete pruebas correctos. Chrome aislado comprobó apertura de detalle y sus líneas, iconos de pago, resumen, navegación y móvil sin desbordamiento de página ni errores de ejecución. No se modificó backend/BD ni se registraron compras reales. Aceptación visual pendiente.

## 044 — Compactación del formulario de Compras (27/09/2026)

- Eliminados subtítulo y mensajes informativos sobre las tarjetas; errores de guardado permanecen en el formulario.
- Pago y Etapa en la misma fila; programación, transporte, otros costos y costo adicional en una fila de escritorio con adaptación móvil.
- OCR junto a Buscar productos; contador de seleccionados retirado. Nombre de archivo/estado OCR solo cuando existen.
- Validación: compilador Angular y `git diff --check`; aceptación visual pendiente.

## 045 — Altura compacta de tarjetas principales de Compras (27/09/2026)

- Tarjetas ajustadas a su contenido, con menor padding vertical, separación e iconos de 20 px; sin altura mínima ni estiramiento entre tarjetas.
- Validación: revisión CSS y `git diff --check`; aceptación visual pendiente.

## 046 — Calendario compacto para programar pedidos (27/09/2026)

- Programar pedido abre directamente el calendario; la fecha elegida queda integrada en el texto «Entrega: dd/mm/aaaa».
- Sin desplegable ni botón adicional. Si ya hay proveedor y productos, programa el borrador local al elegir fecha; de lo contrario conserva la selección para completar el formulario.
- Validación: compilador Angular y `git diff --check`; aceptación visual pendiente.

## 047 — Selector de productos actualizado (05/10/2026)

- Ventana Seleccionar productos de Compras alineada con Inventory 2.0: tabla clara, código separado a la izquierda, cabeceras centradas y ordenables, tres alturas de fila y acción Agregar con icono.
- Selección independiente para exportación CSV; paginación centrada 10/25/50/100 con primera/última página. Retirado límite de 80 productos; búsqueda y categoría reinician la página.
- Conserva agregar/agregar otro y los datos del borrador; adaptación móvil mediante estilos compartidos. Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`.
- Validación: compilador Angular y 14 pruebas de Compras/ModalTableState correctos; revisión visual y aceptación pendientes. Build de desarrollo terminó con código 134 en dos intentos; compilación de pruebas correcta. Sin reiniciar escritorio ni registrar compras reales.

## 048 — Planillas alineado con Inventory 2.0 (05/10/2026)

- Tema claro acotado a Planillas y Generar planilla, sin cambiar preferencias guardadas. Tarjetas compactas, resumen superior contraíble, acciones con SVG, filtros blancos, gráficos legibles y ventanas de cálculo/edición con superficies comunes.
- Histórico por empleado con búsqueda de nombre/cargo/área, ordenamiento numérico y textual, selección independiente para CSV, alturas Compacta/Normal/Amplia y paginación 10/25/50/100 centrada. Conserva empleado → mes → semana → día y acciones de edición existentes.
- Filtrar/paginar no altera totales ni bonos. No se modificaron tarifas, cálculos, servicios, backend ni BD. Generar planilla recibe estilos comunes; captura semanal conservada.
- Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`, `src/app/payroll-presentation.spec.ts`.
- Validación: compilador Angular y nueve pruebas de presentación/ModalTableState correctos; `git diff --check` correcto. Build de desarrollo termina con código 134, incluso con un worker y sin source maps. Revisión visual en navegador y aceptación pendientes. Sin reiniciar escritorio ni guardar planillas reales.

## 049 — Pago por tipo de hora en modal (05/10/2026)

- Se retira el bloque de la página de Planillas y se abre mediante icono de información junto a Modificar/Calcular planilla.
- Modal nativo con desglose, base salarial y tabla de tarifas existentes; cierre por botón, Escape o clic en el fondo, con gestión nativa de foco.
- Texto oscuro explícito en tarjetas para corregir el blanco heredado, también en Generar planilla. Corregida etiqueta Bonificaciones.
- Archivos: `src/app/app.html`, `src/app/yr-ui.css`. Sin cambios de cálculos, tarifas ni servicios.
- Validación: compilador Angular y `git diff --check` correctos. Revisión visual y aceptación pendientes; escritorio sin reiniciar.

## 050 — Filtros de Planillas con iconos (05/10/2026)

- Semana y mes usan dos iconos de calendario en la fila de acciones superiores, con tooltip y estado activo cuando existe filtro.
- Conservan selectores nativos, opciones, teclado, nombres accesibles y eventos originales; sin cambios de cálculos.
- Archivos: `src/app/app.html`, `src/app/yr-ui.css`.
- Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente. Escritorio sin reiniciar.

## 051 — Contraer tarjetas y gráfico de Planillas juntos (05/10/2026)

- El botón del resumen oculta/muestra también Tendencia de salarios, conservando el canvas y sus datos. Relación accesible del botón con ambas secciones.
- Archivos: `src/app/app.html`, `src/app/yr-ui.css`.
- Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente. Sin reiniciar escritorio.

## 052 — Campos alineados en cálculo de Planilla (05/10/2026)

- Encabezados y filas de días comparten seis columnas; cuatro campos de horas y bono semanal con ancho de 120 px y valores centrados.
- Corregida interferencia de la cuadrícula general de ocho columnas sobre el editor de seis. Etiquetas y pago diario centrados; desplazamiento horizontal local en pantallas estrechas.
- Alcance acotado al modal Calcular planilla; eventos y cálculos conservados. Archivos: `src/app/app.html`, `src/app/yr-ui.css`.
- Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente. Escritorio sin reiniciar.

## 053 — Etiquetas de horas sin duplicación (05/10/2026)

- Retiradas etiquetas Normal/Extra 1/Extra 2/Extra 3 sobre cada campo del modal Calcular planilla; títulos de la tabla conservados.
- Campos mantienen nombres accesibles con tipo de hora y día. Sin cambios de valores, eventos ni cálculos.
- Archivo: `src/app/app.html`. Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente.

## 054 — Tarjetas contraíbles en cálculo de Planilla (05/10/2026)

- Flecha junto al encabezado del modal oculta/muestra las cuatro tarjetas de cálculo en conjunto, con estado independiente del resumen principal.
- Amplía el espacio del detalle al contraer; valores y formulario conservados. Archivos: `src/app/app.ts`, `src/app/app.html`, `src/app/yr-ui.css`.
- Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente. Sin reiniciar escritorio.

## 055 — Empleados y resúmenes contraíbles (05/10/2026)

- Eliminado gráfico de pastel de Resúmenes. Se conservan importes semanal/acumulado, histórico y promedio por hora.
- Control de flecha en encabezado Empleados y resúmenes oculta/muestra ambas tarjetas en conjunto, con estado independiente del resumen principal y del modal.
- Archivos: `src/app/app.ts`, `src/app/app.html`, `src/app/yr-ui.css`. Sin cambios de cálculos.
- Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente. Escritorio sin reiniciar.

## 056 — Acciones de Planillas con iconos en barra superior (05/10/2026)

- Control de Empleados y resúmenes trasladado a botón con icono en la barra superior; retirado encabezado independiente. Conserva contraer/expandir y estado activo.
- Modificar, Calcular y resumen principal también usan botones de icono en la misma barra, junto a filtros e información; tooltips y nombres accesibles incluidos.
- Archivos: `src/app/app.html`, `src/app/yr-ui.css`. Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente.

## 057 — Encabezado simplificado de Planillas (05/10/2026)

- Título único «Modulo de Planillas»; eliminados etiqueta superior y subtítulo descriptivo.
- Botón de contraer tarjetas principales y tendencia vuelve junto al título; otras acciones permanecen en la barra superior.
- Archivo: `src/app/app.html`. Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente.

## 058 — Encabezado compacto de Planillas (05/10/2026)

- Filas de la página ajustadas al contenido en lugar de estirarse al alto disponible; elimina espacio excesivo alrededor del título al contraer los paneles.
- Padding superior de 12 px y separación de 12 px entre bloques; encabezado sin márgenes ni padding extra.
- Alcance acotado a la página principal de Planillas. Archivos: `src/app/app.html`, `src/app/yr-ui.css`.
- Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente.

## 059 — Histórico de Planillas sin subtítulo (05/10/2026)

- Eliminado texto descriptivo bajo Histórico de planillas por usuario; título y controles conservados.
- Archivo: `src/app/app.html`. Validación: eliminación exacta del párrafo y `git diff --check` correctos.

## 060 — Asistencia alineado con Inventory 2.0 (05/10/2026)

- Tema claro, título único Modulo de Asistencia, encabezado compacto y filas ajustadas al contenido. Subtítulos de secciones retirados; tarjetas y tendencia comparten flecha junto al título.
- Barra superior con semana en icono, exportación CSV funcional, editar horarios y controles independientes de horarios/horas y estadísticas. Gráfico circular retirado; indicadores de puntualidad conservados.
- Registro por empleado con búsqueda, ordenamiento, alturas Compacta/Normal/Amplia, selección/CSV y paginación 10/25/50/100. Jerarquía usuario/semana/día y agregar marca conservados; acción con icono.
- Modal de marcas y ventana de horarios usan estilos claros compartidos; fechas y horas centradas. CSV de resumen usa todas las filas sin alterar selección de la tabla.
- Archivos: `src/app/app.html`, `src/app/app.ts`, `src/app/yr-ui.css`, `src/app/attendance-presentation.spec.ts`.
- Validación: compilador Angular, nueve pruebas de presentación/ModalTableState y `git diff --check` correctos. Revisión visual y aceptación pendientes. No se cambiaron cálculos, reglas, backend ni BD; no se reinició escritorio ni se registraron marcas reales.

## 061 — Asistencia sin sección Estadísticas (05/10/2026)

- Eliminada tarjeta Estadísticas; Horas por usuario ocupa el ancho completo. Actualizada ayuda del botón que muestra/oculta este panel.
- Archivos: `src/app/app.html`, `src/app/yr-ui.css`. Cálculos y registros conservados.
- Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente.

## 062 — Paneles auxiliares de Asistencia contraíbles sin huecos (05/10/2026)

- Horarios de planilla y Horas por usuario se retiran del layout al contraer, mediante sus botones de icono existentes en la barra superior.
- Botones resaltan cuando el panel está visible; filas sin altura reservada, márgenes ni altura mínima adicional. Datos y edición conservados.
- Archivos: `src/app/app.html`, `src/app/yr-ui.css`. Validación: compilador Angular y `git diff --check` correctos; aceptación visual pendiente.

## 063 — Paneles cerrados por defecto e iconos Lucide (05/10/2026)

- Asistencia y Planillas inician y restablecen sus paneles contraíbles cerrados al ingresar, incluidos detalles por usuario/semana/mes. Tarjetas del modal Calcular planilla también cerradas al abrir.
- Migrados SVG manuales de ambos módulos a directivas de `@lucide/angular`: navegación, filtros, acciones, densidad, edición y notificaciones; 27 elementos SVG del alcance verificados como Lucide. Sin dependencias nuevas.
- Cálculos, selección de semana, datos y acciones conservados. Archivos: `src/app/app.ts`, `src/app/app.html`, pruebas de presentación de Asistencia/Planillas.
- Validación: compilador Angular, seis pruebas (incluido reingreso tras expandir) y `git diff --check` correctos; aceptación visual pendiente. Escritorio sin reiniciar.

## 064 — Configuración, Usuarios y accesos (05/10/2026)

- Tema claro, títulos compactos, Lucide y control de contraer en Configuración; Usuarios y Respaldos con búsqueda, estado, ordenamiento, densidad, selección/CSV y paginación.
- Usuarios permite alta, edición, reactivación y baja lógica con confirmación. Perfiles Administrador, Operador y Consulta y ajustes individuales por módulo, según diseño confirmado por el usuario.
- Backend valida accesos en HTTP e IPC con sesiones de 12 horas; scrypt para nuevas contraseñas, auditoría sin secretos y protección del último administrador. Menú y navegación actualizan permisos; requiere login nuevo para sesiones legadas.
- Migración aditiva 024 y esquema empaquetable, sin alterar referencias históricas. Documentación funcional, arquitectura y BD actualizada.
- Validación: compilador Angular, diez pruebas backend, seis frontend y revisión de sintaxis/diff. Pendientes: prueba SQL real (conexión ESOCKET), revisión visual y aceptación; migración sin aplicar y escritorio sin reiniciar.

## 065 — Configuración visible y Lucide (05/10/2026)

- Corregido acceso base de Operador/Consulta a preferencias de Configuración (lectura). Usuarios sigue administrativo; permisos individuales explícitos y validación backend conservados.
- Icono lateral Lucide Settings explícito debajo de Histórico, reemplaza imagen SVG CSS.
- Validación: compilador Angular, pruebas de perfiles y usuarios; revisión visual pendiente. Sin reiniciar escritorio.

## 066 — Pestaña Usuarios visible (05/10/2026)

- Usuarios aparece siempre dentro de Configuración; muestra perfil actual y requisito administrativo si falta acceso. CRUD y consulta del directorio siguen protegidos.
- Validación: compilación Angular y prueba de navegación sin solicitudes privilegiadas; revisión visual pendiente. Escritorio sin reiniciar.

## 067 — Modal de edición de usuarios y permisos (05/10/2026)

- Alta/edición y accesos en modal superpuesto; lista de usuarios conserva tamaño y estado. Cierre por botón, Cancelar, fondo o Escape; foco de teclado contenido, bloqueo durante guardado y errores dentro del formulario.
- Validación: compilador Angular y diff; revisión visual pendiente. Backend y permisos conservados; escritorio sin reiniciar.

## 068 — Diseño compacto del editor de usuarios (05/10/2026)

- Cabecera con identidad/perfil y pie de acciones siempre visibles; datos de cuenta separados de permisos, estado alineado y ayuda contextual de contraseña.
- Permisos en filas compactas con tres botones Lucide, leyenda, nombres accesibles y estado seleccionado. Admin y módulo Usuarios conservan restricciones; adaptación a móvil.
- Validación: compilador Angular y diff correctos; revisión visual pendiente. No se reinició escritorio ni se modificó backend.

## 069 — Finanzas y submódulos UI 2.0 (05/10/2026)

- Costos, Caja chica, Finanzas y Ventas y rentabilidad con tema claro compartido, títulos compactos y controles Lucide; modales claros de alta, edición y baja.
- Resumen de tarjetas y gráficos contraíble junto al título. Costos operativos, análisis de rentabilidad, ranking/productos/clientes y reportes controlados desde iconos de barra superior. Paneles/detalles cerrados al ingresar, sin reservar huecos; gráfico circular retirado.
- Ocho tablas con búsqueda, filtros, ordenamiento, selección/CSV, densidad y páginas 10/25/50/100. Fuente completa de datos conservada; jerarquía financiera y acciones de registros existentes mantenidas.
- Corregidos encabezados desalineados del historial de cambios de costo; contraste de ejes y paleta de gráficos ajustados al tema claro.
- Validación: compilador Angular, 12 pruebas de presentación/ModalTableState y diff correctos. Revisión visual y aceptación pendientes; cálculos, backend y BD conservados, escritorio sin reiniciar.

## 070 — Navegación lateral moderna (05/10/2026)

- Iconos Lucide en todos los módulos, grupos y acciones del menú; etiquetas con acentos y tipografía consistente, identidad compacta y estado activo con indicador lateral.
- Despliegues suaves con grid, controles aria-expanded/aria-controls e inert al cerrar; movimiento reducido respetado. Menú compacto mantiene grupos accesibles y permite abrirlos; tooltips por teclado y mouse.
- Perfil y acciones de cuenta compactos; navegación, permisos y preferencia de ancho conservados.
- Validación: compilador Angular, pruebas de comportamiento del menú y diff; revisión visual pendiente. Escritorio sin reiniciar.

## 071 — Contraste del menú sobre blanco (05/10/2026)

- Texto oscuro y seminegrita, iconos con mayor contraste y trazo reforzado; activo verde profundo, flechas y botón de contraer legibles. Alcance: menú claro de Inventory 2.0.
- Validación: revisión de especificidad CSS, contraste de colores y diff correctos; aceptación visual pendiente. Navegación conservada, escritorio sin reiniciar.

## 072 — Menú oscuro en todos los módulos (05/10/2026)

- Fondo oscuro uniforme #1f2937 en menú lateral expandido/contraído, también en Facturación e Inventario. Texto, iconos, selección y menú de cuenta mantienen contraste claro.
- Tema del contenido y navegación conservados. Validación: especificidad CSS y diff correctos; aceptación visual pendiente. Escritorio sin reiniciar.

## Próximo registro

El siguiente cambio independiente se documentará como **073**.

Validación del registro 006: Chrome aislado con 125 productos y 24 códigos armados simulados; comprobadas páginas de 10 y 25, búsqueda con un resultado, selección y cancelación del diálogo de inactivación. Ventanas de alta, inactivos, códigos armados y Kardex abiertas sin errores de ejecución. No se escribieron datos reales.
