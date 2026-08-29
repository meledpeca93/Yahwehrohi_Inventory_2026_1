# YR Recovery Tool

Herramienta externa para diagnosticar y recuperar el proyecto cuando no compila, no inicia o queda bloqueado despues de cambios de desarrollo.

## Ejecutar

Desde la raiz del proyecto:

```bat
YR-Recovery-Tool.cmd
```

Tambien puedes usar:

```bat
npm run recovery
npm run health-check
node recovery\yr-recovery-tool.js health-check
```

## Menu

```text
YR RECOVERY TOOL

[1] Verificar sistema
[2] Intentar reparacion segura
[3] Iniciar sistema
[4] Reiniciar sistema
[5] Crear punto de restauracion
[6] Ver puntos de restauracion
[7] Restaurar ultima version estable
[8] Ver logs
[9] Verificar base de datos
[0] Salir
```

## Flujo recomendado

Antes de cambios importantes:

1. Ejecuta `YR-Recovery-Tool.cmd`.
2. Usa `[5] Crear punto de restauracion`.
3. Marca el checkpoint como estable solo si supera `health-check`.

Despues de cambios:

1. Ejecuta `npm run health-check`.
2. Si pasa, crea checkpoint y marcalo estable.
3. Si falla, usa `[2] Intentar reparacion segura`.
4. Si sigue fallando, usa `[7] Restaurar ultima version estable`.

## Que valida `health-check`

- `npm run build`.
- Backend Express inicia y responde `/api/health`.
- Frontend Angular inicia y responde en `http://127.0.0.1:4200`.
- SQL Server responde usando `server/test-db-connection.js`.
- Archivos principales de configuracion existen.
- Logs recientes no muestran errores criticos obvios.

## Reparaciones seguras

La opcion `[2]` puede:

- ejecutar `npm install` si faltan dependencias;
- limpiar `.angular/cache` y `dist`;
- detener procesos Node/Electron del propio proyecto;
- recompilar.

No modifica codigo fuente para adivinar correcciones.

## Checkpoints y restauracion

Los checkpoints usan Git:

- nombre: `checkpoint_YYYY-MM-DD_HHMM`;
- se registra metadata en `recovery/checkpoints.json`;
- una version estable solo se marca despues de superar `health-check`;
- antes de restaurar una version estable, la herramienta crea un checkpoint de respaldo del estado actual.

La restauracion usa `git reset --hard <commit>` solo despues de confirmacion. No elimina archivos no versionados y no toca la base de datos.

## Base de datos

La herramienta solo verifica SQL Server y muestra el ultimo `.bak` detectado.

La restauracion de base de datos sigue siendo responsabilidad del modulo de Backup/Restore de la aplicacion. Nunca se hace rollback de codigo y base de datos al mismo tiempo de forma automatica.

## Logs

Toda accion se registra en:

```text
recovery/logs/
```

Los logs incluyen fecha/hora, comando o accion, resultado y checkpoint involucrado cuando aplica. No se imprimen contrasenas ni valores secretos de `.env`.
