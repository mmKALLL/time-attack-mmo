import tseslint from 'typescript-eslint';

// The one rule that matters for the MMO-extraction path: the pure layer
// (engine/ + types/config/data) must never import React or Pixi.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'docs/**', '**/*.js'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/engine/**/*.ts', 'src/types.ts', 'src/config.ts', 'src/data.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'pure layer must stay framework-agnostic' },
            { name: 'react-dom', message: 'pure layer must stay framework-agnostic' },
            { name: 'pixi.js', message: 'pure layer must stay framework-agnostic' },
          ],
        },
      ],
    },
  },
);
