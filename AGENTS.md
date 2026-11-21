# AGENTS.md — Instrucciones para agentes de IA en este módulo

Este repo es un **módulo de la plataforma**. Corre detrás del gateway en `/m/<id>/`, recibe un
JWT de plataforma por request y lo gobierna Sistemas.

## Cómo trabajar

- Una historia o incidente por PR. Tests primero: escribí el test del criterio de aceptación y después el código.
- Antes de abrir el PR corré `pnpm verify` (copia de auth, lint, tipos, tests, build). Si falla, corregilo.
- Si la CI falla, descargá el artefacto `resumen-ci` (`resumen-ci.json`) y corregí **solo** lo que indica:
  trae política, archivo, línea y sugerencia.
- Commits en formato Conventional Commits. Completá "Asistencia de IA" en la descripción del PR:
  sin eso la CI no pasa (GOB-06).

## Dónde va cada cosa

```
modulo.yaml         id, versión y roles del módulo (lo cambia Sistemas)
src/api/            rutas Fastify: esquema Zod de entrada y rol mínimo en cada endpoint
src/dominio/        reglas de negocio puras, sin Fastify ni base de datos
src/datos/          acceso a datos: repositorio en memoria y en Postgres, consultas parametrizadas
migraciones/        SQL numerado (0001_descripcion.sql); lo aplica el deployer antes de cada despliegue
src/vendor/         copia de @plataforma/auth: NO SE EDITA (la CI lo verifica)
tests/unit/         tests del dominio y la configuración
tests/contract/     401/403, Problem Details y validación de entradas
docs/               funcional, técnica, ADRs, permisos y runbook
```

## Reglas obligatorias

1. **Toda ruta nueva va en `src/api/` con `exigir('<rol>')` y `config: { rateLimit: LIMITE }`.** El rol tiene que
   estar en `modulo.yaml` (si no, el módulo no arranca); sin el límite, CodeQL bloquea el PR en los endpoints que
   acceden a archivos o a la base.
2. **Toda entrada se valida con Zod** (`.strict()` en los cuerpos). Errores en Problem Details, sin stack traces.
3. **P1:** configuración solo por variables de entorno, en `src/config.ts`. Nada de URLs, hosts, IDs ni secretos en el código.
4. **P7 — repo público:** nunca datos reales, emails, nombres de sistemas internos ni información corporativa.
5. **Logs** con el logger de Fastify (`req.log`) y `correlationId`; `console.*` está prohibido. Nunca loguear tokens ni datos personales.
6. **Dependencias:** solo las necesarias, con versión exacta.
7. **Datos de otros módulos:** solo por sus APIs. Nunca conectarse a bases de otros módulos ni a sistemas corporativos.
8. **Base de datos:** consultas siempre parametrizadas (`$1`, `$2`), nunca SQL armado con texto del usuario.
   Los cambios de esquema van en una migración **nueva** (`migraciones/000N_descripcion.sql`): no se editan
   las ya aplicadas (el runner lo detecta y falla). Tienen que ser compatibles con la versión anterior, que
   sigue atendiendo mientras se aplican: agregar columnas nullable o con default sí; borrar o renombrar
   columnas que usa la versión anterior, no (se hace en dos despliegues).

## Prohibido para la IA

- Modificar `src/vendor/`, `.github/`, `modulo.yaml` o `CODEOWNERS`: proponelo en el PR y lo hace Sistemas.
- Desactivar tests, bajar umbrales de cobertura, agregar excepciones de lint o `// @ts-ignore`.
- Leer o crear archivos `.env`, `secrets/` o credenciales.
- Mergear, aprobar o desplegar.
