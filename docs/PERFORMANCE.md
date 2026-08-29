# Performance

## Facturacion

- Facturacion fue separada parcialmente para usar un catalogo ligero.
- `GET /api/billing/products` llama `getBillingProducts`, que selecciona menos campos que `GET /api/products`.
- `getBillingProducts` filtra `p.activo = 1` y evita joins pesados de ventas del mes anterior, lotes resumen y proveedor.
- `FacturacionApiService` centraliza carga de catalogo y creacion de venta.
- Despues de `POST /api/sales`, el backend devuelve `updatedProducts` con `productId` y `stock`.
- El frontend debe actualizar esos stocks en memoria; no debe recargar todo `GET /api/products` despues de facturar.

## Catalogo de productos

- `GET /api/products` es el catalogo completo de inventario, mas pesado que Facturacion.
- Incluye ventas del mes anterior y resumen de lotes activos.
- Debe usarse para Inventario, no como refresco automatico de Facturacion.

## Imagenes y miniaturas

- Las imagenes se resuelven desde `src/img`, rutas locales permitidas y `public/product-thumbnails`.
- `server/server.js` mantiene cache de nombres de archivos de `src/img` en `imageAssetFileNamesCache`.
- Endpoint de miniaturas: `GET /api/product-image-thumbnails/:source/:fileRef`.
- Si `sharp` esta disponible, se usa para procesar imagenes; hay fallback para Windows con `System.Drawing`.
- No reemplazar miniaturas por carga directa de imagenes pesadas en listas sin revisar impacto.

## Consultas y cargas diferidas

- Facturacion ya no debe cargar al entrar compras, auditoria/historial, planillas/asistencia ni analitica pesada.
- Dashboard y analitica tienen endpoints dedicados bajo `/api/dashboard/*`, `/api/analytics/*` y `/api/costs/*`.
- Alertas de productos por vencer usan tabla auxiliar `dbo.PRODUCTO_PROXIMO_VENCER` recalculada por procedimiento.

## Estado en memoria

- El frontend mantiene productos en el signal `products`.
- Facturacion, carrito y sesiones de factura usan signals en `src/app/app.ts`.
- Inactivar producto remueve el producto de `products` sin recargar toda la app.
- Reactivar producto remueve el registro de `inactiveProducts`, agrega/actualiza el producto en `products` y marca `billingCatalogLoaded = false` para que Facturacion refresque su catalogo ligero cuando lo necesite.
- Compras/rebajas rapidas actualmente hacen `fetchProducts()` despues de guardar; no confundir ese flujo con la optimizacion de venta.

## Decisiones que no deben revertirse accidentalmente

- Mantener `GET /api/billing/products` para Facturacion.
- Mantener `POST /api/sales` devolviendo `updatedProducts`.
- No cambiar Facturacion para mostrar productos inactivos.
- No usar el catalogo completo de Inventario como dependencia obligatoria de Facturacion.
- No reintroducir recarga pesada de `GET /api/products` al reactivar; usar el producto devuelto por `PUT /api/products/:productId/reactivate`.
- No eliminar la resolucion de miniaturas/cache de imagenes sin reemplazo equivalente.
