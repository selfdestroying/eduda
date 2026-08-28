#!/usr/bin/env bash
#
# Одноразовый переезд прода на монорепо. Запускать на сервере ОДИН раз:
#
#   ./scripts/cutover-prod-once.sh
#
# Что меняется. Сейчас на машине два отдельных чекаута двух старых репозиториев —
# `dashboard` (порт 3001) и `shop` (3002), оба ходят в одну базу. Становится один
# монорепо в `/var/www/alg/eduda` и три приложения из него: платформа (3001),
# кабинет ученика (3002) и документация (3005). Порты платформы и шопа сохранены,
# поэтому nginx для них не трогается; документации нужен новый server-блок — его
# скрипт напечатает в конце, это единственный шаг под sudo.
#
# Заодно накатываются 23 миграции с двумя ожидаемыми остановками и разбором
# денежной истории — порядок и обоснование в CLAUDE.md, «Накатывание миграций на
# боевую базу».
#
# Старые каталоги и pm2-записи не удаляются автоматически: пока они на месте,
# откат — это одна команда. Убирать их вручную, когда новое отработает день.
#
# Простой — от остановки старых приложений до старта новых: миграции с бэкфиллами
# около трёх минут плюс рестарт. Сборка идёт до остановки: она базы не касается.
set -Eeuo pipefail

main() {
  ROOT=${ROOT:-/var/www/alg}
  APP_DIR=${APP_DIR:-$ROOT/eduda}
  OLD_DASHBOARD=${OLD_DASHBOARD:-$ROOT/dashboard}
  OLD_SHOP=${OLD_SHOP:-$ROOT/shop}
  REPO=${REPO:-https://github.com/selfdestroying/eduda.git}
  BACKUP_DIR=${BACKUP_DIR:-$ROOT/backups}
  PG_BIN=${PG_BIN:-/usr/lib/postgresql/17/bin}
  APPS=${APPS:-"platform:3001 shop:3002 docs:3005"}
  # Родитель коммита, разрезавшего оплату и пакет: на нём последний раз живы
  # скрипты разметки денежной истории.
  PRESPLIT=830c8c58

  say() { echo; echo "==> $*"; }
  die() {
    echo "!! $*" >&2
    exit 1
  }
  run() {
    echo "    $*"
    "$@"
  }
  names() { for a in $APPS; do echo "${a%%:*}"; done; }
  env_get() { grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'"; }

  # ── Преflight ─────────────────────────────────────────────────────────
  [ "$(id -u)" != 0 ] || die "запускать от admin, а не от root: pm2 и node живут в его профиле"
  [ -f "$OLD_DASHBOARD/.env" ] || die "нет $OLD_DASHBOARD/.env — из него берутся настройки платформы"
  [ -x "$PG_BIN/pg_dump" ] || die "нет $PG_BIN/pg_dump"

  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" && nvm use default >/dev/null
  corepack enable pnpm >/dev/null 2>&1 || die "corepack не смог поставить pnpm"

  local root_domain
  root_domain=$(env_get NEXT_PUBLIC_ROOT_DOMAIN "$OLD_DASHBOARD/.env")
  [ -n "$root_domain" ] || die "в $OLD_DASHBOARD/.env нет NEXT_PUBLIC_ROOT_DOMAIN"

  # ── Код ───────────────────────────────────────────────────────────────
  if [ -d "$APP_DIR/.git" ]; then
    say "чекаут уже есть, обновляю"
    run git -C "$APP_DIR" pull --ff-only
  else
    say "клонирую монорепо в $APP_DIR"
    run git clone "$REPO" "$APP_DIR"
  fi
  cd "$APP_DIR"

  # ── Настройки трёх приложений ─────────────────────────────────────────
  # Платформа переезжает со своими: тот же .env, плюс два ключа, которых в нём
  # ещё нет.
  say "настройки"
  if [ ! -f apps/platform/.env ]; then
    run cp "$OLD_DASHBOARD/.env" apps/platform/.env
  fi
  # Ключ шифрования паролей учеников. Генерим только если его нет: перегенерация
  # на втором прогоне сделала бы нечитаемыми уже зашифрованные пароли.
  if ! grep -q '^STUDENT_PW_KEY=' apps/platform/.env; then
    echo "STUDENT_PW_KEY=\"$(openssl rand -base64 32)\"" >>apps/platform/.env
    echo "    сгенерирован STUDENT_PW_KEY (AES-256 для паролей учеников)"
  fi
  grep -q '^NEXT_PUBLIC_DOCS_URL=' apps/platform/.env ||
    echo "NEXT_PUBLIC_DOCS_URL=\"https://docs.$root_domain\"" >>apps/platform/.env

  # Кабинет ученика: своя сессия, значит свой секрет better-auth. База — та же.
  if [ ! -f apps/shop/.env ]; then
    local db_line
    db_line=$(grep -E '^DATABASE_URL=' "$OLD_DASHBOARD/.env" | head -1)
    {
      echo "$db_line"
      echo "BETTER_AUTH_SECRET=\"$(openssl rand -base64 32)\""
      echo "BETTER_AUTH_URL=\"https://shop.$root_domain\""
      echo "NEXT_PUBLIC_ROOT_DOMAIN=\"$root_domain\""
      echo "PORT=3002"
      echo "TZ=UTC"
    } >apps/shop/.env
    echo "    создан apps/shop/.env (свой BETTER_AUTH_SECRET)"
  fi

  if [ ! -f apps/docs/.env ]; then
    {
      echo "NEXT_PUBLIC_ROOT_DOMAIN=\"$root_domain\""
      echo "PORT=3005"
    } >apps/docs/.env
    echo "    создан apps/docs/.env"
  fi

  local db_url
  db_url=$(env_get DATABASE_URL apps/platform/.env)
  [ -n "$db_url" ] || die "в apps/platform/.env нет DATABASE_URL"

  # ── Сборка: старые приложения ещё обслуживают ─────────────────────────
  say "зависимости"
  run pnpm install --frozen-lockfile
  run pnpm --filter @repo/db generate

  # По одному: одно ядро и 2 ГБ памяти, параллельно три Next-сборки уходят в OOM.
  local name
  for name in $(names); do
    say "сборка $name"
    run pnpm --filter "$name" build
  done

  # ── Дамп ──────────────────────────────────────────────────────────────
  mkdir -p "$BACKUP_DIR"
  local dump="$BACKUP_DIR/dump_before_cutover_$(date +%Y-%m-%d_%H-%M-%S).fc"
  say "дамп базы"
  "$PG_BIN/pg_dump" -Fc "$db_url" -f "$dump"
  "$PG_BIN/pg_restore" -l "$dump" >/dev/null || die "дамп $dump не читается"
  echo "    $dump ($(du -h "$dump" | cut -f1))"

  # Откат: старые процессы поднимаются теми же командами, что и раньше. После
  # `pm2 delete` их уже не вернуть по имени, поэтому пересоздаём явно.
  bail() {
    echo >&2
    echo "!! переезд прерван, поднимаю старые приложения" >&2
    pm2 describe dashboard >/dev/null 2>&1 ||
      pm2 start npm --name dashboard --cwd "$OLD_DASHBOARD" -- start -- -p 3001 >/dev/null 2>&1 || true
    pm2 describe shop >/dev/null 2>&1 ||
      pm2 start npm --name shop --cwd "$OLD_SHOP" -- start -- -p 3002 >/dev/null 2>&1 || true
    pm2 start dashboard shop >/dev/null 2>&1 || true
    echo "   база могла остаться в промежуточном состоянии" >&2
    echo "   восстановить: $PG_BIN/pg_restore --clean --if-exists -d '<DATABASE_URL>' $dump" >&2
  }
  trap bail ERR

  say "остановка старых приложений (старый код с новой схемой не работает)"
  run pm2 stop dashboard shop

  # ── Миграции с двумя ожидаемыми остановками ───────────────────────────
  # Какая миграция числится упавшей: строка есть, финиша нет, откат не отмечен.
  # Резолвим ровно её и только если это та, которую ждём, — иначе ошибка совсем
  # другой природы была бы замазана.
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

  # Скрипты разметки читают `Payment.remaining/lessonCount/walletId` — под нынешним
  # клиентом они падают, поэтому клиент временно генерится из старой схемы.
  # node_modules остаются от main: меняется только сгенерированный клиент.
  say "разметка денежной истории на $PRESPLIT"
  run git checkout --detach "$PRESPLIT"
  run pnpm --filter @repo/db generate
  run pnpm --filter platform exec tsx scripts/fix-swapped-payments.ts --apply
  run pnpm --filter platform exec tsx scripts/backfill-payment-packets.ts --apply
  run pnpm --filter platform exec tsx scripts/backfill-wallet-ledger.ts --apply
  run pnpm --filter platform exec tsx scripts/close-negative-balances.ts --apply

  say "возвращаемся на main"
  run git checkout main
  run pnpm --filter @repo/db generate

  say "миграции, заход третий — до конца"
  run pnpm --filter @repo/db migrate:deploy

  say "чистка перехода"
  run pnpm --filter platform exec tsx scripts/price-legacy-free-lessons.ts --apply
  run pnpm --filter platform exec tsx scripts/backfill-legacy-package-money.ts --apply
  run pnpm --filter platform exec tsx scripts/close-unbillable-attendances.ts --apply

  say "сверки"
  local check
  for check in check-ledger-core check-ledger check-wallet-balance \
    check-revenue-parity check-revenue check-package-statuses check-package-product; do
    run pnpm --filter platform exec tsx "scripts/$check.ts"
  done

  # ── Замена процессов ──────────────────────────────────────────────────
  # Клиент был перегенерирован в чекауте, но запущенные процессы читают его с
  # диска только при старте — поэтому сначала снимаем старые, потом заводим новые.
  say "заводим три приложения вместо двух"
  run pm2 delete dashboard shop
  local app port
  for app in $APPS; do
    name=${app%%:*}
    port=${app##*:}
    run pm2 start npm --name "$name" --cwd "$APP_DIR/apps/$name" -- start -- -p "$port"
  done
  run pm2 save

  say "проверка отклика"
  local i ok
  for app in $APPS; do
    name=${app%%:*}
    port=${app##*:}
    ok=""
    for i in $(seq 1 20); do
      if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$port/"; then
        ok=1
        break
      fi
      sleep 2
    done
    [ -n "$ok" ] || die "$name не отвечает на порту $port — смотреть pm2 logs $name"
    echo "    $name на $port отвечает"
  done

  trap - ERR

  say "переезд завершён"
  cat <<INSTRUCTIONS

Осталось два шага руками.

1. Документация. Ей нужен свой server-блок, иначе docs.$root_domain уйдёт по
   wildcard в платформу. Положить в /etc/nginx/sites-available/docs, слинковать
   в sites-enabled и перезагрузить nginx:

server {
    listen 443 ssl http2;
    server_name docs.$root_domain;

    ssl_certificate     /etc/letsencrypt/live/$root_domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$root_domain/privkey.pem;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

   Сертификат общий, wildcard — выпускать ничего не нужно.

2. Старое убрать, когда новое отработает день:

     rm -rf $OLD_DASHBOARD $OLD_SHOP

   До этого момента откат — это pm2 delete на трёх новых, pm2 start на старых
   и восстановление базы из $dump.

Дальше деплоить обычным ./scripts/deploy.sh, этот скрипт удалить.
INSTRUCTIONS
}

main "$@"
