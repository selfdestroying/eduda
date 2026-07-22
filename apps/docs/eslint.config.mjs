import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'node_modules/**',
    'next-env.d.ts',
    '*.d.ts',
    '**/*.config.js',
    '**/*.config.cjs',
    '**/*.config.mjs',
    'next.config.ts',
    'cli.json',
    '.source',
  ]),
])

export default eslintConfig
