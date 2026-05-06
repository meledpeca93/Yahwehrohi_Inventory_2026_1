# Base de datos

Scripts iniciales para preparar la base de datos del sistema.

## SQL Server

Usar este script si estas trabajando desde Azure Data Studio o SQL Server:

```sql
database/migrations/001_create_users_sql_server.sql
```

La tabla se llama `usuario` porque ese es el nombre usado por la base de datos actual.

## MySQL/MariaDB

Usar este script si luego decides trabajar con MySQL o MariaDB:

```sql
source database/migrations/001_create_users.sql;
```

## Campos principales

- `usuario`: nombre de usuario para iniciar sesion.
- `pass` o `password_hash`: contrasena del usuario.
- `rol`: permiso base dentro del sistema.
- `activo`: permite bloquear usuarios sin eliminarlos.
- `ultimo_acceso`: fecha y hora del ultimo inicio de sesion.
- `creado_en` y `actualizado_en`: auditoria basica.

La tabla SQL Server actual usa `pass` en texto plano para coincidir con la base existente. Antes de pasar a produccion, conviene migrar a `password_hash` y validar con un algoritmo seguro como `bcrypt` o `argon2`.

## Clientes en SQL Server

Usar este script para crear la tabla `cliente` o agregar la columna `saldo` si aun no existe:

```sql
database/migrations/002_create_clientes_sql_server.sql
```

- `saldo`: saldo pendiente del cliente cuando tiene un credito abierto.

## Planilla en SQL Server

Usar este script para crear el procedimiento que calcula planilla semanal desde `dbo.ASISTENCIA`:

```sql
database/migrations/003_create_payroll_calculation_procedure_sql_server.sql
```

El procedimiento creado es `dbo.sp_calcular_planilla_desde_asistencia` y devuelve:

- detalle diario por empleado con horas normales, extra 1 y extra 3
- resumen semanal por empleado con total de horas y salario semanal

Nota:
- en este script el viernes se calcula igual que lunes a jueves, porque el requerimiento recibido no definio una regla distinta para viernes

## Alertas de aumento de costo en SQL Server

Usar este script para crear el historial mensual de costos por producto, la tabla de alertas y el procedimiento que se ejecuta al iniciar sesion:

```sql
database/migrations/004_create_cost_increase_tracking_sql_server.sql
```

Este script crea:

- `dbo.HISTORICO_COSTO_PRODUCTO`: snapshot mensual del costo, precio de venta y stock por producto
- `dbo.ALERTA_AUMENTO_COSTO_MENSUAL`: productos cuyo `precio_costo` subio respecto al mes anterior
- `dbo.sp_registrar_aumentos_costo_ultimo_mes`: procedimiento que captura el snapshot actual y recalcula las alertas del mes

Nota:
- la primera vez que se instala no habra comparativo si no existe snapshot del mes anterior
