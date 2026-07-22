# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ЕДУДА** (`alg-dashboard-v2`) is a multi-tenant SaaS dashboard for educational centers / schools — managing students, groups, lessons, attendance, finances (payments, salaries, profit), and an internal shop. UI strings and most code comments are in **Russian**; keep new user-facing text in Russian.

Stack: Next.js 16 (App Router, React 19, React Compiler), Prisma 7 (PostgreSQL via `pg` adapter), better-auth, next-safe-action, TanStack Query + Table, Tailwind v4 + shadcn (`base-mira` style), Zod v4, nuqs.

## Monorepo layout (pnpm + Turborepo)

The repo is a **pnpm workspace** driven by **Turborepo** (`turbo.json`). Two packages today:

- **`apps/platform`** — the Next.js app (everything that used to be at the repo root: `src/`, `content/docs`, `public/`, `next.config.ts`, etc.). Its `.env` lives here and is the **single source of truth** for environment vars. **All `src/...`, `content/...` paths mentioned elsewhere in this file now live under `apps/platform/`.**
- **`packages/db`** (`@repo/db`) — Prisma: schema (`packages/db/prisma/schema/`), migrations, `prisma.config.ts`, the generated client (`packages/db/generated/`, gitignored) and the `prisma` singleton. Ships raw TS via `exports` (no build step); the app transpiles it (`transpilePackages: ['@repo/db']`).

`apps/shop` and shared UI/config packages are **planned, not present** — don't scaffold them until needed.

## Commands

Run from the **repo root** (Turborepo fans out to packages):

```bash
pnpm dev               # turbo dev — platform dev server (port 3000)
pnpm build             # turbo build (runs @repo/db generate + typegen first)
pnpm check             # turbo check (format+lint+tsc) — run before committing
pnpm ts:check          # turbo ts:check
pnpm lint              # turbo lint
pnpm format            # prettier --write . (whole repo, root-level)

pnpm --filter @repo/db generate   # regenerate Prisma client (also runs on install via postinstall)
pnpm --filter @repo/db migrate    # prisma migrate dev (schema: packages/db/prisma/schema/*.prisma, multi-file)
```

`pnpm install` at the root generates the Prisma client (`@repo/db` postinstall) and fumadocs (`platform` postinstall). Native build scripts are gated by pnpm — approvals live in `pnpm-workspace.yaml` (`allowBuilds`).

There is **no test suite**. Verification = `pnpm check` + running the app. `prisma.config.ts` references a `prisma/seed.ts` that does not exist.

## Git / commits

- Run `pnpm check` before committing.
- **Do NOT add `Co-Authored-By` trailers** (or any AI/tool attribution) to commit messages.
- Follow Conventional Commits (`feat(...)`, `fix(...)`, `style(...)`, `ci:`, …) — match the existing history.

## Path aliases

`@/*` maps to the **`apps/platform` package root** (its own `tsconfig.json`), so in-app imports are `@/src/lib/...`, `@/src/components/...`, etc. The Prisma client, enums and singleton come from the workspace package **`@repo/db`**: `import { prisma } from '@repo/db'`, types/enums via `@repo/db` or the `@repo/db/enums` / `@repo/db/browser` subpaths (`browser` is the server-free build for client components).

## Multi-tenancy & request routing (critical)

Tenancy is by **subdomain = organization slug**, resolved in `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`):

- `{slug}.{rootDomain}/path` is rewritten to the `/[slug]/path` route segment; an `x-organization` header is set. All tenant pages live under `src/app/[slug]/`.
- Reserved subdomains `auth`, `admin`, `shop` rewrite to `/auth`, `/admin`, `/shop` instead.
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

## Calendar

`src/features/calendar/` is the lessons calendar (`/calendar` route + optional home view). It deviates from the standard feature layout: `hooks/use-calendar.ts` holds all view/navigation state (returns a `CalendarController` passed down to view components), `lib/` holds pure helpers, and there is no `schemas.ts`.

- **Date strings end-to-end.** Server ↔ client exchange and `Lesson.date` storage are both `YYYY-MM-DD` strings, so `getCalendarLessons` filters/returns `l.date` with no conversion. `lib/date-utils.ts` holds the calendar's own client-side date math (grid/week/range) — separate from `src/lib/timezone.ts`, which is still the source of truth for "today"/business-day logic.
- **Colors** are deterministic by id (`lib/constants.ts` palette). Use `hexA(hex, a)` from `lib/date-utils.ts` to apply alpha; pass `1` when a swatch must stay fully opaque (event bar, filter checkbox legend).
- **Teacher scoping**: `getCalendarLessons` shows a teacher only their own lessons unless they hold `lesson.readAll` — on top of the usual `organizationId` scope.
- **Opt-in home view.** A `home_view=calendar` cookie (client-set via `lib/view-preference.ts`) makes `src/app/[slug]/page.tsx` render `<Calendar />` **in place at `/`** (no redirect — a server `redirect()` from the prefetched `/` route breaks RSC navigation). The `ClassicViewButton` clears the cookie and refreshes.

## Popovers/dropdowns inside drawers

`PopoverContent` and `DropdownMenuContent` accept a `container` prop (forwarded to the Base UI `Portal`). Inside a vaul `Drawer`, portal them into the drawer content (pass its ref) — otherwise vaul's overlay swallows outside clicks and the popover can't be interacted with. See the lesson detail drawer + `AttendanceStatusSwitcher` / `AttendanceCommentPopover`.

## Feature flags

`src/lib/features/registry.ts` is the source of truth for toggleable features (hierarchical keys like `finances.payments`). The DB stores only **disabled** overrides (`OrganizationFeature`, default = enabled). `route-feature-map.ts` maps URL patterns → feature keys; the proxy blocks disabled routes and the sidebar hides them.

## Prisma

Lives in the **`@repo/db`** package (`packages/db/`). Multi-file schema under `packages/db/prisma/schema/` (`auth`, `students`, `groups`, `lessons`, `finance`, `shop`, `enums`, ...). Client output → `packages/db/generated/` (gitignored). Singleton in `packages/db/src/prisma.ts` uses the `PrismaPg` adapter and is re-exported as `{ prisma }` from `@repo/db`. `prisma.config.ts` loads env from `apps/platform/.env`. Run Prisma CLI via `pnpm --filter @repo/db <script>`. Most models carry `organizationId`.
