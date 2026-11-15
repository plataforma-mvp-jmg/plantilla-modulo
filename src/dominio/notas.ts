// Reglas de negocio puras (sin Fastify ni base de datos): fáciles de testear.
export interface Nota {
  id: number;
  texto: string;
  autor: string;
  creada: string;
}

export function crearNota(id: number, texto: string, autor: string, ahora = new Date()): Nota {
  if (!autor) throw new Error('la nota necesita un autor');
  return { id, texto, autor, creada: ahora.toISOString() };
}
