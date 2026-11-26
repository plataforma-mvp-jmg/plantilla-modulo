// Rutas de ejemplo: reemplazalas por las del módulo. Reglas: esquema Zod de entrada y rol requerido
// en cada endpoint (E3); la lógica de negocio va en src/dominio/.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Exigir } from '../app.js';
import type { RepoNotas } from '../datos/notas.js';
import { validarNota } from '../dominio/notas.js';
import type { Manifiesto } from '../manifiesto.js';

const cuerpoNota = z.object({ texto: z.string().trim().min(1).max(500) }).strict();
const paramsId = z.object({ id: z.coerce.number().int().positive() });

// Límite por ruta: usa los valores del plugin (app.ts). Declararlo en cada ruta deja explícito que el
// endpoint está limitado y es la forma que reconoce CodeQL (js/missing-rate-limiting).
const LIMITE = {};

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function registrarRutas(api: FastifyInstance, exigir: Exigir, notas: RepoNotas, manifiesto: Manifiesto): Promise<void> {
  // Página inicial: lo que muestra el Shell al abrir el módulo. Sin scripts; reemplazala por la UI del módulo.
  api.get('/', { preHandler: exigir('lector'), config: { rateLimit: LIMITE } }, async (req, reply) => {
    const nombre = escapar(req.claims?.nombre ?? '');
    return reply
      .type('text/html; charset=utf-8')
      .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'")
      .send(
        `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(manifiesto.id)}</title>` +
          `<style>body{font-family:system-ui,sans-serif;margin:2rem;color:#1f2937}code{background:#f3f4f6;padding:2px 4px}</style></head>` +
          `<body><h1>${escapar(manifiesto.id)}</h1><p>Hola, ${nombre}. Versión <code>${escapar(manifiesto.version)}</code>.</p>` +
          `<p>API: <code>api/v1/notas</code>.</p></body></html>`,
      );
  });

  api.get('/api/v1/yo', { preHandler: exigir('lector'), config: { rateLimit: LIMITE } }, async (req) => ({
    sub: req.claims?.sub,
    nombre: req.claims?.nombre,
    roles: req.claims?.roles,
  }));

  api.get('/api/v1/notas', { preHandler: exigir('lector'), config: { rateLimit: LIMITE } }, async () => notas.listar());

  api.post('/api/v1/notas', { preHandler: exigir('operador'), config: { rateLimit: LIMITE } }, async (req, reply) => {
    const cuerpo = cuerpoNota.safeParse(req.body);
    if (!cuerpo.success) return reply.code(400).type('application/problem+json').send({ type: 'about:blank', title: 'Solicitud inválida', status: 400, correlationId: req.id });
    const { texto, autor } = validarNota(cuerpo.data.texto, req.claims?.sub ?? '');
    return reply.code(201).send(await notas.crear(texto, autor));
  });

  api.delete('/api/v1/notas/:id', { preHandler: exigir('administrador'), config: { rateLimit: LIMITE } }, async (req, reply) => {
    const p = paramsId.safeParse(req.params);
    if (!p.success || !(await notas.borrar(p.data.id))) return reply.code(404).type('application/problem+json').send({ type: 'about:blank', title: 'No encontrado', status: 404, correlationId: req.id });
    return reply.code(204).send();
  });
}
