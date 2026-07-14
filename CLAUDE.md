# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ЕДУДА** (`alg-dashboard-v2`) is a multi-tenant SaaS dashboard for educational centers / schools — managing students, groups, lessons, attendance, finances (payments, salaries, profit), and an internal shop. UI strings and most code comments are in **Russian**; keep new user-facing text in Russian.

Stack: Next.js 16 (App Router, React 19, React Compiler), Prisma 7 (PostgreSQL via `pg` adapter), better-auth, next-safe-action, TanStack Query + Table, Tailwind v4 + shadcn (`base-mira` style), Zod v4, nuqs.

## Commands

```bash
npm run dev            # dev server (port 3000)
npm run build          # production build
npm run check          # format check + lint + tsc --noEmit  (run before committing)
npm run check:fix      # format + lint --fix
npm run ts:check       # tsc --noEmit only
npm run lint           # eslint

npx prisma generate    # regenerate client into prisma/generated (gitignored — run after schema changes / fresh clone)
npx prisma migrate dev # create + apply a migration (schema lives in prisma/schema/*.prisma, multi-file)
```

There is **no test suite**. Verification = `npm run check` + running the app. `prisma.config.ts` references a `prisma/seed.ts` that does not exist.

## Git / commits

- Run `npm run check` before committing.
- **Do NOT add `Co-Authored-By` trailers** (or any AI/tool attribution) to commit messages.
- Follow Conventional Commits (`feat(...)`, `fix(...)`, `style(...)`, `ci:`, …) — match the existing history.

## Path aliases

`@/*` maps to the **repo root** (not `src/`). So imports are `@/src/lib/...`, `@/prisma/generated/client`, etc. The Prisma client is imported from `@/prisma/generated/client`.

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

Business timezone is **Europe/Moscow** (`BUSINESS_TZ`). Genuine timestamp fields (`createdAt`, `updatedAt`, `snoozedUntil`, …) are real `DateTime`s — for "today"/day-boundary logic go through `src/lib/timezone.ts` (`moscowNow()`, `moscowStartOfDay()`, `formatMoscow()`, …) rather than raw `new Date()`, since the server runs `TZ=UTC`.

**Date-only columns are `String`, not `DateTime`.** `Lesson.date`, `Group.startDate`/`statusChangedAt`, `StudentGroup.statusChangedAt`, `Payment.date`, `Expense.date`, `PayCheck.date`, `ManagerSalary.startDate`/`endDate`, `Rent.startDate`/`endDate`, `Student.birthDate` store a calendar day as a `"YYYY-MM-DD"` string (like `Lesson.time`). They sort/compare lexicographically = chronologically, so Prisma `gte`/`lt`/`orderBy` work directly on the string. Helpers in `src/lib/timezone.ts`: `DateOnlySchema` (Zod `z.string().regex`), `moscowTodayYmd()` (today as `YYYY-MM-DD`), `dateToYmd(Date)` (a picker `Date` → string), `ymdToLocalDate(ymd)` (string → local `Date` for `date-fns format()`), `formatDateOnly`/`formatDate`. Date pickers keep a `Date` in-form and convert at the boundary (`dateToYmd` on submit, `ymdToLocalDate` for `selected`/display). These columns hold a **user-chosen business day** (often back-datable), which is why they're strings rather than `now()`-style timestamps — never write a `Date` to them; where a status-change row is created without an explicit day, default it to `moscowTodayYmd()`.

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

Multi-file schema under `prisma/schema/` (`auth`, `students`, `groups`, `lessons`, `finance`, `shop`, `enums`, ...). Client output → `prisma/generated/` (gitignored). Singleton in `src/lib/db/prisma.ts` uses the `PrismaPg` adapter. Most models carry `organizationId`.
