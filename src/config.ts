// P1: configuración solo por variables de entorno, validada al arrancar.
import { z } from 'zod';

const esquema = z
  .object({
    ENTORNO: z.enum(['local', 'staging', 'produccion']).default('local'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3101),
    PLATFORM_JWKS_URL: z.url().optional(),
    PLATFORM_ISSUER: z.string().min(1).optional(),
  })
  .transform((c, ctx) => {
    const local = c.ENTORNO === 'local';
    const jwksUrl = c.PLATFORM_JWKS_URL ?? (local ? 'http://127.0.0.1:8080/.well-known/jwks.json' : undefined);
    const issuer = c.PLATFORM_ISSUER ?? (local ? 'http://localhost:8080' : undefined);
    if (!jwksUrl || !issuer) {
      ctx.addIssue({ code: 'custom', message: 'fuera de local, PLATFORM_JWKS_URL y PLATFORM_ISSUER son obligatorias' });
      return z.NEVER;
    }
    return { entorno: c.ENTORNO, host: c.HOST, port: c.PORT, jwksUrl, issuer };
  });

export type Config = z.output<typeof esquema>;

export function cargarConfig(env: NodeJS.ProcessEnv): Config {
  const r = esquema.safeParse(env);
  if (!r.success) throw new Error(`Configuración inválida: ${r.error.issues.map((i) => i.message).join('; ')}`, { cause: r.error });
  return r.data;
}
