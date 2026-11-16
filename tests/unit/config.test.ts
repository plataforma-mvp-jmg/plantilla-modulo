import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cargarConfig } from '../../src/config.js';
import { leerManifiesto } from '../../src/manifiesto.js';
import { crearNota } from '../../src/dominio/notas.js';

describe('configuración (P1)', () => {
  it('en local usa valores por defecto', () => {
    expect(cargarConfig({})).toMatchObject({ entorno: 'local', host: '127.0.0.1', port: 3101, issuer: 'http://localhost:8080', limitePorMinuto: 120 });
    expect(cargarConfig({ RATE_LIMIT_POR_MINUTO: '30' }).limitePorMinuto).toBe(30);
  });

  it('fuera de local exige JWKS e issuer', () => {
    expect(() => cargarConfig({ ENTORNO: 'staging' })).toThrow('obligatorias');
    const c = cargarConfig({ ENTORNO: 'produccion', PLATFORM_JWKS_URL: 'https://p.test/.well-known/jwks.json', PLATFORM_ISSUER: 'https://p.test', PORT: '3000' });
    expect(c).toMatchObject({ entorno: 'produccion', port: 3000, jwksUrl: 'https://p.test/.well-known/jwks.json' });
  });

  it('rechaza valores inválidos', () => {
    expect(() => cargarConfig({ PORT: '0' })).toThrow('Configuración inválida');
    expect(() => cargarConfig({ RATE_LIMIT_POR_MINUTO: '0' })).toThrow('Configuración inválida');
    expect(() => cargarConfig({ PLATFORM_JWKS_URL: 'no-es-url' })).toThrow('Configuración inválida');
  });
});

describe('manifiesto (modulo.yaml)', () => {
  const escribir = (contenido: string) => {
    const f = join(mkdtempSync(join(tmpdir(), 'manif-')), 'modulo.yaml');
    writeFileSync(f, contenido);
    return f;
  };

  it('el manifiesto real es válido', () => {
    expect(leerManifiesto(join(import.meta.dirname, '../../modulo.yaml')).roles.length).toBeGreaterThan(0);
  });

  it('rechaza id inválido, roles duplicados y campos desconocidos', () => {
    expect(() => leerManifiesto(escribir('id: X\nversion: 0.1.0\nroles: [{id: lector, descripcion: a}]'))).toThrow('modulo.yaml inválido');
    expect(() => leerManifiesto(escribir('id: abc\nversion: 0.1.0\nroles: [{id: a1, descripcion: a}, {id: a1, descripcion: b}]'))).toThrow('duplicados');
    expect(() => leerManifiesto(escribir('id: abc\nversion: 0.1.0\nroles: [{id: a1, descripcion: a}]\nbase_datos: prod'))).toThrow('modulo.yaml inválido');
  });
});

describe('dominio', () => {
  it('crea notas con fecha y exige autor', () => {
    expect(crearNota(1, 't', 'u', new Date('2026-01-01T00:00:00Z'))).toEqual({ id: 1, texto: 't', autor: 'u', creada: '2026-01-01T00:00:00.000Z' });
    expect(() => crearNota(1, 't', '')).toThrow('autor');
  });
});
