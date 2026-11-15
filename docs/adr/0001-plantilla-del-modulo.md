# ADR 0001 — Plantilla del módulo y copia de @plataforma/auth

- Estado: aceptado · Origen: `plantilla-modulo@0.1.0`

## Contexto

Los módulos viven en repos propios y tienen que verificar el JWT de plataforma igual que el resto.
`@plataforma/auth` todavía no se publica en un registro de paquetes, y publicarlo en GitHub Packages
exige un token también para instalarlo.

## Decisión

- La plantilla incluye una **copia idéntica** de `plataforma/packages/auth/src` en `src/vendor/plataforma-auth/`.
- `VENDOR.json` guarda el SHA-256 de cada archivo; `pnpm vendor:check` corre en la CI y falla si un
  archivo cambia, falta o sobra. `src/vendor/` tiene a Sistemas como code owner.
- Los roles del módulo se declaran en `modulo.yaml`; usar un rol no declarado impide arrancar.

## Consecuencias

- Instalación sin tokens ni registros privados.
- Actualizar `@plataforma/auth` exige un PR en cada módulo (lo automatiza el aprovisionamiento más adelante).
- En la Fase 1.5 se migra a un paquete publicado en GitHub Packages con versión fijada.
