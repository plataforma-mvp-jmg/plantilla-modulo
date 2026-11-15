// Base del módulo (contrato E1–E4): todo bajo /m/<id>, JWT de plataforma obligatorio, rol mínimo por
// endpoint y errores en Problem Details. Las rutas de negocio van en src/api/.
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { tieneRol, tokenDeHeader, TokenInvalidoError, type ClaimsPlataforma, type Verificador } from './vendor/plataforma-auth/index.js';
import type { Manifiesto } from './manifiesto.js';
import { registrarRutas } from './api/rutas.js';

declare module 'fastify' {
  interface FastifyRequest {
    claims: ClaimsPlataforma | null;
  }
}

export interface OpcionesModulo {
  manifiesto: Manifiesto;
  verificar: Verificador;
  logger?: boolean;
}

export function problema(req: FastifyRequest, reply: FastifyReply, status: number, title: string) {
  return reply.code(status).type('application/problem+json').send({ type: 'about:blank', title, status, correlationId: req.id });
}

/** preHandler que exige un rol declarado en modulo.yaml (E3). */
export type Exigir = (rol: string) => (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

export function construirModulo(o: OpcionesModulo): FastifyInstance {
  const { id, version } = o.manifiesto;
  const declarados = new Set(o.manifiesto.roles.map((r) => r.id));
  const base = `/m/${id}`;
  const app = Fastify({
    logger: o.logger ? { redact: ['req.headers.authorization', 'req.headers.cookie'] } : false,
    requestIdHeader: 'x-correlation-id',
  });

  // E4: endpoints de sistema sin autenticación (solo red interna).
  app.get('/health', async () => ({ estado: 'ok' }));
  app.get('/ready', async () => ({ estado: 'listo' }));
  app.get('/meta', async () => ({ id, version }));

  // E2: todo lo que está bajo /m/<id> exige un JWT de plataforma válido para este módulo.
  app.decorateRequest('claims', null);
  app.addHook('onRequest', async (req, reply) => {
    if (req.url !== base && !req.url.startsWith(`${base}/`)) return;
    const token = tokenDeHeader(req.headers.authorization);
    if (!token) return problema(req, reply, 401, 'Falta el token de plataforma');
    try {
      req.claims = await o.verificar(token);
    } catch (err) {
      req.log.warn({ motivo: err instanceof TokenInvalidoError ? err.message : 'error' }, 'token rechazado');
      return problema(req, reply, 401, 'Token de plataforma inválido');
    }
  });

  // Errores sin stack traces hacia afuera (AGENTS.md, regla 5).
  app.setErrorHandler((err: { statusCode?: number; validation?: unknown }, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) req.log.error({ err }, 'error no controlado');
    return problema(req, reply, status, status === 500 ? 'Error interno' : 'Solicitud inválida');
  });
  app.setNotFoundHandler((req, reply) => problema(req, reply, 404, 'No encontrado'));

  const exigir: Exigir = (rol) => {
    if (!declarados.has(rol)) throw new Error(`el rol "${rol}" no está declarado en modulo.yaml`);
    return async (req, reply) => {
      if (!req.claims || !tieneRol(req.claims, rol)) return problema(req, reply, 403, `Requiere el rol ${rol}`);
    };
  };

  void app.register(async (api) => registrarRutas(api, exigir), { prefix: base });
  return app;
}
