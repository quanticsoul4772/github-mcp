import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        global: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      'complexity': ['warn', 10],
      'max-lines-per-function': ['warn', { max: 50 }],
      'max-depth': ['warn', 4]
    }
  },
  {
    // Test files have different quality standards: mocks need `any`, assertions
    // use non-null, helper functions can be long, and test setup is complex.
    files: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/__tests__/**/*.ts'
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      'max-lines-per-function': 'off',
      'complexity': 'off',
      'max-depth': 'off'
    }
  },
  {
    ignores: [
      'build/**',
      'node_modules/**',
      'coverage/**',
      '*.config.ts',
      '*.config.js',
      'dist/**',
      '.git/**'
    ]
  }
];
