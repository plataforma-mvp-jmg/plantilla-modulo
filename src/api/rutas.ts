// Rutas de ejemplo: reemplazalas por las del módulo. Reglas: esquema Zod de entrada y rol mínimo
// en cada endpoint (E3); la lógica de negocio va en src/dominio/.
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Exigir } from '../app.js';
import { crearNota, type Nota } from '../dominio/notas.js';

const cuerpoNota = z.object({ texto: z.string().trim().min(1).max(500) }).strict();
const paramsId = z.object({ id: z.coerce.number().int().positive() });

// Límite por ruta: usa los valores del plugin (app.ts). Declararlo en cada ruta deja explícito que el
// endpoint está limitado y es la forma que reconoce CodeQL (js/missing-rate-limiting).
const LIMITE = {};

export async function registrarRutas(api: FastifyInstance, exigir: Exigir): Promise<void> {
  // Datos en memoria solo para la plantilla; la persistencia llega con Postgres (I4).
  const notas: Nota[] = [];

  api.get('/api/v1/yo', { preHandler: exigir('lector'), config: { rateLimit: LIMITE } }, async (req) => ({
    sub: req.claims?.sub,
    nombre: req.claims?.nombre,
    roles: req.claims?.roles,
  }));

  api.get('/api/v1/notas', { preHandler: exigir('lector'), config: { rateLimit: LIMITE } }, async () => notas);

  // PRUEBA CodeQL (no mergear): misma lectura de archivo, con y sin límite declarado.
  api.get('/api/v1/prueba-con-limite', { preHandler: exigir('lector'), config: { rateLimit: LIMITE } }, async () => readFileSync('/etc/hostname', 'utf8'));
  api.get('/api/v1/prueba-sin-limite', { preHandler: exigir('lector') }, async () => readFileSync('/etc/hostname', 'utf8'));

  api.post('/api/v1/notas', { preHandler: exigir('operador'), config: { rateLimit: LIMITE } }, async (req, reply) => {
    const cuerpo = cuerpoNota.safeParse(req.body);
    if (!cuerpo.success) return reply.code(400).type('application/problem+json').send({ type: 'about:blank', title: 'Solicitud inválida', status: 400, correlationId: req.id });
    const nota = crearNota(notas.length + 1, cuerpo.data.texto, req.claims?.sub ?? '');
    notas.push(nota);
    return reply.code(201).send(nota);
  });

  api.delete('/api/v1/notas/:id', { preHandler: exigir('administrador'), config: { rateLimit: LIMITE } }, async (req, reply) => {
    const p = paramsId.safeParse(req.params);
    const i = p.success ? notas.findIndex((n) => n.id === p.data.id) : -1;
    if (i < 0) return reply.code(404).type('application/problem+json').send({ type: 'about:blank', title: 'No encontrado', status: 404, correlationId: req.id });
    notas.splice(i, 1);
    return reply.code(204).send();
  });
}
