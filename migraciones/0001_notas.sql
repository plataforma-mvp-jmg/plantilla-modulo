-- Tabla de ejemplo de la plantilla. Las migraciones solo van hacia adelante y tienen que ser compatibles
-- con la versión anterior del módulo, que sigue atendiendo mientras se aplican (ADR 0015 de plataforma).
CREATE TABLE IF NOT EXISTS notas (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  texto  text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  autor  text NOT NULL,
  creada timestamptz NOT NULL DEFAULT now()
);
