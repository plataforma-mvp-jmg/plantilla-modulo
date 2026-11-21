import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoNotasEnMemoria, repoNotasPostgres } from '../../src/datos/notas.js';
import { sondaBase } from '../../src/db.js';
import { leerMigraciones, migrar, type ClienteSql } from '../../src/migraciones.js';

/** Cliente SQL falso: registra las sentencias y simula la tabla _migraciones. */
function clienteFalso(previas: Record<string, string> = {}, falla?: string) {
  const sentencias: string[] = [];
  const c: ClienteSql = {
    async query(sql, params) {
      sentencias.push(sql);
      if (sql.startsWith('SELECT nombre, sha256')) return { rows: Object.entries(previas).map(([nombre, sha256]) => ({ nombre, sha256 })) };
      if (falla && sql === falla) throw new Error('syntax error');
      if (sql.startsWith('INSERT INTO _migraciones')) previas[String(params?.[0])] = String(params?.[1]);
      return { rows: [] };
    },
  };
  return { c, sentencias, previas };
}

describe('migraciones', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'mig-'));

  it('lee en orden y rechaza nombres fuera de formato', () => {
    const d = dir();
    writeFileSync(join(d, '0002_b.sql'), 'B');
    writeFileSync(join(d, '0001_a.sql'), 'A');
    writeFileSync(join(d, 'LEEME.md'), 'x');
    expect(leerMigraciones(d).map((m) => m.nombre)).toEqual(['0001_a.sql', '0002_b.sql']);
    writeFileSync(join(d, 'sin-numero.sql'), 'x');
    expect(() => leerMigraciones(d)).toThrow('nombre de migración inválido');
  });

  it('la migración real de la plantilla es válida', () => {
    expect(leerMigraciones(join(import.meta.dirname, '../../migraciones'))[0]?.nombre).toBe('0001_notas.sql');
  });

  it('aplica solo las pendientes, cada una en su transacción, con bloqueo; la segunda vez no hace nada', async () => {
    const { c, sentencias, previas } = clienteFalso();
    const ms = [{ nombre: '0001_a.sql', sql: 'CREATE TABLE a()' }, { nombre: '0002_b.sql', sql: 'CREATE TABLE b()' }];
    expect(await migrar(c, ms)).toEqual(['0001_a.sql', '0002_b.sql']);
    expect(sentencias[0]).toContain('pg_advisory_lock');
    expect(sentencias.at(-1)).toContain('pg_advisory_unlock');
    expect(sentencias.filter((s) => s === 'BEGIN')).toHaveLength(2);
    expect(await migrar(clienteFalso(previas).c, ms)).toEqual([]);
  });

  it('una migración editada después de aplicarse es un error', async () => {
    const { c } = clienteFalso({ '0001_a.sql': 'otro-hash' });
    await expect(migrar(c, [{ nombre: '0001_a.sql', sql: 'CREATE TABLE a()' }])).rejects.toThrow('cambió después de aplicarse');
  });

  it('si una falla, hace ROLLBACK, informa cuál y libera el bloqueo', async () => {
    const { c, sentencias } = clienteFalso({}, 'ROTA');
    await expect(migrar(c, [{ nombre: '0001_a.sql', sql: 'ROTA' }])).rejects.toThrow('falló 0001_a.sql: syntax error');
    expect(sentencias).toContain('ROLLBACK');
    expect(sentencias.at(-1)).toContain('pg_advisory_unlock');
  });
});

describe('repositorio de notas', () => {
  it('en memoria', async () => {
    const r = repoNotasEnMemoria(() => new Date('2026-01-01T00:00:00Z'));
    expect(await r.crear('a', 'u')).toEqual({ id: 1, texto: 'a', autor: 'u', creada: '2026-01-01T00:00:00.000Z' });
    expect(await r.listar()).toHaveLength(1);
    expect(await r.borrar(1)).toBe(true);
    expect(await r.borrar(1)).toBe(false);
  });

  it('Postgres: consultas parametrizadas', async () => {
    const llamadas: { sql: string; params?: unknown[] }[] = [];
    const fila = { id: '7', texto: 'a', autor: 'u', creada: new Date('2026-01-01T00:00:00Z') };
    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        llamadas.push({ sql, ...(params ? { params } : {}) });
        return { rows: sql.startsWith('DELETE') ? [] : [fila], rowCount: sql.startsWith('DELETE') ? 1 : 1 };
      },
    } as unknown as Parameters<typeof repoNotasPostgres>[0];
    const r = repoNotasPostgres(pool);
    expect(await r.listar()).toEqual([{ id: 7, texto: 'a', autor: 'u', creada: '2026-01-01T00:00:00.000Z' }]);
    expect(await r.crear("a'; drop table notas; --", 'u')).toMatchObject({ id: 7 });
    expect(llamadas[1]).toMatchObject({ sql: expect.stringContaining('VALUES ($1, $2)'), params: ["a'; drop table notas; --", 'u'] });
    expect(await r.borrar(7)).toBe(true);
    expect(llamadas[2]).toEqual({ sql: 'DELETE FROM notas WHERE id = $1', params: [7] });
  });

  it('Postgres: si el INSERT no devuelve fila, error', async () => {
    const pool = { query: async () => ({ rows: [] }) } as unknown as Parameters<typeof repoNotasPostgres>[0];
    await expect(repoNotasPostgres(pool).crear('a', 'u')).rejects.toThrow('no devolvió');
  });

  it('sonda de la base para /ready', async () => {
    expect(await sondaBase({ query: async () => ({ rows: [] }) } as never)()).toBe(true);
    expect(await sondaBase({ query: async () => Promise.reject(new Error('caída')) } as never)()).toBe(false);
  });
});
