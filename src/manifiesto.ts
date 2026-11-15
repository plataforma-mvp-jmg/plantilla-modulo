// Manifiesto del módulo (modulo.yaml): id y roles que el módulo declara.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

const idValido = /^[a-z][a-z0-9-]{2,40}$/;

export const esquemaManifiesto = z
  .object({
    id: z.string().regex(idValido),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    roles: z
      .array(z.object({ id: z.string().regex(/^[a-z][a-z0-9_-]{1,40}$/), descripcion: z.string().min(1) }).strict())
      .min(1)
      .refine((r) => new Set(r.map((x) => x.id)).size === r.length, 'roles duplicados'),
  })
  .strict();

export type Manifiesto = z.infer<typeof esquemaManifiesto>;

export function leerManifiesto(ruta: string): Manifiesto {
  const r = esquemaManifiesto.safeParse(parse(readFileSync(ruta, 'utf8')));
  if (!r.success) {
    throw new Error(`modulo.yaml inválido: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return r.data;
}
