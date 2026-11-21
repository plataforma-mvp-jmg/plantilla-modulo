// Lógica del runner de migraciones (src/migrar.ts es el punto de entrada). Lo ejecuta el deployer con la imagen nueva ANTES del
// corte, con el rol del módulo (ADR 0015 de plataforma). Aplica en orden los archivos de migraciones/
// que falten, cada uno en su transacción, y registra nombre y hash. Una migración ya aplicada que cambió
// es un error: las migraciones no se editan, se agrega una nueva.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ClienteSql {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface Migracion {
  nombre: string;
  sql: string;
}

const NOMBRE = /^\d{4}_[a-z0-9_]+\.sql$/;

export function leerMigraciones(dir: string): Migracion[] {
  const archivos = readdirSync(dir).filter((a) => a.endsWith('.sql')).sort();
  for (const a of archivos) if (!NOMBRE.test(a)) throw new Error(`nombre de migración inválido: ${a} (formato 0001_descripcion.sql)`);
  return archivos.map((nombre) => ({ nombre, sql: readFileSync(join(dir, nombre), 'utf8') }));
}

const hash = (sql: string) => createHash('sha256').update(sql).digest('hex');

/** Aplica las pendientes y devuelve sus nombres. */
export async function migrar(c: ClienteSql, migraciones: Migracion[]): Promise<string[]> {
  // Un solo runner a la vez por esquema.
  await c.query('SELECT pg_advisory_lock(hashtext(current_schema()))');
  try {
    await c.query('CREATE TABLE IF NOT EXISTS _migraciones (nombre text PRIMARY KEY, sha256 text NOT NULL, aplicada timestamptz NOT NULL DEFAULT now())');
    const previas = new Map((await c.query('SELECT nombre, sha256 FROM _migraciones')).rows.map((f) => [String(f.nombre), String(f.sha256)]));
    const aplicadas: string[] = [];
    for (const m of migraciones) {
      const previa = previas.get(m.nombre);
      if (previa !== undefined) {
        if (previa !== hash(m.sql)) throw new Error(`la migración ${m.nombre} cambió después de aplicarse: agregá una nueva en lugar de editarla`);
        continue;
      }
      await c.query('BEGIN');
      try {
        await c.query(m.sql);
        await c.query('INSERT INTO _migraciones (nombre, sha256) VALUES ($1, $2)', [m.nombre, hash(m.sql)]);
        await c.query('COMMIT');
      } catch (err) {
        await c.query('ROLLBACK');
        throw new Error(`falló ${m.nombre}: ${(err as Error).message}`, { cause: err });
      }
      aplicadas.push(m.nombre);
    }
    return aplicadas;
  } finally {
    await c.query('SELECT pg_advisory_unlock(hashtext(current_schema()))');
  }
}
