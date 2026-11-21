// Reglas de negocio puras (sin Fastify ni base de datos): fáciles de testear.
export interface Nota {
  id: number;
  texto: string;
  autor: string;
  creada: string;
}

/** Regla de negocio antes de guardar: toda nota tiene autor y texto sin espacios de más. */
export function validarNota(texto: string, autor: string): { texto: string; autor: string } {
  if (!autor) throw new Error('la nota necesita un autor');
  const limpio = texto.trim();
  if (!limpio) throw new Error('la nota necesita texto');
  return { texto: limpio, autor };
}
