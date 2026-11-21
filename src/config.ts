// P1: configuración solo por variables de entorno, validada al arrancar.
import { z } from 'zod';

const esquema = z
  .object({
    ENTORNO: z.enum(['local', 'staging', 'produccion']).default('local'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3101),
    PLATFORM_JWKS_URL: z.url().optional(),
    PLATFORM_ISSUER: z.string().min(1).optional(),
    RATE_LIMIT_POR_MINUTO: z.coerce.number().int().min(1).max(10000).default(120),
    // I4-4: las pasa el deployer si el módulo tiene base (datos.base en el registry). Sin ellas, datos en memoria.
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL debe ser postgresql://').optional(),
    DB_SCHEMA: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/, 'DB_SCHEMA inválido').optional(),
  })
  .transform((c, ctx) => {
    const local = c.ENTORNO === 'local';
    const jwksUrl = c.PLATFORM_JWKS_URL ?? (local ? 'http://127.0.0.1:8080/.well-known/jwks.json' : undefined);
    const issuer = c.PLATFORM_ISSUER ?? (local ? 'http://localhost:8080' : undefined);
    if (!jwksUrl || !issuer) {
      ctx.addIssue({ code: 'custom', message: 'fuera de local, PLATFORM_JWKS_URL y PLATFORM_ISSUER son obligatorias' });
      return z.NEVER;
    }
    return {
      entorno: c.ENTORNO,
      host: c.HOST,
      port: c.PORT,
      jwksUrl,
      issuer,
      limitePorMinuto: c.RATE_LIMIT_POR_MINUTO,
      base: c.DATABASE_URL ? { url: c.DATABASE_URL, esquema: c.DB_SCHEMA } : null,
    };
  });

export type Config = z.output<typeof esquema>;

export function cargarConfig(env: NodeJS.ProcessEnv): Config {
  const r = esquema.safeParse(env);
  if (!r.success) throw new Error(`Configuración inválida: ${r.error.issues.map((i) => i.message).join('; ')}`, { cause: r.error });
  return r.data;
}
