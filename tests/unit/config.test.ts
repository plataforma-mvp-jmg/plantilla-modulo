import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cargarConfig } from '../../src/config.js';
import { leerManifiesto } from '../../src/manifiesto.js';
import { validarNota } from '../../src/dominio/notas.js';

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

  it('I4-4: base opcional con DATABASE_URL y DB_SCHEMA', () => {
    expect(cargarConfig({}).base).toBeNull();
    expect(cargarConfig({ DATABASE_URL: 'postgresql://r.ref:x@h:5432/postgres', DB_SCHEMA: 'tareas_piloto_staging' }).base).toEqual({ url: 'postgresql://r.ref:x@h:5432/postgres', esquema: 'tareas_piloto_staging' });
    expect(() => cargarConfig({ DATABASE_URL: 'mysql://x' })).toThrow('Configuración inválida');
    expect(() => cargarConfig({ DATABASE_URL: 'postgresql://x', DB_SCHEMA: 'x; drop' })).toThrow('Configuración inválida');
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
  it('valida autor y texto', () => {
    expect(validarNota('  hola ', 'u')).toEqual({ texto: 'hola', autor: 'u' });
    expect(() => validarNota('t', '')).toThrow('autor');
    expect(() => validarNota('   ', 'u')).toThrow('texto');
  });
});
