// ESLint homologado de la plataforma (mismas reglas que el repo plataforma).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  { files: ['**/*.{ts,js,mjs}'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-console': 'error', // usar el logger (E7)
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // El script de CI informa por consola a propósito.
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
