import { join } from 'node:path';
import { cargarConfig } from './config.js';
import { leerManifiesto } from './manifiesto.js';
import { audienciaModulo, crearVerificador } from './vendor/plataforma-auth/index.js';
import { construirModulo } from './app.js';

const config = cargarConfig(process.env);
const manifiesto = leerManifiesto(join(import.meta.dirname, '..', 'modulo.yaml'));
const verificar = crearVerificador({ jwksUrl: config.jwksUrl, issuer: config.issuer, audiencia: audienciaModulo(manifiesto.id) });
const app = construirModulo({ manifiesto, verificar, logger: true });
await app.listen({ port: config.port, host: config.host });
