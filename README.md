# plantilla-modulo

Plantilla homologada de los módulos de la plataforma (MVP, datos sintéticos). Cada módulo nuevo
nace de este repo (*template repository*) y hereda sus controles.

## Qué trae

- **API Fastify** con el contrato de módulos: `/health`, `/ready` y `/meta` sin autenticación; todo
  lo demás bajo `/m/<id>/` exige el JWT de plataforma y un rol por endpoint.
- **`modulo.yaml`:** id, versión y roles. Un endpoint que pide un rol no declarado impide arrancar.
- **Verificación del JWT** con una copia de `@plataforma/auth` en `src/vendor/`, protegida por hash
  (`pnpm vendor:check`).
- **CI** con los mismos controles que `plataforma`: calidad, secretos (gitleaks), dependencias
  (osv-scanner) y `resumen` como check obligatorio.
- **Gobierno:** CODEOWNERS al team `sistemas`, ruleset `github/rulesets/main-modulo.json`,
  `AGENTS.md` para asistentes de IA y plantilla de PR.
- **Dockerfile** con usuario no root y health check.

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

## Documentación

- `docs/funcional/` — qué resuelve el módulo y para quién.
- `docs/tecnica/` — arquitectura y diagramas.
- `docs/permisos.md` — matriz de roles y endpoints.
- `docs/runbook.md` — operación y fallas conocidas.
- `docs/adr/` — decisiones del módulo.
