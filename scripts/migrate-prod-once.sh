#!/usr/bin/env bash
#
# Одноразовый переход прода на монорепо: 23 миграции, шесть бэкфиллов и разбор
# денежной истории. Запускать из корня чекаута ОДИН раз:
#
#   ./scripts/migrate-prod-once.sh
#
# Почему это не умеет обычный `migrate deploy`: две миграции защищены проверками
# и намеренно падают, пока не отработают скрипты, которых они ждут. Скрипты
# разметки истории написаны под досплитовую схему и запускаются на коммите-родителе
# разреза. Обоснование — CLAUDE.md, «Накатывание миграций на боевую базу»; здесь
# тот же порядок, но без ручных шагов.
#
# Приложение останавливается в начале и поднимается в конце: между старым кодом и
# новой схемой совместимости нет. Простой — на всё время прогона, около трёх минут
# плюс сборка.
#
# После успешного прогона скрипт удалить: второй раз он не нужен и на мигрированной
# базе часть шагов не пройдёт.
set -Eeuo pipefail

main() {
  APP_DIR=${APP_DIR:-/var/www/alg/dashboard}
  PM2_APP=${PM2_APP:-dashboard}
  APP_PORT=${APP_PORT:-3001}
  BACKUP_DIR=${BACKUP_DIR:-/var/www/alg/backups}
  PG_BIN=${PG_BIN:-/usr/lib/postgresql/17/bin}
  # Родитель коммита, разрезавшего оплату и пакет: на нём последний раз живы
  # скрипты разметки денежной истории.
  PRESPLIT=830c8c58

  cd "$APP_DIR"

  say() { echo; echo "==> $*"; }
  die() { echo "!! $*" >&2; exit 1; }
  run() { echo "    $*"; "$@"; }

  # ── Преflight: всё, что может остановить на середине, ловим сейчас ────
  [ -z "$(git status --porcelain)" ] || die "в дереве есть незакоммиченные правки, а прогон переключается на $PRESPLIT и обратно:
$(git status --short)
разберитесь с ними (закоммитить, откатить или git stash) и запустите заново"

  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" && nvm use default >/dev/null
  corepack enable pnpm >/dev/null 2>&1 || die "corepack не смог поставить pnpm"

  local before
  before=$(git rev-parse --short HEAD)

  say "остановка приложения (старый код с новой схемой не работает)"
  run pm2 stop "$PM2_APP"

  say "код и зависимости"
  run git pull --ff-only
  run pnpm install --frozen-lockfile

  # .env переезжает вместе с приложением, и в нём не хватает ключа шифрования
  # паролей учеников — без него бэкфилл better-auth не отработает.
  local env_file=apps/platform/.env
  if [ ! -f "$env_file" ] && [ -f .env ]; then
    say "переносим .env в apps/platform/"
    run cp .env "$env_file"
  fi
  [ -f "$env_file" ] || die "нет $env_file"
  grep -q '^STUDENT_PW_KEY=' "$env_file" || die "в $env_file нет STUDENT_PW_KEY (32 байта base64).
сгенерировать: openssl rand -base64 32
без него не отработает backfill-student-auth и школа не увидит пароли учеников"
  grep -q '^NEXT_PUBLIC_DOCS_URL=' "$env_file" ||
    echo "!! в $env_file нет NEXT_PUBLIC_DOCS_URL — ссылки на документацию уйдут на docs.{rootDomain}" >&2

  local db_url
  db_url=$(grep -E '^DATABASE_URL=' "$env_file" | head -1 | cut -d= -f2- | tr -d "\"'")
  [ -n "$db_url" ] || die "в $env_file нет DATABASE_URL"

  # ── Дамп ──────────────────────────────────────────────────────────────
  mkdir -p "$BACKUP_DIR"
  local dump="$BACKUP_DIR/dump_before_monorepo_$(date +%Y-%m-%d_%H-%M-%S).fc"
  say "дамп базы"
  "$PG_BIN/pg_dump" -Fc "$db_url" -f "$dump"
  # Дамп, который не читается, — это не бэкап. Проверяем оглавлением.
  "$PG_BIN/pg_restore" -l "$dump" >/dev/null || die "дамп $dump не читается"
  echo "    $dump ($(du -h "$dump" | cut -f1))"

  bail() {
    echo >&2
    echo "!! прогон прерван, база осталась в промежуточном состоянии" >&2
    echo "   восстановить базу: $PG_BIN/pg_restore --clean --if-exists -d '<DATABASE_URL>' $dump" >&2
    echo "   вернуть код:       git checkout $before && pnpm install --frozen-lockfile" >&2
    echo "   поднять приложение: pm2 start $PM2_APP" >&2
  }
  trap bail ERR

  # ── Миграции с двумя ожидаемыми остановками ───────────────────────────
  # Какая миграция сейчас числится упавшей: строка есть, финиша нет, откат не
  # отмечен. Резолвим ровно её и только если это та, которую ждём, — иначе
  # ошибка совсем другой природы будет замазана.
  failed_migration() {
    "$PG_BIN/psql" "$db_url" -tAc \
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 1' |
      tr -d '[:space:]'
  }

  deploy_expecting_stop_at() {
    local expected=$1
    if pnpm --filter @repo/db migrate:deploy; then
      die "миграции прошли целиком, хотя ожидалась остановка на $expected — база не в том состоянии, из которого писался скрипт"
    fi
    local failed
    failed=$(failed_migration)
    [ "$failed" = "$expected" ] || die "deploy упал на '$failed', а ожидалась остановка на '$expected' — дальше вручную"
    run pnpm --filter @repo/db exec prisma migrate resolve --rolled-back "$expected"
  }

  say "миграции, заход первый — до паролей учеников"
  deploy_expecting_stop_at 20260723120100_drop_student_password

  say "заводим ученикам учётки better-auth (867 аккаунтов, около минуты)"
  run pnpm --filter platform exec tsx scripts/backfill-student-auth.ts

  say "миграции, заход второй — до разреза оплаты и пакета"
  deploy_expecting_stop_at 20260818120000_payment_package_split

  # ── Разметка денежной истории на досплитовом коммите ──────────────────
  # Скрипты читают `Payment.remaining/lessonCount/walletId` — под нынешним
  # клиентом они падают, поэтому клиент временно генерится из старой схемы.
  # node_modules остаются от main: меняется только сгенерированный клиент.
  say "переключаемся на $PRESPLIT ради скриптов разметки"
  run git checkout --detach "$PRESPLIT"
  run pnpm --filter @repo/db generate

  say "разметка денежной истории"
  run pnpm --filter platform exec tsx scripts/fix-swapped-payments.ts --apply
  run pnpm --filter platform exec tsx scripts/backfill-payment-packets.ts --apply
  run pnpm --filter platform exec tsx scripts/backfill-wallet-ledger.ts --apply
  run pnpm --filter platform exec tsx scripts/close-negative-balances.ts --apply

  say "возвращаемся на main"
  run git checkout main
  run pnpm --filter @repo/db generate

  say "миграции, заход третий — до конца"
  run pnpm --filter @repo/db migrate:deploy

  # ── Чистка перехода: уже под нынешней схемой ──────────────────────────
  say "чистка перехода"
  run pnpm --filter platform exec tsx scripts/price-legacy-free-lessons.ts --apply
  run pnpm --filter platform exec tsx scripts/backfill-legacy-package-money.ts --apply
  run pnpm --filter platform exec tsx scripts/close-unbillable-attendances.ts --apply

  # ── Сверки: ни одна не имеет права упасть ─────────────────────────────
  say "сверки"
  local check
  for check in check-ledger-core check-ledger check-wallet-balance \
    check-revenue-parity check-revenue check-package-statuses check-package-product; do
    run pnpm --filter platform exec tsx "scripts/$check.ts"
  done

  # ── Сборка и запуск из новой директории ───────────────────────────────
  say "сборка"
  run pnpm --filter platform build

  # pm2 не умеет менять cwd у существующего процесса, а приложение переехало в
  # apps/platform. Поэтому старую запись удаляем и заводим заново с тем же именем
  # и портом: nginx проксирует именно на него.
  say "перевешиваем pm2 на apps/platform"
  run pm2 delete "$PM2_APP"
  run pm2 start npm --name "$PM2_APP" --cwd "$APP_DIR/apps/platform" -- start -- -p "$APP_PORT"
  run pm2 save

  say "проверка отклика"
  local i
  for i in $(seq 1 15); do
    if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$APP_PORT/"; then
      trap - ERR
      say "переход завершён: $before → $(git rev-parse --short HEAD)"
      echo "    дамп до перехода: $dump"
      echo "    дальше деплоить обычным ./scripts/deploy.sh, этот скрипт удалить"
      return 0
    fi
    sleep 2
  done
  die "приложение не отвечает на порту $APP_PORT — смотреть pm2 logs $PM2_APP"
}

main "$@"
