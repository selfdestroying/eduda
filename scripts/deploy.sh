#!/usr/bin/env bash
#
# Деплой монорепо на боевой сервер. Запускать из корня чекаута:
#
#   ./scripts/deploy.sh
#
# Три приложения на одной машине: платформа, кабинет ученика и документация.
# Порядок выбран так, чтобы упавшая сборка не роняла сайт: всё собирается, пока
# старые процессы работают, и только на миграцию с рестартом они
# останавливаются. Сборка базу не трогает (проверено на всех трёх), поэтому
# собирать до миграции безопасно.
#
# Обратная сторона — во время сборки `.next` переписывается под живым процессом,
# и минуту-другую пользователь может поймать битый чанк. Это дешевле, чем простой
# на всю сборку; понадобится ноль ошибок — собирать в отдельный каталог и
# переключать симлинк.
#
# Пароля здесь нет: строка подключения читается из `apps/platform/.env`.
#
# Одноразовый переезд со старых отдельных приложений — не тут, а в
# `scripts/cutover-prod-once.sh`.
set -Eeuo pipefail

# Весь код в функции: `git pull` посреди прогона может переписать этот же файл, а
# bash дочитывает скрипт с диска по ходу выполнения. Функция разбирается целиком
# до первого вызова, поэтому подмена под ногами уже не страшна.
main() {
  APP_DIR=${APP_DIR:-/var/www/alg/eduda}
  BACKUP_DIR=${BACKUP_DIR:-/var/www/alg/backups}
  KEEP_DAYS=${KEEP_DAYS:-30}
  PG_BIN=${PG_BIN:-/usr/lib/postgresql/17/bin}
  # Имя pm2-процесса = имя пакета в воркспейсе, порт — тот, на который смотрит
  # nginx. Порядок важен: платформа поднимается первой.
  APPS=${APPS:-"platform:3001 shop:3002 docs:3005"}

  cd "$APP_DIR"

  say() { echo "==> $*"; }
  die() {
    echo "!! $*" >&2
    exit 1
  }
  names() { for a in $APPS; do echo "${a%%:*}"; done; }

  # ── Проверки до того, как что-то трогать ──────────────────────────────
  [ -z "$(git status --porcelain)" ] || die "в дереве есть незакоммиченные правки — деплой должен быть воспроизводимым:
$(git status --short)"

  # pm2 крутится на nvm-овском node, сборка обязана идти на нём же.
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" && nvm use default >/dev/null
  corepack enable pnpm >/dev/null 2>&1 || die "corepack не смог поставить pnpm"

  local db_url
  db_url=$(grep -E '^DATABASE_URL=' apps/platform/.env | head -1 | cut -d= -f2- | tr -d "\"'")
  [ -n "$db_url" ] || die "в apps/platform/.env нет DATABASE_URL"

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

  # ── Код и сборка: приложения ещё живы ─────────────────────────────────
  say "обновление кода"
  git pull --ff-only

  say "зависимости"
  pnpm install --frozen-lockfile

  say "prisma client"
  pnpm --filter @repo/db generate

  # По одному: на сервере одно ядро и 2 ГБ памяти, параллельная сборка трёх
  # Next-приложений уходит в своп и падает по OOM.
  #
  # Проверку типов и линт `next build` гоняет внутри себя, и это как раз тот пик,
  # который машина не вытягивает. Отключаем: обе проверки уже прошли в `pnpm check`
  # до коммита. Если и без них перестанет помещаться — следующий рычаг
  # NODE_OPTIONS=--max-old-space-size, потом увеличение свопа, потом сборка на
  # другой машине с доставкой .next.
  export SKIP_BUILD_CHECKS=1
  local name
  for name in $(names); do
    say "сборка $name"
    pnpm --filter "$name" build
  done

  # ── Дальше приложения стоят: любая ошибка обязана их вернуть ──────────
  restore_apps() {
    echo "!! деплой упал — поднимаю приложения обратно" >&2
    pm2 start $(names | tr '\n' ' ') >/dev/null 2>&1 || true
    echo "   дамп до деплоя: $dump" >&2
    echo "   откат кода:     git checkout $before && pnpm install --frozen-lockfile && ./scripts/deploy.sh" >&2
  }
  trap restore_apps ERR

  # Документация базы не касается, её можно не трогать вовсе — но проще
  # остановить всё разом, чем держать в голове, кто из трёх переживёт миграцию.
  say "остановка приложений"
  pm2 stop $(names | tr '\n' ' ')

  say "миграции"
  pnpm --filter @repo/db migrate:deploy

  say "запуск"
  pm2 restart $(names | tr '\n' ' ') --update-env
  pm2 save >/dev/null

  # ── Приложения обязаны отвечать, а не просто числиться запущенными ────
  local app port i ok
  for app in $APPS; do
    name=${app%%:*}
    port=${app##*:}
    ok=""
    for i in $(seq 1 15); do
      if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$port/"; then
        ok=1
        break
      fi
      sleep 2
    done
    [ -n "$ok" ] || die "$name не отвечает на порту $port — смотреть pm2 logs $name"
    say "$name отвечает на $port"
  done

  trap - ERR
  say "готово: $before → $(git rev-parse --short HEAD), дамп $dump"
}

main "$@"
