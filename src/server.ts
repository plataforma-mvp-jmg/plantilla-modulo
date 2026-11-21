import { join } from 'node:path';
import { cargarConfig } from './config.js';
import { leerManifiesto } from './manifiesto.js';
import { audienciaModulo, crearVerificador } from './vendor/plataforma-auth/index.js';
import { construirModulo } from './app.js';
import { repoNotasPostgres } from './datos/notas.js';
import { crearPool, sondaBase } from './db.js';

const config = cargarConfig(process.env);
const manifiesto = leerManifiesto(join(import.meta.dirname, '..', 'modulo.yaml'));
const verificar = crearVerificador({ jwksUrl: config.jwksUrl, issuer: config.issuer, audiencia: audienciaModulo(manifiesto.id) });
const pool = config.base ? crearPool(config.base.url, config.base.esquema) : null;
const app = construirModulo({
  manifiesto,
  verificar,
  logger: true,
  limitePorMinuto: config.limitePorMinuto,
  ...(pool ? { notas: repoNotasPostgres(pool), listo: sondaBase(pool) } : {}),
});
app.addHook('onClose', async () => pool?.end());
await app.listen({ port: config.port, host: config.host });
