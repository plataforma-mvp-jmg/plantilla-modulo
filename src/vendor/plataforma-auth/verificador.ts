// E2: los módulos rechazan todo request sin un JWT de plataforma válido.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ALGORITMO_JWT, esquemaClaims, type ClaimsPlataforma } from './claims.js';

export interface OpcionesVerificador {
  /** URL del JWKS de la plataforma (PLATFORM_JWKS_URL). */
  jwksUrl?: string;
  /** Alternativa para tests o para la propia API: función de claves local. */
  claves?: JWTVerifyGetKey;
  /** Emisor esperado (PLATFORM_ISSUER). */
  issuer: string;
  /** Audiencia esperada: `modulo:<id>` o `plataforma`. */
  audiencia: string;
  /** Tolerancia de reloj en segundos. Por defecto 30. */
  toleranciaSegundos?: number;
}

export class TokenInvalidoError extends Error {
  override readonly name = 'TokenInvalidoError';
}

export type Verificador = (token: string) => Promise<ClaimsPlataforma>;

export function crearVerificador(o: OpcionesVerificador): Verificador {
  const claves = o.claves ?? (o.jwksUrl ? createRemoteJWKSet(new URL(o.jwksUrl)) : null);
  if (!claves) throw new Error('Se requiere jwksUrl o claves');

  return async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, claves, {
        algorithms: [ALGORITMO_JWT],
        issuer: o.issuer,
        audience: o.audiencia,
        clockTolerance: o.toleranciaSegundos ?? 30,
        requiredClaims: ['sub', 'exp', 'iat', 'jti'],
      });
      const claims = esquemaClaims.safeParse(payload);
      if (!claims.success) throw new Error('claims con formato inválido');
      return claims.data;
    } catch (err) {
      // Mensaje genérico hacia afuera; el detalle queda para el log del módulo.
      throw new TokenInvalidoError(err instanceof Error ? err.message : 'token inválido');
    }
  };
}

/** Extrae el token de un header `Authorization: Bearer <token>`. */
export function tokenDeHeader(valor: string | undefined): string | null {
  if (!valor) return null;
  const m = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(valor);
  return m?.[1] ?? null;
}

/** true si el usuario tiene el rol (directo, sin jerarquías: las resuelve la plataforma al emitir). */
export function tieneRol(claims: ClaimsPlataforma, rol: string): boolean {
  return claims.roles.includes(rol);
}
