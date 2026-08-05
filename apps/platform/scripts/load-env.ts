/**
 * Грузит `apps/platform/.env` для одноразовых скриптов.
 *
 * Импортировать ПЕРВЫМ: `@repo/db` читает `DATABASE_URL` в момент вычисления
 * модуля, а ESM выполняет импорты в порядке объявления.
 *
 * Почему не `node --env-file=.env`: под Windows в связке с `pnpm exec` node не
 * находит файл по относительному пути, хотя cwd верный. Путь от `import.meta.dirname`
 * не зависит от того, из какой директории скрипт запущен.
 */
import path from 'node:path'

process.loadEnvFile(path.join(import.meta.dirname, '..', '.env'))
