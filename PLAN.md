# PLAN: реализация `apps/shop` по вертикальным слайсам

## Контекст

`SPEC.md` описывает личный кабинет ученика — новое приложение `apps/shop` (порт 3002,
домен `shop.{rootDomain}`, свой инстанс better-auth). Сейчас в репо этого приложения нет,
а схема `@repo/db` к нему не готова: `Order` — одна строка на один товар без снапшота цены,
коины — голый `Int` без истории, `StudentAccount.password` лежит plaintext и логин не уникален,
удаление товара каскадом стирает историю заказов.

Задача этого плана — разложить реализацию на **вертикальные слайсы**: каждый самостоятельно
поставляем (роут + Server Action + слой запросов + проверка) и не требует «сначала все запросы,
потом весь UI». Все изменения внутри `packages/` вынесены в отдельные слайсы `P*`, помеченные
явно; фиче-слайсы `A*` их не касаются.

## Решения, зафиксированные до плана

| Вопрос                                    | Решение                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Тест-раннер                               | **Не заводим.** Проверка слайса = `pnpm --filter <app> check` + точный `curl`-шаг + SQL-ассерт через `prisma db execute` (SQL, который `RAISE EXCEPTION` при нарушении инварианта → ненулевой exit-код). Раннера в репо нет и в этом объёме работ он не появляется |
| Скоуп `@repo/db`                          | **Все S1–S5** из §10.2 SPEC. S6 (мёртвые поля `Product`) — опциональный хвостовой слайс                                                                                                                                                                            |
| Гранулярность миграций                    | **Одна миграция на слайс** + правки `apps/platform`, которые эта миграция ломает, в том же слайсе (иначе `pnpm check` красный)                                                                                                                                     |
| S4 (unique login)                         | **Слит с S5 в P1**: дедуп логинов всё равно обязателен в момент backfill'а `StudentUser`, разносить по двум миграциям — двойная работа над одной таблицей                                                                                                          |
| Хеширование паролей учеников из платформы | Через уже используемый паттерн `(await auth.$context).password.hash(pw)` (`apps/platform/src/features/demo/seed.ts:178`) + прямая запись `prisma.studentUser`/`studentCredential`. Второй инстанс better-auth в платформе не заводим                               |
| `@repo/ui`                                | **Не меняется ни в одном слайсе.** Витринные `product-card`, `product-grid`, `coin-price` — локальные в `apps/shop` (A7 SPEC)                                                                                                                                      |

Уточнение по терминологии запроса: пакет дизайн-системы в этом репо — `@repo/ui`, не `@acme/ui`.

---

# Слайсы

Легенда: **[P]** — трогает `packages/` (миграция + правки платформы), **[A]** — только `apps/`.
«Общая запись» = таблица, в которую пишет и `apps/platform`, и `apps/shop`.

---

## P1 — Аутентификация ученика в схеме `[packages/]`

**Цель:** ученик может иметь учётные данные, пригодные для входа через better-auth, а staff по-прежнему видит пароль.

**Файлы**

- `packages/db/prisma/schema/student-auth.prisma` (новый): `StudentUser`, `StudentSession`, `StudentCredential`, `StudentVerification` (имена с префиксом — `StudentAccount` занято доменной таблицей)
- `packages/db/prisma/schema/students.prisma`: `StudentAccount` → `passwordEnc Bytes?`, `studentUserId Int? @unique`, `@@unique([login])`; `password` удаляется **во второй миграции**
- `packages/db/prisma/migrations/<ts>_student_auth/migration.sql` — таблицы + колонки + дедуп `login` (суффикс `-2`, `-3`) + unique-индекс
- `packages/db/scripts/backfill-student-auth.ts` (новый, одноразовый) — из plaintext `password` пишет `StudentUser` + `StudentCredential(hash)` + `StudentAccount.passwordEnc`
- `packages/db/prisma/migrations/<ts>_drop_student_password/migration.sql` — `DROP COLUMN password`
- `apps/platform/src/lib/student-password.ts` (новый) — `encryptStudentPassword(pw): Buffer` / `decryptStudentPassword(buf): string`, AES-256-GCM, ключ `STUDENT_PW_KEY`, формат `nonce||ciphertext||tag`, через `node:crypto`
- `apps/platform/src/features/students/actions.ts` — `createStudent` (строка 183–197): проверка занятости логина → `ConflictError('Логин занят')`, запись `StudentUser`+`StudentCredential`+`passwordEnc` в той же транзакции; новый `revealStudentPassword` под `permissionAction`
- `apps/platform/src/features/students/components/detail/student-account-section.tsx` — вместо `account.password` кнопка «Показать пароль» → `revealStudentPassword`
- `apps/platform/src/features/students/queries.ts`, `schemas.ts` — хук + схема для reveal
- `apps/platform/.env.example` — `STUDENT_PW_KEY`

**Компоненты `@repo/ui`:** `stat-card`, `button`, `hint` (переиспользуются как есть в карточке ученика).

**Таблицы**

| Таблица                                 | Р/З                                                     | Общая запись                                 |
| --------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| `StudentAccount`                        | чтение+запись (`login`, `passwordEnc`, `studentUserId`) | да — пишет только платформа, шоп читает      |
| `StudentUser`, `StudentCredential`      | запись (создание)                                       | да — платформа создаёт, шоп читает при входе |
| `StudentSession`, `StudentVerification` | — (создаются пустыми)                                   | нет                                          |

**Контракт**

```ts
// apps/platform/src/lib/student-password.ts
export function encryptStudentPassword(plain: string): Buffer
export function decryptStudentPassword(enc: Uint8Array): string   // бросает при неверном ключе

// apps/platform/src/features/students/actions.ts
revealStudentPassword: permissionAction({ student: ['update'] })
  .inputSchema(z.object({ studentId: z.number().int().positive() }))
  -> { password: string }        // + console.info-аудит: кто, кого, когда
```

**Проверка**

```bash
pnpm --filter @repo/db exec prisma migrate dev --name student_auth
```

```bash
pnpm --filter @repo/db exec tsx scripts/backfill-student-auth.ts
```

```bash
pnpm --filter @repo/db exec prisma db execute --stdin <<'SQL'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='StudentAccount' AND column_name='password')
    THEN RAISE EXCEPTION 'колонка password не удалена'; END IF;
  IF EXISTS (SELECT login FROM "StudentAccount" GROUP BY login HAVING count(*)>1)
    THEN RAISE EXCEPTION 'дубли логинов'; END IF;
  IF EXISTS (SELECT 1 FROM "StudentAccount" WHERE "passwordEnc" IS NULL OR "studentUserId" IS NULL)
    THEN RAISE EXCEPTION 'backfill неполный'; END IF;
END $$;
SQL
```

```bash
pnpm --filter platform check
```

Ручное: карточка ученика → «Показать пароль» отдаёт тот же пароль, что был до миграции (§11.27).

**Зависимости:** нет. Блокирует A1.

---

## A1 — Каркас `apps/shop` + вход + профиль (тонкий сквозной путь) `[apps/]`

**Цель:** ученик входит по логину/паролю на `localhost:3002` и видит свой профиль, отрисованный на примитивах `@repo/ui`.

**Файлы** (все новые, кроме отмеченного)

- Конфиги (копия `apps/docs`, §13.4 SPEC): `apps/shop/package.json` (имя `shop`, `dev: next dev -p 3002`), `next.config.ts` (`transpilePackages: ['@repo/db','@repo/ui']` + `images.remotePatterns` из `apps/platform/next.config.ts`), `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `.env.example`
- `apps/shop/src/styles/globals.css` — `@import '@repo/ui/globals.css'` и всё
- `apps/shop/src/lib/auth/server.ts` — второй инстанс better-auth: plugin `username`, `cookiePrefix: 'edu_student'`, `advanced.crossSubDomainCookies` **выключен**, `schema: { user: 'StudentUser', session: 'StudentSession', account: 'StudentCredential', verification: 'StudentVerification' }`, `emailAndPassword: false`, sign-up disabled
- `apps/shop/src/lib/auth/client.ts` — `authClient` с `usernameClient()`
- `apps/shop/src/lib/safe-action.ts` — `studentAction` (аналог `authAction`, `apps/platform/src/lib/safe-action.ts`)
- `apps/shop/src/lib/date.ts` — копия `ymdToLocalDate`, `formatDateOnly`, `formatInTz` из `apps/platform/src/lib/timezone.ts` (A3 SPEC)
- `apps/shop/src/proxy.ts` — гейт 1 и 2 из §7
- `apps/shop/src/app/layout.tsx`, `src/app/page.tsx` (профиль), `src/app/login/page.tsx`
- `apps/shop/src/components/student-nav.tsx` — сайдбар/шапка; растёт по мере слайсов
- `apps/shop/src/features/auth/components/login-form.tsx`
- `apps/shop/src/features/profile/actions.ts`, `src/features/profile/components/profile-view.tsx`
- **правка:** `apps/platform/src/proxy.ts:121-122` — удалить мёртвый `case 'shop'` (`shop` остаётся в `RESERVED_SUBDOMAINS`)

**Компоненты `@repo/ui`:** `card`, `field`, `label`, `input`, `password-input`, `button`, `alert`, `logo`, `sonner`, `avatar`, `badge`, `separator`, `item`, `stat-card`, `skeleton`, `sidebar`, `sheet`, `tooltip`, `switch-theme-button`, `dropdown-menu`.

**Таблицы**

| Таблица                                                                                         | Р/З                 | Общая запись      |
| ----------------------------------------------------------------------------------------------- | ------------------- | ----------------- |
| `StudentUser`, `StudentCredential`, `Organization`, `OrganizationFeature`                       | чтение              | —                 |
| `StudentSession`                                                                                | запись (вход/выход) | нет — владеет шоп |
| `Student`, `StudentParent`, `Parent`, `StudentGroup`, `Group`, `Course`, `StudentAccount.coins` | чтение              | нет записи        |

**Контракт**

```ts
// apps/shop/src/lib/safe-action.ts
type StudentCtx = {
  student: { id: number; organizationId: number }
  org: { id: number; slug: string; timezone: string }
  disabledShop: boolean
}
export const studentAction: SafeActionClient<..., StudentCtx>   // fail-closed: нет сессии/орги → redirect('/login')

// apps/shop/src/features/profile/actions.ts
getProfile: studentAction.metadata({ actionName: 'getProfile' }).action(...)
  -> {
    student: { id: number; firstName: string; lastName: string; birthDate: string | null }
    groups: { id: number; name: string; course: string; status: StudentStatus }[]
    parents: { firstName: string; lastName: string | null; phone: string | null; email: string | null }[]
    coins: number
  }
// явный select; accessToken / editToken не выбираются на уровне Prisma
```

**Проверка**

```bash
pnpm --filter shop check
```

```bash
pnpm --filter shop dev
```

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3002/
```

→ `307 http://localhost:3002/login` (§11.3)

```bash
curl -c /tmp/jar -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3002/api/auth/sign-in/username -H 'content-type: application/json' -d '{"username":"ivanov","password":"<из карточки ученика>"}'
```

→ `200`, в `/tmp/jar` кука `edu_student.session_token` (§11.1)

```bash
curl -b /tmp/jar -s http://localhost:3002/ | grep -c -E 'accessToken|editToken'
```

→ `0` (§11.10); фамилия ученика при этом в выдаче есть.

**Зависимости:** P1.

---

## A2 — `/attendance` `[apps/]`

**Цель:** ученик видит свои посещения без единого внутреннего поля учителя.

**Файлы**

- `apps/shop/src/app/attendance/page.tsx`
- `apps/shop/src/features/attendance/actions.ts`
- `apps/shop/src/features/attendance/components/attendance-table.tsx`
- `apps/shop/src/components/student-nav.tsx` (+пункт)

**Компоненты `@repo/ui`:** `table`, `badge`, `progress`, `empty`, `tabs`, `skeleton`.

**Таблицы:** `Attendance`, `Lesson`, `Group`, `Course` — только чтение, явный `select`. Общей записи нет.

**Контракт**

```ts
getAttendance: studentAction.inputSchema(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
  -> { lessonId: number; date: string; time: string; group: string; course: string; status: AttendanceStatus }[]
// where: { organizationId: ctx.student.organizationId, studentId: ctx.student.id }
```

**Проверка**

```bash
pnpm --filter shop check
```

```bash
curl -b /tmp/jar -s http://localhost:3002/attendance | grep -c -E 'isWarned|walletId|<комментарий из БД>'
```

→ `0` (§11.11); строка с датой урока и статусом в выдаче присутствует.

**Зависимости:** A1.

---

## P2 — Леджер коинов `[packages/]`

**Цель:** каждое изменение баланса коинов оставляет строку истории, баланс сходится с суммой леджера.

**Файлы**

- `packages/db/prisma/schema/shop.prisma` — модель `CoinTransaction { id, organizationId, studentId, amount, reason, orderId?, attendanceId?, createdAt }` (по образцу `StudentLessonsBalanceHistory`)
- `packages/db/prisma/schema/enums.prisma` — `enum CoinTxReason { ATTENDANCE_PRESENT, ATTENDANCE_REVERTED, MANUAL_GRANT, MANUAL_DEDUCT, ORDER_PURCHASE, ORDER_CANCELLED, INITIAL_BALANCE }`
- `packages/db/prisma/schema/students.prisma`, `auth.prisma` — обратные связи `Student.coinTransactions`, `Organization.coinTransactions`
- `packages/db/prisma/migrations/<ts>_coin_ledger/migration.sql` — таблица + backfill одной строкой `INITIAL_BALANCE` на текущий `StudentAccount.coins`
- `apps/platform/src/features/lessons/actions.ts:154-171` — `updateCoins` пишет `ATTENDANCE_PRESENT` / `ATTENDANCE_REVERTED` в той же `tx`
- `apps/platform/src/features/students/actions.ts:330-356` — `updateStudentCoins` пишет `MANUAL_GRANT` / `MANUAL_DEDUCT`, обёрнуто в `$transaction`
- `apps/platform/src/features/shop/orders/actions.ts:36-49` — возврат/повторное списание пишет `ORDER_CANCELLED` (переписывается ещё раз в P4)
- `apps/platform/src/features/demo/seed.ts` — строки `INITIAL_BALANCE` для демо-учеников

**Компоненты `@repo/ui`:** не задействованы (слайс без UI).

**Таблицы**

| Таблица                | Р/З    | Общая запись                                                      |
| ---------------------- | ------ | ----------------------------------------------------------------- |
| `CoinTransaction`      | запись | **да** — пишут и платформа (начисления), и шоп (покупки, A6)      |
| `StudentAccount.coins` | запись | **да** — денормализованный кеш, инвариант «сумма леджера = coins» |

**Контракт**

```ts
// внутренний хелпер платформы, не экспортируемый экшен
async function recordCoins(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: number
    studentId: number
    amount: number
    reason: CoinTxReason
    orderId?: number
    attendanceId?: number
  },
): Promise<void> // пишет строку леджера; изменение StudentAccount.coins остаётся на вызывающем, в той же tx
```

**Проверка**

```bash
pnpm --filter @repo/db exec prisma migrate dev --name coin_ledger
```

```bash
pnpm --filter platform check
```

Отметить ученика `PRESENT` в платформе, затем инвариант леджера (§11.24):

```bash
pnpm --filter @repo/db exec prisma db execute --stdin <<'SQL'
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "StudentAccount" a
    LEFT JOIN (SELECT "studentId", sum(amount) s FROM "CoinTransaction" GROUP BY "studentId") t
      ON t."studentId" = a."studentId"
    WHERE coalesce(t.s, 0) <> a.coins
  ) THEN RAISE EXCEPTION 'баланс разошёлся с леджером'; END IF;
END $$;
SQL
```

**Зависимости:** нет (технически), но осмысленно после A1. Блокирует A3 и A6.

---

## A3 — `/coins` + заглушка `/achievements` `[apps/]`

**Цель:** ученик видит баланс и историю его изменений.

**Файлы**

- `apps/shop/src/app/coins/page.tsx`, `apps/shop/src/app/achievements/page.tsx`
- `apps/shop/src/features/coins/actions.ts`
- `apps/shop/src/features/coins/components/coin-history.tsx`
- `apps/shop/src/components/student-nav.tsx` (+2 пункта)

**Компоненты `@repo/ui`:** `stat-card`, `table`, `badge`, `empty`, `separator`, `card` (заглушка ачивок — `empty` + `card`).

**Таблицы:** `CoinTransaction`, `StudentAccount.coins` — только чтение. Общей записи нет.

**Контракт**

```ts
getCoinHistory: studentAction.inputSchema(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
  -> {
    balance: number
    items: { id: number; amount: number; reason: CoinTxReason; createdAt: Date; orderId: number | null }[]
  }
```

**Проверка**

```bash
pnpm --filter shop check
```

```bash
curl -b /tmp/jar -s http://localhost:3002/coins | grep -c 'Посещение'
```

→ ≥1 после отметки `PRESENT` в платформе; показанный баланс равен `StudentAccount.coins` (§12.8).

**Зависимости:** A1, P2.

---

## P3 — Архивация товара вместо удаления `[packages/]`

**Цель:** товар нельзя стереть из БД — только скрыть, история заказов переживает «удаление».

**Файлы**

- `packages/db/prisma/schema/shop.prisma` — `Product.archivedAt DateTime?` (+`@@index([organizationId, archivedAt])`)
- `packages/db/prisma/migrations/<ts>_product_archived_at/migration.sql`
- `apps/platform/src/features/shop/products/actions.ts:94-110` — `deleteProduct` → `archiveProduct` (`update { archivedAt: now() }`), `deleteImageFile` для архивации **не** вызывается; `getProducts` отдаёт `archivedAt`
- `apps/platform/src/features/shop/products/components/products-table.tsx`, `product-actions.tsx` — «Удалить» → «Архивировать», бейдж «в архиве»
- `apps/platform/src/features/shop/products/schemas.ts`, `queries.ts`, `types.ts`

**Компоненты `@repo/ui`:** правки платформы переиспользуют уже стоящие там `badge`, `dropdown-menu`, `alert-dialog`.

**Таблицы:** `Product` — чтение+запись (`archivedAt`). Общая запись: **да** (`Product.quantity` пишет шоп в A6).

**Контракт**

```ts
archiveProduct: featureAction('shop').inputSchema(z.object({ id: z.number().int().positive() })) -> void
```

**Проверка**

```bash
pnpm --filter @repo/db exec prisma migrate dev --name product_archived_at
```

```bash
pnpm --filter platform check
```

Архивировать товар в платформе → строка помечена «в архиве», `SELECT count(*) FROM "Product"` не изменился.

**Зависимости:** нет. Блокирует A4.

---

## A4 — `/shop` каталог и `/shop/[id]` `[apps/]`

**Цель:** ученик видит доступные товары, фильтрует по категории и открывает карточку.

**Файлы**

- `apps/shop/src/app/shop/page.tsx`, `apps/shop/src/app/shop/[id]/page.tsx`
- `apps/shop/src/lib/features.ts` — локальный гейт (`OrganizationFeature.featureKey IN ('shop')`, A2 SPEC)
- `apps/shop/src/lib/safe-action.ts` — `+ export const shopAction = studentAction.use(featureGate)`
- `apps/shop/src/proxy.ts` — гейт 3 (`/shop*`, `/cart`, `/orders` при выключенной фиче)
- `apps/shop/src/features/catalog/actions.ts`
- `apps/shop/src/features/catalog/components/catalog-view.tsx`, `product-detail.tsx`
- `apps/shop/src/components/product-card.tsx`, `product-grid.tsx`, `coin-price.tsx` (локальные витринные, A7 SPEC — **в `@repo/ui` не уезжают**)
- `apps/shop/src/components/student-nav.tsx` (пункт «Магазин», скрыт при выключенной фиче)
- `apps/shop/package.json` — `+ nuqs`

**Компоненты `@repo/ui`:** `card`, `badge`, `button`, `select`, `tabs`, `skeleton`, `empty`, `number-field`, `separator` (шаг количества отдельным компонентом не пишем — §9 SPEC).

**Таблицы:** `Product`, `Category`, `OrganizationFeature` — только чтение (`where: { organizationId, archivedAt: null }`). Общей записи нет.

**Контракт**

```ts
getCatalog: shopAction.inputSchema(z.object({ categoryId: z.number().int().positive().optional() }))
  -> { id: number; name: string; description: string | null; imageUrl: string; price: number;
       quantity: number; category: { id: number; name: string } }[]

getProduct: shopAction.inputSchema(z.object({ id: z.number().int().positive() }))
  -> Product | throw NotFoundError   // archivedAt != null и чужая орга → одинаковый NOT_FOUND
```

**Проверка**

```bash
pnpm --filter shop check
```

```bash
curl -b /tmp/jar -s -o /dev/null -w '%{http_code}\n' http://localhost:3002/shop/<id_архивного_товара>
```

→ `404` (§11.12); он же отсутствует в `/shop`.

```bash
curl -b /tmp/jar -s -o /dev/null -w '%{http_code}\n' http://localhost:3002/shop/<id_товара_чужой_орги>
```

→ `404` (§11.9). После смены цены в платформе следующий же `curl -b /tmp/jar -s http://localhost:3002/shop` показывает новую цену без сброса кеша (§11.13).

**Зависимости:** A1, P3.

---

## A5 — `/cart` `[apps/]`

**Цель:** ученик собирает корзину, меняет количество и видит предварительные проблемы до подтверждения.

**Файлы**

- `apps/shop/src/app/cart/page.tsx`
- `apps/shop/src/features/cart/actions.ts`, `schemas.ts`, `queries.ts` (единственный слайс с TanStack Query — §5 SPEC)
- `apps/shop/src/features/cart/components/cart-view.tsx`, `cart-item-row.tsx`
- `apps/shop/src/features/cart/types.ts` — `CheckoutIssue`
- `apps/shop/src/app/providers.tsx` (новый) — `QueryClientProvider`
- `apps/shop/package.json` — `+ @tanstack/react-query`

**Компоненты `@repo/ui`:** `card`, `number-field`, `button`, `alert`, `separator`, `empty`, `drawer` (мобильный итог), `sonner`, `alert-dialog` (подтверждение — активируется в A6).

**Таблицы**

| Таблица                           | Р/З                                                           | Общая запись             |
| --------------------------------- | ------------------------------------------------------------- | ------------------------ |
| `Cart`, `CartItem`                | чтение+запись (upsert/update/delete, ленивое создание `Cart`) | нет — владеет шоп        |
| `Product`, `StudentAccount.coins` | чтение                                                        | нет записи в этом слайсе |

**Контракт**

```ts
type CheckoutIssue =
  | { productId: number; name: string; kind: 'OUT_OF_STOCK'; available: number }
  | { productId: number; name: string; kind: 'PRICE_CHANGED'; oldPrice: number; newPrice: number }
  | { productId: number; name: string; kind: 'UNAVAILABLE' }
  | { kind: 'INSUFFICIENT_COINS'; needed: number; available: number }

getCart: shopAction -> { items: { productId: number; name: string; imageUrl: string; price: number;
                                  quantity: number; available: number }[]
                         total: number; coins: number; issues: CheckoutIssue[] }
addToCart:            shopAction.inputSchema({ productId: number, quantity: int >= 1 }) -> void  // upsert по @@unique([cartId, productId])
setCartItemQuantity:  shopAction.inputSchema({ productId: number, quantity: int >= 1 }) -> void
removeCartItem:       shopAction.inputSchema({ productId: number })                     -> void
clearCart:            shopAction                                                        -> void
```

**Проверка**

```bash
pnpm --filter shop check
```

Дважды добавить один товар из UI, затем (§11.14):

```bash
pnpm --filter @repo/db exec prisma db execute --stdin <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM "CartItem" ci JOIN "Cart" c ON c.id=ci."cartId" WHERE c."studentId"=<ID>) <> 1
    THEN RAISE EXCEPTION 'ожидалась одна строка CartItem'; END IF;
END $$;
SQL
```

Гейт фичи (§11.6): выключить «Магазин» в платформе →

```bash
curl -b /tmp/jar -s -o /dev/null -w '%{http_code}\n' http://localhost:3002/cart
```

→ не `200`, при этом `/`, `/attendance`, `/coins` → `200` (§11.5).

**Зависимости:** A4.

---

## P4 — `Order` как шапка + `OrderItem` `[packages/]`

**Цель:** заказ выражает корзину из нескольких товаров и хранит цену на момент покупки.

**Файлы**

- `packages/db/prisma/schema/shop.prisma` — `Order { id, organizationId, studentId, status, createdAt }`, `OrderItem { id, organizationId, orderId, productId, quantity, priceAtPurchase }`, `OrderItem.product onDelete: Restrict` (`CartItem.product` остаётся `Cascade`)
- `packages/db/prisma/migrations/<ts>_order_items/migration.sql` — старые `Order` 1:1 → шапка + одна позиция с `priceAtPurchase = Product.price`
- `apps/platform/src/features/shop/orders/actions.ts` — `getOrders` через `include: { items: { include: { product: true } } }`; `changeOrderStatus` считает возврат по сумме позиций и пишет `CoinTransaction(ORDER_CANCELLED)` + возврат `Product.quantity`
- `apps/platform/src/features/shop/orders/components/orders-table.tsx`, `order-actions.tsx`, `types.ts`
- `apps/platform/src/features/students/actions.ts:780-830` — `getStudentShopStats` (`totalSpent`, `recentOrders`) на новую форму
- `apps/platform/src/features/students/components/detail/shop-section.tsx`
- `apps/platform/src/features/demo/seed.ts:587` — `order.createMany` → шапка + позиции

**Компоненты `@repo/ui`:** правки платформы остаются на текущих `data-table`, `badge`, `dropdown-menu`.

**Таблицы**

| Таблица                                    | Р/З                        | Общая запись                                       |
| ------------------------------------------ | -------------------------- | -------------------------------------------------- |
| `Order`, `OrderItem`                       | чтение+запись              | **да** — шоп создаёт (A6), платформа меняет статус |
| `StudentAccount.coins`, `Product.quantity` | запись при отмене          | **да**                                             |
| `CoinTransaction`                          | запись (`ORDER_CANCELLED`) | **да**                                             |

**Контракт**

```ts
getOrders (платформа): -> (Order & { student: Student; items: (OrderItem & { product: Product })[] })[]
changeOrderStatus: сигнатура не меняется; возврат = sum(items.quantity * items.priceAtPurchase)
```

**Проверка**

```bash
pnpm --filter @repo/db exec prisma migrate dev --name order_items
```

```bash
pnpm --filter @repo/db exec prisma db execute --stdin <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM "Order") <> (SELECT count(DISTINCT "orderId") FROM "OrderItem")
    THEN RAISE EXCEPTION 'миграция заказов 1:1 не сошлась'; END IF;
END $$;
SQL
```

```bash
pnpm --filter platform check
```

Страница `/{slug}/shop/orders` открывается, мигрированные заказы показаны шапкой с одной позицией (§11.31).

**Зависимости:** P2 (леджер для `ORDER_CANCELLED`). Блокирует A6.

---

## A6 — Чекаут и `/orders` `[apps/]`

**Цель:** ученик оформляет заказ за коины одной транзакцией «всё-или-ничего» и видит историю заказов.

**Файлы**

- `apps/shop/src/app/orders/page.tsx`
- `apps/shop/src/features/cart/actions.ts` (+`checkout`), `queries.ts` (+`useCheckoutMutation` → `router.refresh()`)
- `apps/shop/src/features/cart/components/checkout-button.tsx`, `checkout-issues.tsx`
- `apps/shop/src/features/orders/actions.ts`
- `apps/shop/src/features/orders/components/orders-list.tsx`
- `apps/shop/src/components/student-nav.tsx` (+пункт «Заказы»)

**Компоненты `@repo/ui`:** `accordion` (раскрытие позиций inline — отдельного `/orders/[id]` нет), `badge`, `table`, `empty`, `card`, `alert-dialog`, `alert`, `sonner`.

**Таблицы**

| Таблица                | Р/З                                               | Общая запись                           |
| ---------------------- | ------------------------------------------------- | -------------------------------------- |
| `Order`, `OrderItem`   | запись (создание `PENDING`)                       | **да** — статус потом меняет платформа |
| `CoinTransaction`      | запись (`ORDER_PURCHASE`)                         | **да**                                 |
| `StudentAccount.coins` | запись (`decrement`, только в транзакции чекаута) | **да**                                 |
| `Product.quantity`     | запись (`decrement`, только в транзакции чекаута) | **да**                                 |
| `CartItem`             | удаление                                          | нет                                    |

**Контракт**

```ts
checkout: shopAction -> { orderId: number }        // при проблемах — ActionError с { issues: CheckoutIssue[] }
getOrders: shopAction -> { id: number; status: OrderStatus; createdAt: Date; total: number;
                           items: { name: string; imageUrl: string; quantity: number; priceAtPurchase: number }[] }[]
```

Порядок внутри одной `prisma.$transaction` (§8 SPEC): перечитать товары и `coins` → собрать **весь** список `issues` → непусто ⇒ rollback, корзина не тронута → иначе условные `updateMany` (`quantity: { gte: qty }`, `coins: { gte: total }`; `count !== 1` ⇒ throw) → `Order`+`OrderItem[]` → `CoinTransaction(ORDER_PURCHASE, -total)` → очистить `CartItem`.

**Проверка**

```bash
pnpm --filter shop check
```

Сценарий §12.10–13: положить 2 шт. (баланс ровно на сумму) → в платформе снизить остаток до 1 → подтвердить заказ. Ожидание: сообщение `OUT_OF_STOCK`, затем (§11.16, §11.18):

```bash
pnpm --filter @repo/db exec prisma db execute --stdin <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM "Order" WHERE "studentId"=<ID>) <> 0 THEN RAISE EXCEPTION 'заказ создан при OUT_OF_STOCK'; END IF;
  IF (SELECT count(*) FROM "CartItem" ci JOIN "Cart" c ON c.id=ci."cartId" WHERE c."studentId"=<ID>) = 0
    THEN RAISE EXCEPTION 'корзина очищена при откате'; END IF;
END $$;
SQL
```

После успешного чекаута — инвариант леджера из P2 плюс:

```bash
pnpm --filter @repo/db exec prisma db execute --stdin <<'SQL'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE quantity < 0) THEN RAISE EXCEPTION 'остаток ушёл в минус'; END IF;
  IF EXISTS (SELECT 1 FROM "StudentAccount" WHERE coins < 0) THEN RAISE EXCEPTION 'баланс отрицателен'; END IF;
END $$;
SQL
```

**Зависимости:** A5, P4.

---

## P5 (опционально, вне основного PR) — чистка мёртвых полей `Product` `[packages/]`

**Цель:** убрать `rating`, `reviews`, `popular`, `originalPrice` — наследие шаблона интернет-магазина (S6 SPEC).

**Файлы:** `packages/db/prisma/schema/shop.prisma`, `packages/db/prisma/migrations/<ts>_drop_product_dead_fields/`, места чтения в `apps/platform/src/features/shop/products/*` и `apps/platform/src/features/demo/seed.ts`.

**Проверка:** `pnpm --filter @repo/db exec prisma migrate dev --name drop_product_dead_fields` + `pnpm check` на всём монорепо.

**Зависимости:** после A4 (каталог не должен читать эти поля).

---

# Граф зависимостей

```
P1 ──► A1 ──► A2
       │
       ├──► A3 ◄── P2
       │
       └──► A4 ◄── P3
             │
             └──► A5 ──► A6 ◄── P4 ◄── P2

P5 — опционально, после A4
```

Первый сквозной путь: **P1 → A1** (`/` → `getProfile` → существующие `Student`/`Group`/`Parent` → карточка на `card`/`item`/`stat-card`).

---

# Неоднозначности (помечены, не додуманы)

1. **Тонкий сквозной путь не может быть первым слайсом буквально.** Любой роут, кроме `/login`, требует сессии ученика, а её негде взять без таблиц better-auth. Поэтому P1 (миграция) идёт нулевым, а A1 — первый _фиче_-слайс. Альтернатива (временная самодельная сессия на plaintext-пароле) — выбрасываемый код, не предлагается.
2. **P1 — это две миграции, а не одна**, вопреки правилу «одна миграция на слайс»: хеш better-auth нельзя посчитать в SQL, поэтому между «добавить таблицы/колонки» и «удалить `password`» встаёт TS-скрипт backfill'а. Если нужно строго одну миграцию — придётся раздавать ученикам новые пароли.
3. **S4 слит с S5 в P1** (дедуп логинов обязателен в момент backfill'а). Если нужен отдельный слайс — сообщите.
4. **Стратегия дедупа логинов** не задана SPEC: план предполагает суффикс `-2`, `-3` по возрасту записи. Школы об этом не узнают автоматически — нужен ли отчёт/уведомление?
5. **`STUDENT_PW_KEY`**: ротация ключа и что делать со старым шифротекстом — не описано. План: ключ один, ротации нет; при неверном ключе `revealStudentPassword` падает с внятной ошибкой, вход при этом работает (§11.28).
6. **Гонку двух одновременных чекаутов (§11.19) без тест-раннера объективно не проверить.** Условные `updateMany` — правильная защита, но её проверка остаётся «на глазах» (две вкладки). Это прямое следствие решения «без раннера».
7. **`Cart.studentId @unique` — глобальный**, без `organizationId` в ключе. Не ломается (ученик принадлежит одной орге), но правило «`organizationId` в каждом `where`» (§6.3) для `cart.findUnique({ where: { studentId } })` придётся выражать через `findFirst`.
8. **`/orders` за фича-гейтом**: при выключенном «Магазине» ученик теряет доступ к истории уже совершённых покупок. По SPEC §7.3 это так и задумано — подтвердите.
9. **Демо-сид** (`apps/platform/src/features/demo/seed.ts`) ломается дважды: на P2 (леджер) и P4 (`order.createMany`). Правки включены в оба слайса, но демо-организация не создаёт `StudentUser` — **ученик демо-школы войти в шоп не сможет**, пока в сид не добавят учётки. Нужно ли это в v1?
10. **Деплой `shop.{rootDomain}`** (DNS/reverse proxy на порт 3002) живёт вне репозитория — план его не покрывает, как и для `apps/docs`.
11. **Тексты ошибок чекаута** («Осталось только N шт.» и т.п.) SPEC задаёт только для входа; формулировки для `CheckoutIssue` — на согласование в A5/A6.

---

# Итоговая проверка (после всех слайсов)

```bash
pnpm check
```

Затем сквозной сценарий §12 SPEC на локальном стенде (`platform:3000`, `shop:3002`, общая БД).
Проход засчитывается, только если пункты **12** (гонка остатка), **15** (отмена + возврат),
**17** (архивация не рушит историю) и **18** (выключение фичи) отработали дословно.
