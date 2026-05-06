# YahwehRohiInventory

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.6.

## Project documentation

- `docs/SISTEMA_DOCUMENTACION.md`: mapa operativo del proyecto por seccion, datos, conexiones, procedimientos y lugar donde se muestra cada dato.
- `docs/CONSULTAS_BASE_DATOS.md`: consultas principales de `server/data-access.js`, tablas usadas, datos generados y pantallas que consumen cada resultado.
- `database/migrations/005_install_auditoria_triggers_sql_server.sql`: instalador de auditoria automatica para registrar movimientos de base de datos en `dbo.auditoria`.
- `database/migrations/006_create_operational_costs_sql_server.sql`: costos operativos y columnas de costo real de compra para prorratear transporte por unidad.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
