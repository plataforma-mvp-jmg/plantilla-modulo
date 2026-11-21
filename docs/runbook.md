# Runbook

## Salud

- `GET /health` → proceso vivo. `GET /ready` → listo para recibir tráfico. `GET /meta` → id y versión.

## Fallas conocidas

| Síntoma | Causa probable | Acción |
|---|---|---|
| Todo responde 401 | JWKS de la plataforma inaccesible o `PLATFORM_ISSUER` distinto | Revisar las variables y que `/.well-known/jwks.json` responda |
| No arranca: "no está declarado en modulo.yaml" | Un endpoint pide un rol que no existe | Declarar el rol (PR revisado por Sistemas) o corregir el endpoint |
| No arranca: "Configuración inválida" | Faltan variables fuera de local | Completar el entorno según `.env.example` |
| Respuestas 429 "Demasiadas solicitudes" | Un usuario superó `RATE_LIMIT_POR_MINUTO` | Esperar el `retry-after`; si es uso legítimo, subir el límite por variable de entorno |
| CI: "La copia de @plataforma/auth fue modificada" | Se editó `src/vendor/` | Revertir; la actualiza Sistemas |

## Escalamiento

Incidentes S1/S2: guardia de Sistemas. Rollback: volver a la versión anterior desde el deployer (I4).

## Promoción a producción

1. Copiar el digest de staging (resumen del run de publicación).
2. Actions → **promover** → Run workflow sobre `main` con ese digest.
3. Aprueban el PO (riesgo medio/alto) y Sistemas en el run. Quien lo disparó no puede aprobarlo.
4. El deployer de producción verifica las aprobaciones y despliega; el estado del deployment registra quién pidió y quién aprobó.
