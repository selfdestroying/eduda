# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ЕДУДА** (`alg-dashboard-v2`) is a multi-tenant SaaS dashboard for educational centers / schools — managing students, groups, lessons, attendance, finances (payments, salaries, profit), and an internal shop. UI strings and most code comments are in **Russian**; keep new user-facing text in Russian.

Stack: Next.js 16 (App Router, React 19, React Compiler), Prisma 7 (PostgreSQL via `pg` adapter), better-auth, next-safe-action, TanStack Query + Table, Tailwind v4 + shadcn (`base-mira` style), Zod v4, nuqs.

## Monorepo layout (pnpm + Turborepo)

The repo is a **pnpm workspace** driven by **Turborepo** (`turbo.json`). Five packages today:

- **`apps/platform`** — the Next.js dashboard, port 3000 (everything that used to be at the repo root: `src/`, `public/`, `next.config.ts`, etc.). Its `.env` holds every var the dashboard needs. **All `src/...` paths mentioned elsewhere in this file live under `apps/platform/`.**
- **`apps/docs`** (`docs`) — the public documentation, port 3001: fumadocs + the MDX content in `apps/docs/content/docs/` (`user/`, `dev/`). No auth, no DB, its own tiny `.env` (`NEXT_PUBLIC_ROOT_DOMAIN`, `PORT`). See «Documentation».
- **`apps/shop`** (`shop`) — личный кабинет ученика, port 3002: каталог, корзина, заказы за астрокоины, посещаемость и профиль. Свой инстанс better-auth на таблицах `Student*` с `cookiePrefix: 'edu_student'` — сессия ученика и сессия сотрудника не пересекаются. Живёт на едином домене `shop.{rootDomain}` (DNS/реверс-прокси ведёт туда напрямую, как в `apps/docs`), организация приходит **из сессии**, а не из поддомена. Своё `.env` (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `PORT`). См. «Кабинет ученика».
- **`packages/db`** (`@repo/db`) — Prisma: schema (`packages/db/prisma/schema/`), migrations, `prisma.config.ts`, the generated client (`packages/db/generated/`, gitignored) and the `prisma` singleton. Ships raw TS via `exports` (no build step); the app transpiles it (`transpilePackages: ['@repo/db']`).
- **`packages/ui`** (`@repo/ui`) — the design system: shadcn primitives + app-agnostic composites (`packages/ui/src/components/`, flat), `use-mobile` (`src/hooks/`), `cn` (`src/lib/utils.ts`), design tokens and the base layer (`src/styles/globals.css`), plus the shared `postcss.config.mjs`. Same shape as `@repo/db`: raw TS via `exports`, no build step, transpiled by the app.

Shared config packages (`@repo/config` и т.п.) — **planned, not present**: `apps/shop` копирует конфиги `apps/docs`. Третий потребитель будет поводом вернуться к вопросу.

## Commands

Run from the **repo root** (Turborepo fans out to packages):

```bash
pnpm dev               # turbo dev — platform (3000) + docs (3001) + shop (3002)
pnpm build             # turbo build (runs @repo/db generate + typegen first)
pnpm check             # turbo check (format+lint+tsc) — run before committing
pnpm ts:check          # turbo ts:check
pnpm lint              # turbo lint
pnpm format            # prettier --write . (whole repo, root-level)

pnpm --filter @repo/db generate   # regenerate Prisma client (also runs on install via postinstall)
pnpm --filter @repo/db migrate    # prisma migrate dev (schema: packages/db/prisma/schema/*.prisma, multi-file)
```

shadcn components are added **from the app**, not from the package — the CLI reads `apps/platform/components.json` and writes into `@repo/ui` (see «Design system»):

```bash
pnpm --filter platform exec shadcn add <component>
```

`pnpm install` at the root generates the Prisma client (`@repo/db` postinstall) and the fumadocs `.source` collection (`docs` postinstall). Native build scripts are gated by pnpm — approvals live in `pnpm-workspace.yaml` (`allowBuilds`).

There is **no test suite**. Verification = `pnpm check` + running the app. `prisma.config.ts` references a `prisma/seed.ts` that does not exist.

**Одноразовый шаг при накатывании миграций учеников.** Между `20260723120000_student_auth`
и `20260723120100_drop_student_password` обязан отработать backfill: первая
добавляет таблицы better-auth и `passwordEnc`, вторая удаляет колонку с открытым
паролем, а посчитать хеш в SQL нельзя. Вторая миграция это проверяет и падает с
`RAISE EXCEPTION`, если backfill пропущен, — данные при этом целы:

```bash
pnpm --filter platform exec tsx scripts/backfill-student-auth.ts
```

На чистой БД (учеников ещё нет) шаг не нужен: проверка проходит на пустой таблице.

## Git / commits

- Run `pnpm check` before committing.
- **Do NOT add `Co-Authored-By` trailers** (or any AI/tool attribution) to commit messages.
- Follow Conventional Commits (`feat(...)`, `fix(...)`, `style(...)`, `ci:`, …) — match the existing history.

## Path aliases

`@/*` maps to **the app's own package root** (each app's `tsconfig.json`), so in-app imports are `@/src/lib/...`, `@/src/components/...`, etc. The Prisma client, enums and singleton come from the workspace package **`@repo/db`**: `import { prisma } from '@repo/db'`, types/enums via `@repo/db` or the `@repo/db/enums` / `@repo/db/browser` subpaths (`browser` is the server-free build for client components).

UI comes from **`@repo/ui`**: `@repo/ui/components/<name>` (no `ui/` segment — the folder is flat), `@repo/ui/hooks/use-mobile`, `@repo/ui/lib/utils`. Neither package is in `tsconfig.json#paths` — both resolve through the package `exports` map. `cn` is re-exported from `@/src/lib/utils` for convenience, so existing call sites keep working; the implementation lives only in `@repo/ui/lib/utils`.

## Multi-tenancy & request routing (critical)

Tenancy is by **subdomain = organization slug**, resolved in `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`):

- `{slug}.{rootDomain}/path` is rewritten to the `/[slug]/path` route segment; an `x-organization` header is set. All tenant pages live under `src/app/[slug]/`.
- Reserved subdomains `auth`, `admin`, `shop` rewrite to `/auth`, `/admin`, `/shop` instead. `docs` is **not** among them any more — it's a separate app (`apps/docs`) that DNS/the reverse proxy routes to directly, so `docs.{rootDomain}` never reaches this proxy. It stays in `RESERVED_SUBDOMAINS` only so no school can claim the slug.
- The proxy verifies the session's `organization.slug` matches the subdomain (else redirect to root) and enforces **feature flags** (`isRouteDisabled`).
- Local dev uses subdomains like `slug.localhost:3000` / a `.test` domain — see `.env.example` (`NEXT_PUBLIC_ROOT_DOMAIN`, `BETTER_AUTH_URL`). Cross-subdomain cookies are enabled.

## Server actions & data flow (the core pattern)

Each feature follows the same layering — when adding functionality, mirror it:

```
src/features/<feature>/
  actions.ts     'use server' — next-safe-action server actions (DB access)
  queries.ts     TanStack Query hooks (useQuery/useMutation) that call the actions
  schemas.ts     Zod input schemas + inferred *SchemaType types
  types.ts       shared types
  components/     feature UI
```

- Define actions with `authAction` (auth required) or `publicAction` from `src/lib/safe-action.ts`. `authAction` injects `ctx.session` (with `organizationId`, `memberRole`, `organization`, `disabledFeatures`); unauthenticated requests redirect to the auth subdomain.
- Every action takes `.metadata({ actionName })`, optionally `.inputSchema(ZodSchema)`, then `.action(async ({ ctx, parsedInput }) => ...)`.
- **Tenant isolation is manual.** There is no automatic `organizationId` filter — every query/mutation must scope by `ctx.session.organizationId` (e.g. `where: { id, organizationId: ctx.session.organizationId! }`, or `findFirstOrThrow` to verify ownership before nested writes). Multi-step writes use `prisma.$transaction`. Follow the patterns in `src/features/groups/actions.ts`.
- Query hooks unwrap the safe-action result: `const { data, serverError } = await someAction(); if (serverError) throw serverError; return data ?? ...`. Query keys are centralized per feature (e.g. `groupKeys`).
- Not every feature has all files — a small/UI-heavy feature may inline its Zod schema in `actions.ts` and skip `schemas.ts`, or add `hooks/` and `lib/` subdirs (see `src/features/calendar/`). Match the shape the feature already has.

## Auth & permissions

- `src/lib/auth/server.ts` configures better-auth with the `organization` + `admin` plugins. Email/password only, **sign-up disabled**. `customSession` augments the session with the user's member org, role, and disabled features.
- RBAC roles `owner` / `manager` / `teacher` with granular statements are defined in `src/lib/permissions/organization.ts` (global/admin perms in `permissions/global.ts`). Note: per the audit in `docs/CODE_REVIEW.md`, RBAC enforcement inside actions has historically been incomplete — scope-check roles where it matters.
- `docs/CODE_REVIEW.md` is a Feb 2026 security audit referencing an **older** `src/actions/` + `src/shared/` layout (since refactored into `src/features/*`). Treat it as historical context, not current structure.

## Dates & timezone (important convention)

Timezone is **per organization** (`Organization.timezone`), not global — `DEFAULT_TZ` (`Europe/Moscow`) is only the fallback for an unset/invalid value. Get the zone from `ctx.tz` on the server (injected by `authAction`) or `useOrgTimezone()` on the client, and pass it into the helpers — never hardcode a zone.

Genuine timestamp fields (`createdAt`, `updatedAt`, `snoozedUntil`, …) are real `DateTime`s — for "today"/day-boundary logic go through `src/lib/timezone.ts` (`nowInTz(tz)`, `startOfDayInTz(tz)`, `endOfDayInTz(tz)`, `toTz`/`fromTz`, `formatInTz`, `formatDateTimeInTz`) rather than raw `new Date()`, since the server runs `TZ=UTC`.

**Date-only columns are `String`, not `DateTime`.** `Lesson.date`, `Group.startDate`/`statusChangedAt`, `StudentGroup.statusChangedAt`, `Payment.date`, `Expense.date`, `PayCheck.date`, `ManagerSalary.startDate`/`endDate`, `Rent.startDate`/`endDate`, `Student.birthDate` store a calendar day as a `"YYYY-MM-DD"` string (like `Lesson.time`). They sort/compare lexicographically = chronologically, so Prisma `gte`/`lt`/`orderBy` work directly on the string. Helpers in `src/lib/timezone.ts`: `DateOnlySchema` (Zod `z.string().regex`), `todayYmdInTz(tz)` (today in the org's zone as `YYYY-MM-DD`), `dateToYmd(Date)` (a picker `Date` → string), `ymdToLocalDate(ymd)` (string → local `Date` for `date-fns format()`), `formatDateOnly`/`formatDate`. Date pickers keep a `Date` in-form and convert at the boundary (`dateToYmd` on submit, `ymdToLocalDate` for `selected`/display). These columns hold a **user-chosen business day** (often back-datable), which is why they're strings rather than `now()`-style timestamps — never write a `Date` to them; where a status-change row is created without an explicit day, default it to `todayYmdInTz(ctx.tz)`.

Возраст ученика **не хранится**: колонка `Student.age` удалена — это был кеш, который протухал в каждый день рождения. Считайте из `birthDate` на чтение (`getAgeFromBirthDate(birthDate, tz)` в `src/lib/utils.ts`); в таблицах это `accessorFn`, а не `accessorKey`, чтобы сортировка осталась по числу.

## Calendar

`src/features/calendar/` is the lessons calendar (`/calendar` route + optional home view). It deviates from the standard feature layout: `hooks/use-calendar.ts` holds all view/navigation state (returns a `CalendarController` passed down to view components), `lib/` holds pure helpers, and there is no `schemas.ts`.

- **Date strings end-to-end.** Server ↔ client exchange and `Lesson.date` storage are both `YYYY-MM-DD` strings, so `getCalendarLessons` filters/returns `l.date` with no conversion. `lib/date-utils.ts` holds the calendar's own client-side date math (grid/week/range) — separate from `src/lib/timezone.ts`, which is still the source of truth for "today"/business-day logic.
- **Colors** are deterministic by id (`lib/constants.ts` palette). Use `hexA(hex, a)` from `lib/date-utils.ts` to apply alpha; pass `1` when a swatch must stay fully opaque (event bar, filter checkbox legend).
- **Teacher scoping**: `getCalendarLessons` shows a teacher only their own lessons unless they hold `lesson.readAll` — on top of the usual `organizationId` scope.
- **Opt-in home view.** A `home_view=calendar` cookie (client-set via `lib/view-preference.ts`) makes `src/app/[slug]/page.tsx` render `<Calendar />` **in place at `/`** (no redirect — a server `redirect()` from the prefetched `/` route breaks RSC navigation). The `ClassicViewButton` clears the cookie and refreshes.

## Design system (`@repo/ui`)

Everything reusable across apps lives in `packages/ui/` — shadcn base-mira primitives _and_ app-agnostic composites (`data-table`, `hint`, `stat-card`, `number-field`/`number-input`, `password-input`, `table-filter`, `custom-combobox`, `drag-scroll-area`, `switch-theme-button`, `logo`). All of them sit **flat** in `packages/ui/src/components/`, imported as `@repo/ui/components/<name>`.

- **Inside the package** use the same alias form (`@repo/ui/components/button`, `@repo/ui/lib/utils`) — that's what `shadcn add` writes, and `packages/ui/tsconfig.json#paths` makes it self-resolve.
- **Anything touching `src/features/*`, the feature registry or platform routes stays in `apps/platform/src/components/`** (`sidebar/`, `landing/`, `assistant-ui/`, `feature-gate.tsx`, `course-location-teacher-filters.tsx`). Don't move app-coupled UI into the package.
- **CSS.** `packages/ui/src/styles/globals.css` owns tailwind/tw-animate/shadcn imports, `@theme inline`, the `:root`/`.dark` palette, the base layer and custom utilities (`thin-scrollbar`, `animate-landing-*`, `animate-tab-enter` + `--ease-tab`/`--duration-tab`). It carries its own `@source '../'` so consumers pick up the package's classes — Tailwind's auto-detection is rooted at the app's cwd and skips `node_modules`. Each app still needs its **own** entry file (`src/styles/globals.css`) for exactly that reason: `apps/platform`'s is a bare re-import, `apps/docs`' adds the fumadocs presets on top.
- **`shadcn add` runs from the app** (`apps/platform`) — the CLI reads its `components.json`, sees `"ui": "@repo/ui/components"` and writes into the package. `style`/`baseColor`/`iconLibrary` must stay identical in both `components.json` files.
- Deps the package owns (`@base-ui/react`, `cmdk`, `clsx`, `tailwind-merge`, `tw-animate-css`, …) were removed from `apps/platform/package.json` — pnpm doesn't forgive phantom deps, so add back explicitly if the app starts importing one directly. `shadcn add` re-adds `@base-ui/react` to the app's `package.json`; revert that hunk.
- **`Drawer` is Base UI**, not vaul (`@base-ui/react/drawer` — `Drawer.Root` is a `Dialog` underneath). So popovers, dropdowns and selects inside a drawer portal to `document.body` like anywhere else: no `container` prop needed. `swipeDirection` (`down`/`up`/`left`/`right`), `showSwipeHandle` for the grabber, `render` instead of `asChild` on trigger/close.

## Documentation (`apps/docs`)

Public docs live in their **own Next app** (fumadocs, port 3001) — no auth, no DB, no `@repo/db`.

- Content: `apps/docs/content/docs/{user,dev}/*.mdx` + `meta.json` (order, lucide icons, extra links). Plain markdown — no custom MDX components are in use.
- `source.config.ts` (`defineDocs` + the `lastModified` plugin) generates `.source/`, reachable via the `collections/*` tsconfig alias; the `fumadocs-mdx` postinstall regenerates it. **Move MDX files with `git mv`** — `lastModified` reads git history.
- **Stop the docs dev server before `pnpm check`.** While `next dev` runs, fumadocs-mdx blanks `.source/server.ts` (dev serves content through the Turbopack loader instead), and `tsc` then fails with `File '.source/server.ts' is not a module`. Recover with `pnpm --filter docs exec fumadocs-mdx`.
- `loader({ baseUrl: '/' })` — docs sit at the app root (`/user/...`), so the routes are `src/app/[[...slug]]/page.tsx` and a single `src/app/layout.tsx` that carries html/fonts, `RootProvider` (ru translations, search off, dark default) **and** `DocsLayout`. `RootProvider` already provides `next-themes`, so there's no separate `ThemeProvider`.
- **Same design as the dashboard** via `@repo/ui/globals.css` + `fumadocs-ui/css/shadcn.css`, which makes fumadocs read the project's shadcn tokens. Don't restyle fumadocs by hand.
- Text endpoints: `/llms.txt`, `/llms-full.txt`, and `/llms-user.txt` (the `user/` section only). The last one is **consumed by the platform**: `apps/platform/src/features/assistant/system-prompt.ts` fetches it once, caches it in process memory and falls back to a built-in blurb when docs are unreachable. Adding user docs therefore improves the AI assistant for free.
- The dashboard links to docs via `docsUrl` (`apps/platform/src/lib/utils.ts`) — `NEXT_PUBLIC_DOCS_URL`, defaulting to `docs.{rootDomain}`. Set it to `http://localhost:3001` in local dev.

## Деньги: пакеты и журнал движений

Оплата — это **пакет** (`Payment.remaining`), посещение — **проводка** (`Attendance.paymentId/price/amount`). Занятие гасит самый ранний непотраченный пакет кошелька и копирует его цену урока в строку; после этого цена не пересчитывается, поэтому новые оплаты не двигают закрытые месяцы.

Пакетов нет — занятие **не списывается и не оценивается**: `price = null`, `amount = 0`, баланс не двигается, строки журнала нет. Цену выдумывать нечем, а выдуманная потом требует переписывания прошлого. Такое занятие ждёт оплаты: она спишет его обычным порядком, по своей цене (`settleUnpaidAttendancesTx`). Предикат «ждёт оплаты» описан один раз — `UNPAID_ATTENDANCE_WHERE` в `finances/chargeable.server.ts`; там же `chargeableClassesWhere` с неочевидной частью про NULL. Баланс кошелька из-за этого не уходит в минус.

Занятия, списанные «в долг» до перехода 10.08.2026, остались с выданными тогда ценами и в отчётах прошлых месяцев: у них `amount = 1`, а «ждёт оплаты» — это `amount = 0`.

Все движения остатка проходят через `src/features/finances/ledger.server.ts` — единственное место, где посещение превращается в деньги. Наружу торчат `chargeAttendanceTx` и `unchargeAttendanceTx` (плюс `recordWalletEntryTx` для оплат): каждая сама двигает пакет, баланс, проводку, журнал и историю. **Не двигайте `wallet.lessonsBalance` и `payment.remaining` мимо них** — экшенов ручной правки баланса, перевода и объединения кошельков в системе нет намеренно.

`WalletEntry` — append-only журнал: строки не правятся и не удаляются, откат пишет встречную строку со ссылкой `reversalOfId`. Отсюда два инварианта, которые обязаны сходиться всегда:

- `Σ quantity` по кошельку = `Wallet.lessonsBalance`
- `Σ quantity` по пакету = `Payment.remaining`

`effectiveAt` — бизнес-день (дата занятия или оплаты), `createdAt` — когда записали; отчёты строятся по первому, «как было на дату» — по второму. Оплату нельзя удалить, только отменить (`status = CANCELLED`): на неё ссылаются проводки проведённых занятий.

Проверки (гоняются против настоящей БД, ничего не меняют):

```bash
pnpm --filter platform exec tsx scripts/check-ledger-core.ts       # ядро в откатываемой транзакции
pnpm --filter platform exec tsx scripts/check-ledger.ts            # журнал против колонок
pnpm --filter platform exec tsx scripts/check-wallet-balance.ts
pnpm --filter platform exec tsx scripts/check-revenue-parity.ts
pnpm --filter platform exec tsx scripts/check-package-statuses.ts  # статусы счёта против его пакетов
pnpm --filter platform exec tsx scripts/check-package-product.ts   # продукт пакета: снимок и изоляция
```

## Feature flags

`src/lib/features/registry.ts` is the source of truth for toggleable features (hierarchical keys like `finances.packages`). The DB stores only **disabled** overrides (`OrganizationFeature`, default = enabled). Each entry carries its own `routes` prefixes, from which the registry derives the URL → feature key table (longest prefix wins); the proxy blocks disabled routes and the sidebar hides them.

## Кабинет ученика (`apps/shop`)

Отдельное приложение на порту 3002. Всё, что ниже, — инварианты, а не стиль.

- **Организация — из сессии.** Домен единый, поддомена школы нет. Единственный резолв — `getStudentSession` (`src/lib/auth/student-session.ts`): он же гейт «школа недоступна» (живая кука без `StudentAccount` не открывает ничего) и он же кеширует сессию better-auth на рендер. Им пользуются `studentAction`, layout кабинета и страница входа — иначе получается цикл редиректов.
- **Изоляция ручная.** В `where` каждого запроса обязан быть `ctx.student.organizationId`. Исключения ровно два и оба прокомментированы: резолв в `student-session.ts` (он организацию и определяет) и `cart.upsert` по `studentId` (ключ глобальный по схеме, `studentId` приходит из сессии).
- **Кеша нет.** Каталог, остатки и коины пишет платформа — отдельный деплой, куда `revalidateTag` не достаёт. Все страницы `force-dynamic`; query-слой (TanStack) есть только у корзины, остальное — чистый RSC.
- **Пароли учеников.** Вход идёт по хешу better-auth, а школа видит пароль из `StudentAccount.passwordEnc` (AES-256-GCM, ключ `STUDENT_PW_KEY` в `.env` платформы). Ученик пароль не меняет, поэтому копии не расходятся. Учётку заводит только платформа — `createStudentUserTx` (`apps/platform/src/lib/student-auth.ts`), и мимо него это делать нельзя: там живёт нормализация `username` в нижний регистр, без которой ученик с логином вида «Ivanov» не войдёт.
- **Формат логина принадлежит платформе.** Плагин `username` в шопе запущен с выключенной валидацией: у школ уже раздали логины с дефисами, точками, заглавными и кириллицей, и дефолтный валидатор better-auth (`/^[a-zA-Z0-9_.]+$/`) отрезал бы этих учеников от входа.
- **Чекаут — всё-или-ничего.** Одна транзакция: перечитать товары и коины → собрать `issues` целиком → непусто ⇒ rollback (корзина не тронута) → иначе условные `updateMany` с `quantity >= n`, `price = ...` и `coins >= total`. `count !== 1` означает, что кто-то успел раньше. Позиции сортируются по `productId`, чтобы одновременные чекауты брали блокировки в одном порядке.
- **Фича `shop`.** Гейт продублирован: страницы отдают `notFound()`, а `shopAction` отказывает независимо от того, как до неё дошли. `/orders` намеренно **вне** гейта — коины уже списаны, история покупок остаётся видимой.
- **Достижения.** Каталог живёт в коде (`src/features/achievements/registry.ts`) — добавить награду значит дописать строчку, без миграции. В БД (`StudentAchievement`) попадает только факт получения со снимком награды; прогресс считается на чтение (`stats.ts`), поэтому правка посещаемости задним числом ничего не пересчитывает. Одна `collectStats` на страницу и на claim — иначе экран покажет «можно забрать», а claim откажет. Защита от повторной выдачи — только `@@unique([studentId, key])`; повторяемые награды подмешивают период в ключ (`birthday:2026`). Раздел **вне** гейта `shop`: коины дают за учёбу. Экономику наград (потолки выплат, отсутствие петли «награда за коины») держит `apps/shop/scripts/check-achievements.ts`.
- **`@repo/ui` не меняется.** Витринные `product-card`, `product-grid`, `coin-price` — локальные в `apps/shop/src/components/`, потребитель один.

## Prisma

Lives in the **`@repo/db`** package (`packages/db/`). Multi-file schema under `packages/db/prisma/schema/` (`auth`, `students`, `groups`, `lessons`, `finance`, `shop`, `enums`, ...). Client output → `packages/db/generated/` (gitignored). Singleton in `packages/db/src/prisma.ts` uses the `PrismaPg` adapter and is re-exported as `{ prisma }` from `@repo/db`. `prisma.config.ts` loads env from `apps/platform/.env`. Run Prisma CLI via `pnpm --filter @repo/db <script>`. Most models carry `organizationId`.
