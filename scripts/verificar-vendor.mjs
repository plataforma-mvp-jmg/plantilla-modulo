// Verifica que la copia de @plataforma/auth no se modificó en este repo (ADR 0001 del módulo).
// La copia la actualiza Sistemas desde plataforma/packages/auth (archivos idénticos), nunca a mano.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/vendor/plataforma-auth';
const manifiesto = JSON.parse(readFileSync(join(dir, 'VENDOR.json'), 'utf8'));
const esperados = manifiesto.archivos;
const presentes = readdirSync(dir).filter((f) => f !== 'VENDOR.json').sort();
const errores = [];

for (const f of presentes) {
  if (!(f in esperados)) errores.push(`${f}: archivo no declarado en VENDOR.json`);
}
for (const [f, hash] of Object.entries(esperados)) {
  let real;
  try {
    real = createHash('sha256').update(readFileSync(join(dir, f))).digest('hex');
  } catch {
    errores.push(`${f}: falta`);
    continue;
  }
  if (real !== hash) errores.push(`${f}: el contenido no coincide con ${manifiesto.origen}@${manifiesto.version}`);
}

if (errores.length > 0) {
  console.error('La copia de @plataforma/auth fue modificada. No se edita a mano: pedile a Sistemas que la actualice.');
  for (const e of errores) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`vendor ok: ${manifiesto.origen}@${manifiesto.version} (${presentes.length} archivos)`);
