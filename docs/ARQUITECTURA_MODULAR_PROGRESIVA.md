# Arquitectura modular progresiva

## Estado actual

El frontend es una aplicacion Angular standalone. La navegacion funcional aun vive en `App` por medio de `activePage`, no en rutas de Angular.
El backend es Express con SQL Server y Electron IPC. La mayor parte del acceso a datos sigue concentrada en `server/data-access.js`.

## Modulos objetivo

- `facturacion`: venta, catalogo ligero, carrito, factura, formas de pago y actualizacion visual de stock.
- `inventario`: productos, existencias, lotes, stock minimo/maximo, kardex y ajustes.
- `compras`: proveedores, facturas de compra, costos, ingreso de mercaderia y OCR.
- `creditos`: cuentas por cobrar, abonos, saldos y estados de cuenta.
- `planillas`: asistencia, empleados, salarios, deducciones e historial de pago.
- `clientes`: busqueda, alta, edicion e historial comercial.
- `proveedores`: busqueda, alta, edicion y relacion con compras.
- `reportes`: exportacion PDF/CSV/Excel y analitica pesada.
- `usuarios-seguridad`: autenticacion, usuarios, roles y permisos.
- `configuracion`: preferencias visuales, sistema y mantenimiento.

## Primera migracion aplicada

Facturacion queda separada en:

- Frontend: `src/app/modules/facturacion/services/facturacion-api.service.ts`
- Backend: `server/modules/facturacion/facturacion.controller.js`
- Backend: `server/modules/facturacion/facturacion.dto.js`
- Backend: `server/modules/facturacion/facturacion.repository.js`
- Backend: `server/modules/facturacion/facturacion.routes.js`
- Backend: `server/modules/facturacion/facturacion.service.js`

El modulo consume `GET /api/billing/products`, un catalogo ligero para vender, y `POST /api/sales`, que ahora devuelve stock actualizado de los productos vendidos.

## Reglas de carga

Facturacion carga:

- catalogo ligero de productos;
- clientes;
- siguiente numero de factura;
- alertas operativas visibles en facturacion.

Facturacion ya no carga al entrar:

- compras;
- auditoria/historico;
- planillas/asistencia;
- analitica pesada de rentabilidad.

Despues de facturar no se recarga `GET /api/products`. El stock se actualiza en memoria con `updatedProducts`.

## Pendiente

La extraccion completa de vistas requiere partir `src/app/app.html` y `src/app/app.ts` por pagina. Debe hacerse por modulo, empezando por Facturacion, para evitar romper cientos de bindings en una migracion masiva.
