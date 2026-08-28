#!/usr/bin/env bash
#
# Деплой платформы на боевой сервер. Запускать из корня чекаута:
#
#   ./scripts/deploy.sh
#
# Порядок выбран так, чтобы упавшая сборка не роняла сайт: код собирается, пока
# старое приложение работает, и только на миграцию с рестартом оно
# останавливается. Обратная сторона — во время сборки `.next` переписывается под
# живым процессом, и минуту-другую пользователь может поймать битый чанк. Это
# дешевле, чем простой на всю сборку, но если понадобится ноль ошибок — собирать
# надо в отдельный каталог и переключать симлинк.
#
# Пароля здесь нет: строка подключения читается из `apps/platform/.env`.
#
# Одноразовый переход на монорепо и разбор денежных миграций — не тут, а в
# `scripts/migrate-prod-once.sh`.
set -Eeuo pipefail

# Весь код в функции: `git pull` посреди прогона может переписать этот же файл, а
# bash дочитывает скрипт с диска по ходу выполнения. Функция разбирается целиком
# до первого вызова, поэтому подмена под ногами уже не страшна.
main() {
  APP_DIR=${APP_DIR:-/var/www/alg/dashboard}
  PM2_APP=${PM2_APP:-dashboard}
  APP_PORT=${APP_PORT:-3001}
  BACKUP_DIR=${BACKUP_DIR:-/var/www/alg/backups}
  KEEP_DAYS=${KEEP_DAYS:-30}
  PG_BIN=${PG_BIN:-/usr/lib/postgresql/17/bin}

  cd "$APP_DIR"

  say() { echo "==> $*"; }
  die() { echo "!! $*" >&2; exit 1; }

  # ── Проверки до того, как что-то трогать ──────────────────────────────
  [ -z "$(git status --porcelain)" ] || die "в дереве есть незакоммиченные правки — деплой должен быть воспроизводимым:
$(git status --short)"

  # pm2 крутится на nvm-овском node, сборка обязана идти на нём же.
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" && nvm use default >/dev/null
  corepack enable pnpm >/dev/null 2>&1 || die "corepack не смог поставить pnpm"

  local env_file=apps/platform/.env
  [ -f "$env_file" ] || die "нет $env_file"
  local db_url
  db_url=$(grep -E '^DATABASE_URL=' "$env_file" | head -1 | cut -d= -f2- | tr -d "\"'")
  [ -n "$db_url" ] || die "в $env_file нет DATABASE_URL"

  local before
  before=$(git rev-parse --short HEAD)

  # ── Дамп ──────────────────────────────────────────────────────────────
  mkdir -p "$BACKUP_DIR"
  local dump="$BACKUP_DIR/dump_$(date +%Y-%m-%d_%H-%M-%S).fc"
  say "дамп базы"
  "$PG_BIN/pg_dump" -Fc "$db_url" -f "$dump"
  # Дамп, который не читается, — это не бэкап. Проверяем оглавлением.
  "$PG_BIN/pg_restore" -l "$dump" >/dev/null || die "дамп $dump не читается"
  say "дамп готов: $dump ($(du -h "$dump" | cut -f1))"
  find "$BACKUP_DIR" -name 'dump_*.fc' -mtime "+$KEEP_DAYS" -delete

  # ── Код и сборка: приложение ещё живо ─────────────────────────────────
  say "обновление кода"
  git pull --ff-only

  say "зависимости"
  pnpm install --frozen-lockfile

  say "prisma client"
  pnpm --filter @repo/db generate

  say "сборка"
  # Только платформа: docs и shop на этом сервере не обслуживаются. Появятся —
  # дописать сюда их фильтры.
  pnpm --filter platform build

  # ── Дальше приложение стоит: любая ошибка обязана его вернуть ─────────
  restore_app() {
    echo "!! деплой упал — поднимаю приложение обратно" >&2
    pm2 restart "$PM2_APP" >/dev/null 2>&1 || pm2 start "$PM2_APP" >/dev/null 2>&1 || true
    echo "   дамп до деплоя: $dump" >&2
    echo "   откат кода:     git checkout $before && pnpm install --frozen-lockfile && pnpm --filter platform build && pm2 restart $PM2_APP" >&2
  }
  trap restore_app ERR

  say "остановка приложения"
  pm2 stop "$PM2_APP"

  say "миграции"
  pnpm --filter @repo/db migrate:deploy

  say "запуск"
  pm2 restart "$PM2_APP" --update-env
  pm2 save >/dev/null

  # ── Приложение обязано ответить, а не просто числиться запущенным ─────
  say "проверка отклика"
  local i
  for i in $(seq 1 15); do
    if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$APP_PORT/"; then
      trap - ERR
      say "готово: $before → $(git rev-parse --short HEAD), дамп $dump"
      return 0
    fi
    sleep 2
  done
  die "приложение не отвечает на порту $APP_PORT после рестарта — смотреть pm2 logs $PM2_APP"
}

main "$@"
