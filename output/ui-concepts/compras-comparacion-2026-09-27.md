# Comparación de Compras con el concepto aprobado

Referencia: compras-opcion-1-recepcion.png. Se respetan las correcciones posteriores: selector de vistas mediante iconos alineados con Registrar compra y colapso conjunto de las tres tarjetas.

## Coincidencias

- Recepción rápida predeterminada, listado lateral de borradores y formulario a la derecha.
- Tres indicadores con datos de compras y borradores; control único para ocultar/mostrar el conjunto.
- Iconos de vistas con nombres accesibles, estado activo y alineación con Registrar compra.
- Acciones de foto OCR, registro manual, guardado de borradores y revisión previa a confirmar.
- Estados de carga, errores y listas vacías explícitos.

## Diferencias pendientes

- Indicadores en tarjetas separadas; el concepto usa una franja unificada más compacta.
- La tabla conserva vencimiento/costo real; no tiene la comparación con último costo ni alerta porcentual y confirmación de costo revisado.
- No hay campo de total del comprobante ni validación de coincidencia con el total calculado.
- La búsqueda de productos abre un selector separado; faltan el buscador integrado y Crear producto dentro de la recepción.
- Lotes/vencimientos no están en una sección plegable independiente como en el concepto.
- Los borradores no muestran la barra de progreso ni los motivos concretos de pendientes del concepto.
- El encabezado del formulario muestra Etapa en vez de la hora del último guardado.
- OCR acepta fotos, no PDF; archivos no se conservan al recuperar borradores.
- Borradores locales por usuario/navegador, no compartidos entre equipos.
- Tipografía, espacios, altura del formulario y algunos iconos aún difieren. No corresponde describir la implementación como calcada.

Los importes y proveedores de las capturas de validación son simulados. No se verifica la base de datos real ni se registran compras durante esta revisión.
