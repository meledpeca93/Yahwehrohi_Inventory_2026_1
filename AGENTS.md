# AGENTS.md

Guia corta para futuros agentes Codex en este proyecto.

## Orden de lectura

1. Leer este archivo primero.
2. Consultar `docs/CURRENT_STATE.md`.
3. Consultar `docs/ARCHITECTURE.md` solo si la tarea requiere arquitectura.
4. Consultar `docs/MODULES.md` para ubicar el modulo afectado.
5. Consultar `docs/DATABASE.md`, `docs/BUSINESS_RULES.md` o `docs/PERFORMANCE.md` solo cuando sean relevantes.

## Reglas de trabajo

- No analizar todo el repositorio automaticamente al comenzar.
- Inspeccionar primero solo el modulo y archivos directamente relacionados.
- Ampliar busqueda solo si hay una dependencia real o si `/docs` no coincide con el codigo.
- No revertir cambios existentes sin solicitud explicita.
- Despues de cambios importantes actualizar `docs/CURRENT_STATE.md`.
- Al completar una funcionalidad agregar una entrada breve a `docs/CHANGELOG_CODEX.md`.
- Si cambia arquitectura, actualizar `docs/ARCHITECTURE.md`.
- Si cambia una regla funcional, actualizar `docs/BUSINESS_RULES.md`.
- Si cambia base de datos, actualizar `docs/DATABASE.md`.
- Si cambia una optimizacion importante, actualizar `docs/PERFORMANCE.md`.
  
