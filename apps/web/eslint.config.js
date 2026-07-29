import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
    ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'eslint.config.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
