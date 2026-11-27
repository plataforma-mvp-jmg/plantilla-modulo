// Contrato E1–E4: 401 sin token o con token de otro módulo, 403 sin el rol, Problem Details.
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { join } from 'node:path';
import { construirModulo } from '../../src/app.js';
import { leerManifiesto, type Manifiesto } from '../../src/manifiesto.js';
import { crearVerificador, type ClaimsPlataforma } from '../../src/vendor/plataforma-auth/index.js';

const ISSUER = 'http://localhost:8080';
let privada: CryptoKey;
let publica: JWK;
let app: FastifyInstance;
const manifiesto: Manifiesto = leerManifiesto(join(import.meta.dirname, '../../modulo.yaml'));
const base = `/m/${manifiesto.id}`;

beforeAll(async () => {
  const par = await generateKeyPair('ES256');
  privada = par.privateKey;
  publica = { ...(await exportJWK(par.publicKey)), kid: 'k', alg: 'ES256' };
});

afterEach(async () => {
  await app.close();
});

function crear() {
  const verificar = crearVerificador({ claves: createLocalJWKSet({ keys: [publica] }), issuer: ISSUER, audiencia: `modulo:${manifiesto.id}` });
  app = construirModulo({ manifiesto, verificar });
}

async function token(roles: string[], extra: Partial<ClaimsPlataforma> = {}, aud = `modulo:${manifiesto.id}`) {
  return new SignJWT({ email: null, nombre: 'Ana', roles, empresas: ['acopio'], ...extra })
    .setProtectedHeader({ alg: 'ES256', kid: 'k' })
    .setIssuer(ISSUER)
    .setSubject('usuario-1')
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti('j'.repeat(22))
    .sign(privada);
}

const auth = async (roles: string[]) => ({ authorization: `Bearer ${await token(roles)}` });

describe('contrato del módulo', () => {
  it('endpoints de sistema sin token (E4)', async () => {
    crear();
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/ready' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/meta' })).json()).toEqual({ id: manifiesto.id, version: manifiesto.version });
  });

  it('/ready responde 503 si la base no está disponible (I4-4)', async () => {
    app = construirModulo({ manifiesto, verificar: async () => ({}) as ClaimsPlataforma, listo: async () => false });
    const r = await app.inject({ method: 'GET', url: '/ready' });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ title: 'Base de datos no disponible' });
  });

  it('página inicial del módulo: exige lector, escapa el nombre y no permite scripts', async () => {
    crear();
    expect((await app.inject({ method: 'GET', url: `${base}/` })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: `${base}/`, headers: await auth([]) })).statusCode).toBe(403);
    const t = await token(['lector'], { nombre: '<script>x</script>' });
    const r = await app.inject({ method: 'GET', url: `${base}/`, headers: { authorization: `Bearer ${t}` } });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.headers['content-security-policy']).toContain("default-src 'none'");
    expect(r.body).toContain('&#60;script&#62;');
    expect(r.body).not.toContain('<script>');
  });

  it('sin token, con token de otro módulo o con un prefijo parecido → 401 (E2)', async () => {
    crear();
    const sin = await app.inject({ method: 'GET', url: `${base}/api/v1/yo` });
    expect(sin.statusCode).toBe(401);
    expect(sin.headers['content-type']).toContain('application/problem+json');
    const otro = await token(['lector'], {}, 'modulo:otro');
    expect((await app.inject({ method: 'GET', url: `${base}/api/v1/yo`, headers: { authorization: `Bearer ${otro}` } })).statusCode).toBe(401);
    // /m/<id>x no es parte del módulo: no pide token, pero tampoco existe.
    expect((await app.inject({ method: 'GET', url: `${base}x/api/v1/yo` })).statusCode).toBe(404);
  });

  it('un error inesperado del verificador también responde 401', async () => {
    app = construirModulo({
      manifiesto,
      verificar: async () => {
        throw new Error('JWKS caído');
      },
    });
    expect((await app.inject({ method: 'GET', url: `${base}/api/v1/yo`, headers: await auth(['lector']) })).statusCode).toBe(401);
  });

  it('rol requerido por endpoint (E3)', async () => {
    crear();
    const url = `${base}/api/v1/notas`;
    expect((await app.inject({ method: 'GET', url, headers: await auth([]) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url, headers: await auth(['lector']) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url, headers: await auth(['lector']), payload: { texto: 'a' } })).statusCode).toBe(403);
    const creada = await app.inject({ method: 'POST', url, headers: await auth(['operador']), payload: { texto: ' hola ' } });
    expect(creada.statusCode).toBe(201);
    expect(creada.json()).toMatchObject({ id: 1, texto: 'hola', autor: 'usuario-1' });
    expect((await app.inject({ method: 'DELETE', url: `${url}/1`, headers: await auth(['operador']) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: `${url}/1`, headers: await auth(['administrador']) })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: `${url}/1`, headers: await auth(['administrador']) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `${url}/abc`, headers: await auth(['administrador']) })).statusCode).toBe(404);
  });

  it('valida la entrada con Zod y responde Problem Details sin detalles internos', async () => {
    crear();
    const url = `${base}/api/v1/notas`;
    for (const payload of [{ texto: '' }, { texto: 'a', extra: 1 }, { otro: 'x' }]) {
      const r = await app.inject({ method: 'POST', url, headers: await auth(['operador']), payload });
      expect(r.statusCode).toBe(400);
      expect(r.json()).toMatchObject({ status: 400, title: 'Solicitud inválida' });
    }
    const json = await app.inject({ method: 'POST', url, headers: { ...(await auth(['operador'])), 'content-type': 'application/json' }, payload: '{mal' });
    expect(json.statusCode).toBe(400);
    expect(json.body).not.toContain('at ');
  });

  it('/yo devuelve solo los datos necesarios y respeta el correlationId', async () => {
    crear();
    const r = await app.inject({ method: 'GET', url: `${base}/api/v1/yo`, headers: { ...(await auth(['lector'])), 'x-correlation-id': 'corr-1' } });
    expect(r.json()).toEqual({ sub: 'usuario-1', nombre: 'Ana', roles: ['lector'] });
    const sin = await app.inject({ method: 'GET', url: `${base}/nada`, headers: { ...(await auth(['lector'])), 'x-correlation-id': 'corr-2' } });
    expect(sin.statusCode).toBe(404);
    expect(sin.json()).toMatchObject({ correlationId: 'corr-2' });
  });

  it('un rol no declarado en modulo.yaml impide arrancar', async () => {
    const sinOperador: Manifiesto = { ...manifiesto, roles: manifiesto.roles.filter((r) => r.id !== 'operador') };
    app = construirModulo({ manifiesto: sinOperador, verificar: async () => ({}) as ClaimsPlataforma });
    await expect(app.ready()).rejects.toThrow('no está declarado en modulo.yaml');
  });

  it('un error interno responde 500 sin stack trace', async () => {
    app = construirModulo({
      manifiesto,
      verificar: async () => ({ roles: ['operador'], sub: '' }) as unknown as ClaimsPlataforma,
    });
    const r = await app.inject({ method: 'POST', url: `${base}/api/v1/notas`, headers: { authorization: `Bearer ${await token(['operador'])}` }, payload: { texto: 'x' } });
    expect(r.statusCode).toBe(500);
    expect(r.json()).toMatchObject({ title: 'Error interno' });
    expect(r.body).not.toContain('autor');
  });
});

describe('límite de pedidos', () => {
  async function tokenDe(sub: string) {
    return new SignJWT({ email: null, nombre: sub, roles: ['lector'], empresas: ['acopio'] })
      .setProtectedHeader({ alg: 'ES256', kid: 'k' })
      .setIssuer(ISSUER)
      .setSubject(sub)
      .setAudience(`modulo:${manifiesto.id}`)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti('j'.repeat(22))
      .sign(privada);
  }

  it('por usuario: al superar el límite responde 429 en Problem Details; otro usuario no se ve afectado', async () => {
    const verificar = crearVerificador({ claves: createLocalJWKSet({ keys: [publica] }), issuer: ISSUER, audiencia: `modulo:${manifiesto.id}` });
    app = construirModulo({ manifiesto, verificar, limitePorMinuto: 2 });
    const ana = { authorization: `Bearer ${await tokenDe('ana')}` };
    const url = `${base}/api/v1/notas`;
    expect((await app.inject({ method: 'GET', url, headers: ana })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url, headers: ana })).statusCode).toBe(200);
    const tercero = await app.inject({ method: 'GET', url, headers: ana });
    expect(tercero.statusCode).toBe(429);
    expect(tercero.headers['content-type']).toContain('application/problem+json');
    expect(tercero.json()).toMatchObject({ status: 429, title: 'Demasiadas solicitudes' });
    expect(tercero.headers['retry-after']).toBeDefined();
    const beto = { authorization: `Bearer ${await tokenDe('beto')}` };
    expect((await app.inject({ method: 'GET', url, headers: beto })).statusCode).toBe(200);
  });

  it('los endpoints de sistema no se limitan', async () => {
    app = construirModulo({ manifiesto, verificar: async () => ({}) as ClaimsPlataforma, limitePorMinuto: 1 });
    for (let i = 0; i < 4; i++) expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });
});
