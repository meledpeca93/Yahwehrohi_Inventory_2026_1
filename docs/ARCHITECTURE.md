# Architecture

## Tecnologias reales

- Frontend: Angular standalone 21.x, TypeScript 5.9, señales de Angular, templates con control flow `@if`, `@for`, `@case`.
- Backend HTTP: Express 5 en `server/server.js`.
- Base de datos: SQL Server via paquete `mssql`, configurado en `server/db.js`.
- Desktop: Electron 37. El renderer usa `window.electronAPI` expuesto por `electron/preload.js`; `electron/main.js` registra handlers IPC.
- Graficas: Chart.js.
- OCR: Tesseract.js para compras/facturas.
- Imagenes: archivos en `src/img`, miniaturas en `public/product-thumbnails`, y soporte de imagen local legado.

## Frontend

- La aplicacion principal vive casi completa en `src/app/app.ts`, `src/app/app.html` y `src/app/app.css`.
- La navegacion funcional usa el signal `activePage`, no rutas Angular por modulo.
- Paginas identificadas en `Page`: `dashboard`, `billing`, `invoices`, `purchases`, `credits`, `costs`, `financial-movements`, `petty-cash`, `sales-profitability`, `system-health`, `history`, `inventory-sheet`, `inventory-out-of-stock`, `attendance`, `payroll`, `payroll-generate`.
- Existe un primer servicio modular frontend para Facturacion: `src/app/modules/facturacion/services/facturacion-api.service.ts`.
- Componente compartido comprobado: `src/app/features/shared/product-image/product-image.component.ts`.

## Backend

- `server/server.js` concentra rutas HTTP, resolucion de imagenes y wiring de dependencias.
- `server/data-access.js` concentra la mayoria del acceso a datos, validaciones transaccionales y queries SQL.
- `server/modules/facturacion/` es la primera separacion modular real:
  - `facturacion.routes.js`
  - `facturacion.controller.js`
  - `facturacion.service.js`
  - `facturacion.repository.js`
  - `facturacion.dto.js`
- `server/server.js` monta el router modular de Facturacion y tambien mantiene rutas legacy/directas.

## Comunicacion frontend/backend

- En navegador/dev server Angular usa HTTP relativo (`/api/...`) con `proxy.conf.json`.
- En Electron el frontend prefiere `window.electronAPI` cuando existe.
- Muchos metodos frontend tienen doble camino: IPC Electron o HTTP REST.
- Facturacion ya usa `FacturacionApiService` para `GET /api/billing/products` y `POST /api/sales`.

## Autenticacion

- Login por `POST /api/auth/login` y handler IPC `auth:login`.
- `loginUser` valida contra `dbo.usuario`.
- El usuario actual se conserva en el signal `currentUser` y en `localStorage`.
- Las escrituras envian `userId` y/o `user` para auditoria. No se encontro middleware HTTP de autorizacion por rol; los permisos visibles dependen principalmente del frontend y de parametros enviados.

## Estructura actual

- `src/app/`: UI Angular principal.
- `src/app/modules/facturacion/`: servicio frontend modular de Facturacion.
- `src/app/features/shared/`: componentes compartidos.
- `server/`: API Express, conexion DB y acceso a datos.
- `server/modules/facturacion/`: backend modular de Facturacion.
- `electron/`: shell desktop e IPC.
- `database/migrations/`: scripts SQL Server y algunos scripts legacy.
- `docs/`: documentacion tecnica operativa.

## Convenciones importantes

- Producto activo/inactivo se controla con `dbo.producto.activo`.
- La relacion producto-inventario se hace por `codigo` en listados principales; algunas migraciones legacy tambien usan `id_inventario = id_producto`.
- Las operaciones criticas usan transacciones SQL (`new sql.Transaction(pool)`).
- Auditoria reutiliza `insertAuditRecord` y, antes de escribir, puede usar `setAuditContext`.
- Movimientos de inventario operativos se registran en `dbo.INVENTARIO_LOG` mediante `insertInventoryLogRecord`.
- FEFO usa `dbo.PRODUCTO_LOTE` y `dbo.VENTA_LOTE_DETALLE`.
