// Contrato del JWT de plataforma (ADR-029). Lo emite la API; lo verifican los módulos.
import { z } from 'zod';

/** Algoritmo único aceptado: evita ataques de confusión de algoritmos. */
export const ALGORITMO_JWT = 'ES256';
/** Vida del token: corta, porque el gateway emite uno nuevo por request (ADR-029). */
export const VIDA_JWT_SEGUNDOS = 300;
/** Audiencia de la propia plataforma (Shell, Studio, API). */
export const AUDIENCIA_PLATAFORMA = 'plataforma';

/** Audiencia de un módulo: `modulo:<id>`. */
export function audienciaModulo(id: string): string {
  if (!/^[a-z][a-z0-9-]{2,40}$/.test(id)) throw new Error(`id de módulo inválido: ${id}`);
  return `modulo:${id}`;
}

export const esquemaClaims = z.object({
  iss: z.string().min(1),
  sub: z.string().min(1),
  aud: z.string().min(1),
  exp: z.number().int(),
  iat: z.number().int(),
  jti: z.string().min(16),
  email: z.string().nullable(),
  nombre: z.string().nullable(),
  roles: z.array(z.string()),
  empresas: z.array(z.string()),
});

export type ClaimsPlataforma = z.infer<typeof esquemaClaims>;
