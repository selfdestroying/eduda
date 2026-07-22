import tanstackQuery from '@tanstack/eslint-plugin-query'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tanstackQuery.configs['flat/recommended'],
  eslintConfigPrettier,
  {
    rules: {
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'node_modules/**',
    'next-env.d.ts',
    '*.d.ts',
    '**/*.config.js',
    '**/*.config.cjs',
    '**/*.config.mjs',
    'scripts/**',
    'tests/e2e/**',
    '.prettierrc',
    '.prettierignore',
    'postcss.config.mjs',
    'next.config.ts',
    'components.json',
    'prisma/migrations/**',
    'prisma/generated/**',
    '.DS_Store',
    '*.log',
    '.source',
  ]),
])

export default eslintConfig
