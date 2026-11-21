// `node dist/migrar.js`: lo corre el deployer con la imagen nueva antes del corte (ADR 0015 de
// plataforma). Sale con 1 si algo falla.
import { join } from 'node:path';
import pg from 'pg';
import { leerMigraciones, migrar } from './migraciones.js';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('migrar: falta DATABASE_URL (la pasa el deployer)\n');
  process.exit(1);
}
const esquema = process.env.DB_SCHEMA;
const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000, ...(esquema ? { options: `-c search_path=${esquema}` } : {}) });
try {
  await cliente.connect();
  const aplicadas = await migrar(cliente, leerMigraciones(join(import.meta.dirname, '..', 'migraciones')));
  process.stdout.write(aplicadas.length ? `migrar: aplicadas ${aplicadas.join(', ')}\n` : 'migrar: nada pendiente\n');
} catch (err) {
  // El mensaje de pg no incluye la URL; igual se recorta cualquier cosa con forma de URL.
  process.stderr.write(`migrar: ${(err as Error).message.replace(/postgres(ql)?:\/\/\S+/g, '<url>')}\n`);
  process.exitCode = 1;
} finally {
  await cliente.end().catch(() => undefined);
}
