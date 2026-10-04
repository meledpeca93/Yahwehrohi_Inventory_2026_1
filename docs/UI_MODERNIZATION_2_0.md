# Modernizacion visual 2.0 — Login y Facturacion

Fecha inicial: 2026-09-20. Revision y base clara: 2026-09-21. Rama de trabajo: `version-2.0`.

## Alcance y archivos

- `src/app/app.html`: presentacion del Login y Facturacion; SVG lineales, estados ARIA, total basado en `cartTotal()` existente y clase condicional de layout movil.
- `src/app/app.ts`: incorpora `yr-ui.css` y un signal de visibilidad de contrasena. Los metodos operativos no cambian.
- `src/app/yr-ui.css`: tokens de color, superficies, radios y sombras `--yr-*`; estilos opt-in mediante `.yr-ui`, con adaptacion de clases existentes de Facturacion. Variantes primary/secondary/success/danger/ghost, controles de icono, focus-visible, hover, pressed, disabled y reduced-motion. La configuracion de tema del usuario permanece guardada; estas dos pantallas usan la nueva paleta clara local. El atributo visual `yr-light` evita interferencias de los temas anteriores mientras Facturacion esta visible; los otros modulos conservan su tema y no se migran en esta etapa.
- `docs/CURRENT_STATE.md`, `docs/CHANGELOG_CODEX.md` y este documento: alcance y validacion.

No se agregaron dependencias. Se utiliza SVG nativo y la pila Inter/system-ui existente, sin descargar fuentes externas. `app.css` y `styles.css` permanecen intactos. Hay excepciones localizadas con `!important` para neutralizar declaraciones heredadas que ya lo utilizan; el resto de la hoja evita esa tecnica, salvo el override de accesibilidad para movimiento reducido.

## Preservacion funcional

Las ocho acciones superiores del formulario usan iconos en una sola fila: nueva factura, efectivo, credito, transferencia, cargar CSV, cotizaciones, guardar cotizacion y limpiar. Sus nombres se muestran mediante tooltip al pasar el cursor o enfocar con teclado; se mantienen `aria-label`, `title`, pago seleccionado, disabled y estado de guardado. Se reutilizan SVG lineales y el acento visual de la factura.

Se mantienen el selector de usuarios, submit y autenticacion; busqueda y referencia `#billingSearchInput`; Enter del escaner; altas al carrito, cantidades, precios, subtotales, utilidad, recibido y vuelto; metodos de pago, facturas abiertas, cotizaciones, CSV, favoritos, cintas NUEVO/OFERTA/PROMOCION y todas las acciones existentes.

El total destacado presenta el mismo `cartTotal()` sin introducir descuentos ni impuestos nuevos. La animacion de modales se limita a la entrada: la salida sigue siendo inmediata porque los bloques `@if` desmontan el DOM. No se alteraron los cierres para introducir demoras.

Los controles preexistentes «Recordarme» y «Olvide mi contrasena» se conservan como estaban: no se implemento persistencia ni recuperacion nueva, ni registro de usuarios.

## Validacion

- Compilacion al terminar Login y Facturacion, y compilacion final con `npm run build`.
- El sandbox terminaba la compilacion con codigo 134 sin diagnostico; ejecutada fuera del sandbox compila correctamente.
- Advertencias previas: `app.css` de 325.63 kB supera el aviso de 320 kB; Tesseract CommonJS. No se modificaron presupuestos ni configuracion de build.
- Comparacion automatizada con HEAD de todos los eventos, referencias/IDs y bindings `value`, `checked`, `disabled`, `step`: ninguno eliminado.
- Chrome headless con perfil temporal y servidor local de datos simulados, sin proxy hacia el API real. Verificacion visual de Login y Facturacion a 1440 × 1000 y 390 × 844; sin desbordamiento horizontal del documento. Comprobacion de visibilidad de contrasena y foco del buscador al cargar/agregar producto.
- Con seis productos simulados: agregar producto actualiza el total; aumentar/disminuir cantidad devuelve 2/1; crear segunda factura y volver a la primera conserva su linea; introducir codigo + Enter agrega el producto y mantiene foco; abrir/cerrar modal de clientes funciona; `prefers-reduced-motion` produce transicion de `0s`.
- No se ejecutaron ventas reales, impresiones, autenticacion real ni operaciones de BD. La aceptacion final con lector fisico, impresora y datos reales corresponde a la revision funcional del usuario en desarrollo.

## Continuacion posible

Trabajar primero sobre esta base clara y refinarla con la revision del usuario. La adopcion en otros modulos y la incorporacion de otros temas se posponen expresamente. Las preferencias globales y el resto de las pantallas mantienen su implementacion actual.

## Auditoria de la solicitud — 2026-09-21

| Area | Resultado |
| --- | --- |
| Tema y tokens | Base clara; texto, superficies, acento, colores semanticos y sombras; estados de peligro/advertencia legibles. |
| Login | Presentacion clara, campos con iconos, label de contrasena explicito y estados existentes preservados. |
| Buscador | Pill, icono visible incluso con foco, halo y elevacion sutil; misma referencia y captura de Enter. |
| Productos | Nombre sin truncado, precio destacado, costo conservado con tooltip, stock/margen y cintas existentes. Cinta NUEVO con mayor contraste. |
| Carrito | Etiquetas de precio, cantidad y subtotal; controles compactos y accion de eliminar semantica. |
| Totales | Mismo calculo; recibido, vuelto y utilidad preservados. No se inventan descuentos ni impuestos. |
| Acciones | Ocho iconos en una fila, tooltip hover/teclado, loading y disabled; corregida la cascada CSS que ocultaba la seleccion del pago. |
| Modales | Panel claro y overlay, encabezados legibles, tabla de clientes y botones; animacion de entrada sin retrasar cierres funcionales. |
| Accesibilidad | Focus-visible, nombres accesibles, estado seleccionado con borde ademas de color, reduced-motion y alertas anunciadas. |
| Limites | Solo HTML/CSS y documentacion en esta revision; TS sin cambios. Sin migrar Inventario, Compras u otros modulos. |

Verificacion adicional: paleta computada `yr-light`, ocho botones con igual coordenada vertical en escritorio y movil, metodo de pago con `aria-pressed=true` y borde/halo visibles; eventos, IDs y bindings comparados contra el estado anterior a esta revision sin eliminaciones.
