// Author: Rasel Al Mamun
// Flat config: @eslint/js recommended rules + `globals` (FD-10).
import js from '@eslint/js';
import globals from 'globals';

// Safety rules on top of the recommended set (no-eval family, strict equality).
const rules = {
  'no-duplicate-imports': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-use-before-define': ['error', { functions: false }],
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
};

export default [
  {
    ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'],
  },
  // FD-133: the Django build target's output.
  { ignores: ['dist-django/'] },
  js.configs.recommended,
  {
    files: ['src/js/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.browser },
    rules,
  },
  {
    // Classic (non-module) script served as-is from public/.
    files: ['public/js/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'script', globals: globals.browser },
    rules,
  },
  {
    files: ['*.js', 'tools/**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
    rules,
  },
  {
    // Playwright specs run in Node, but page.evaluate() callbacks run in the page.
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules,
  },
];
