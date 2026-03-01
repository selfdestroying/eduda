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
  ]),
])

export default eslintConfig
