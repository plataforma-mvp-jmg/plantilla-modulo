// Acceso a datos de las notas. Dos implementaciones con el mismo contrato: en memoria (desarrollo local,
// tests, módulos sin base) y Postgres (cuando el deployer pasa DATABASE_URL). Consultas siempre parametrizadas.
import type pg from 'pg';
import type { Nota } from '../dominio/notas.js';

export interface RepoNotas {
  listar(): Promise<Nota[]>;
  crear(texto: string, autor: string): Promise<Nota>;
  /** true si existía y se borró. */
  borrar(id: number): Promise<boolean>;
}

export function repoNotasEnMemoria(ahora: () => Date = () => new Date()): RepoNotas {
  const notas: Nota[] = [];
  let siguiente = 1;
  return {
    async listar() {
      return [...notas];
    },
    async crear(texto, autor) {
      const nota: Nota = { id: siguiente++, texto, autor, creada: ahora().toISOString() };
      notas.push(nota);
      return nota;
    },
    async borrar(id) {
      const i = notas.findIndex((n) => n.id === id);
      if (i < 0) return false;
      notas.splice(i, 1);
      return true;
    },
  };
}

interface FilaNota {
  id: string;
  texto: string;
  autor: string;
  creada: Date;
}

const aNota = (f: FilaNota): Nota => ({ id: Number(f.id), texto: f.texto, autor: f.autor, creada: f.creada.toISOString() });

export function repoNotasPostgres(pool: Pick<pg.Pool, 'query'>): RepoNotas {
  return {
    async listar() {
      const r = await pool.query<FilaNota>('SELECT id, texto, autor, creada FROM notas ORDER BY id LIMIT 500');
      return r.rows.map(aNota);
    },
    async crear(texto, autor) {
      const r = await pool.query<FilaNota>('INSERT INTO notas (texto, autor) VALUES ($1, $2) RETURNING id, texto, autor, creada', [texto, autor]);
      const fila = r.rows[0];
      if (!fila) throw new Error('la base no devolvió la nota creada');
      return aNota(fila);
    },
    async borrar(id) {
      const r = await pool.query('DELETE FROM notas WHERE id = $1', [id]);
      return (r.rowCount ?? 0) > 0;
    },
  };
}
