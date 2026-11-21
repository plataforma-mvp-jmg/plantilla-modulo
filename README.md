# plantilla-modulo

Plantilla homologada de los módulos de la plataforma (MVP, datos sintéticos). Cada módulo nuevo
nace de este repo (*template repository*) y hereda sus controles.

## Qué trae

- **Límite de pedidos** por usuario en toda la API (429 al superarlo).
- **API Fastify** con el contrato de módulos: `/health`, `/ready` y `/meta` sin autenticación; todo
  lo demás bajo `/m/<id>/` exige el JWT de plataforma y un rol por endpoint.
- **`modulo.yaml`:** id, versión y roles. Un endpoint que pide un rol no declarado impide arrancar.
- **Verificación del JWT** con una copia de `@plataforma/auth` en `src/vendor/`, protegida por hash
  (`pnpm vendor:check`).
- **CI** que llama al workflow reutilizable de la plataforma (`modulo-pr.yml`) fijado por SHA:
  copia de auth, lint, tipos, tests con cobertura, build, **políticas** (`policy-check`), secretos
  (gitleaks) y dependencias (osv-scanner). `resumen` es el check obligatorio.
- **Gobierno:** CODEOWNERS al team `sistemas`, ruleset `github/rulesets/main-modulo.json`,
  `AGENTS.md` para asistentes de IA y plantilla de PR.
- **Dockerfile** con usuario no root y health check; la imagen se publica sola al mergear en `main`.

## Cómo correrlo

Requisitos: Node 26 y pnpm (`corepack enable pnpm`).

```bash
pnpm install
pnpm verify        # copia de auth, lint, tipos, tests y build
pnpm dev           # http://127.0.0.1:3101 (usa la plataforma local en :8080)
```

Para verlo dentro de la plataforma, agregá el módulo al gateway (`GATEWAY_MODULOS` en el `.env` de
`plataforma`), al registry y tu usuario con un rol en `roles.local.yaml`.

## Al generar un módulo desde la plantilla

El aprovisionamiento (I2-3) lo hace solo. A mano, serían estos pasos:

1. Reemplazar `plantilla-modulo` por el id del módulo en `package.json`, `modulo.yaml`, `README.md` y `CHANGELOG.md`.
2. Ajustar los roles de `modulo.yaml` y `docs/permisos.md`.
3. Importar el ruleset y verificar secret scanning, push protection y alertas de Dependabot.

## Versiones de la plantilla

- **0.6.0** — Promoción a producción: workflow `promover` (Actions → promover, con el digest que está
  sano en staging). GitHub pide la aprobación del PO (riesgo medio/alto) y de Sistemas, y el deployer de
  producción la vuelve a verificar por API (ADR 0014 de plataforma). Los pedidos de despliegue llevan
  `task: deploy:plataforma`.
- **0.5.0** — Al publicar, la CI pide el despliegue a staging; lo ejecuta el deployer de Sistemas tras verificar
  la atestación (ADR 0012 de plataforma).
- **0.4.0** — Al mergear en `main`, la CI publica la imagen en GHCR por digest, con prueba de humo,
  SBOM y atestaciones de procedencia y SBOM (`modulo-publicar.yml`, ADR 0011 de plataforma). Dockerfile
  corregido para Node 26 (corepack). Ruleset con CodeQL obligatorio.
- **0.3.0** — Límite de pedidos por usuario con `@fastify/rate-limit` (120 por minuto,
  `RATE_LIMIT_POR_MINUTO`), declarado en cada ruta de la API: lo exige CodeQL
  (`js/missing-rate-limiting`) en los endpoints que acceden a archivos o a la base. 429 en Problem Details.
- **0.2.0** — CI por workflow reutilizable de la plataforma con `policy-check`; reporte de cobertura
  `json-summary`; piso de cobertura 50 % (el mínimo por riesgo lo exige COD-05); plantilla de PR
  con la sección de asistencia de IA obligatoria.
- **0.1.0** — Versión inicial.

## Documentación

- `docs/funcional/` — qué resuelve el módulo y para quién.
- `docs/tecnica/` — arquitectura y diagramas.
- `docs/permisos.md` — matriz de roles y endpoints.
- `docs/runbook.md` — operación y fallas conocidas.
- `docs/adr/` — decisiones del módulo.
