// Conexión a la base del módulo (I4-4). La URL la arma el deployer con el rol propio del módulo; el
// search_path del rol ya apunta a su esquema. Nunca loguear la URL.
import pg from 'pg';

export function crearPool(url: string, esquema: string | undefined): pg.Pool {
  return new pg.Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    application_name: 'modulo',
    // Defensa extra: aunque el rol ya lo tiene, se fija el esquema en cada conexión.
    ...(esquema ? { options: `-c search_path=${esquema}` } : {}),
  });
}

/** /ready: la base responde en menos de 3 s. */
export function sondaBase(pool: Pick<pg.Pool, 'query'>): () => Promise<boolean> {
  return async () => {
    try {
      await Promise.race([pool.query('SELECT 1'), new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('timeout')), 3000))]);
      return true;
    } catch {
      return false;
    }
  };
}
