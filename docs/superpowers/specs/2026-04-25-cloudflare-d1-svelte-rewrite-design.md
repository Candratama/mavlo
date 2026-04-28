# Cloudflare + D1 SvelteKit Rewrite — Design Spec

**Date:** 2026-04-25
**Status:** Approved (design phase)
**Scope:** Greenfield rewrite of the Maflo personal-finance app from Next.js + Appwrite to SvelteKit + Cloudflare Workers + D1, in a fresh repository.

## 1. Goals

- Run the application on Cloudflare's edge platform (Workers, D1, R2).
- Replace Appwrite (auth, database, storage, teams) with first-party Cloudflare primitives plus Better Auth.
- Simplify the multi-tenant model to single-user (sharing/spaces deferred).
- Ship a focused MVP — auth, accounts, categories, transactions, budgets, settings, dashboard, charts, PWA — without porting every legacy feature.
- Keep the legacy Next.js codebase untouched as a reference until the new app reaches parity.

## 2. Non-Goals

- No data migration from the existing Appwrite database (no production data exists).
- No multi-space sharing / invites / memberships in MVP. Schema is scoped by `user_id` directly. Sharing can be added later via a `space_id` migration if it returns.
- No 3D landing (`@react-three/fiber` / `three`) port.
- No internationalization (locale store) port.
- No Playwright e2e suite.
- No port of `test-components` page.

## 3. Stack

| Layer            | Choice                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| Framework        | SvelteKit 2 + Svelte 5 (runes)                                                     |
| Build / dev      | Vite, TypeScript (strict)                                                          |
| Styling          | Tailwind v4, shadcn-svelte (bits-ui)                                               |
| Forms            | Superforms + zod                                                                   |
| Theme            | mode-watcher                                                                       |
| Charts           | layerchart                                                                         |
| Server state     | TanStack Query Svelte (only where SvelteKit `load` + `invalidate` is insufficient) |
| PWA              | `@vite-pwa/sveltekit` (workbox)                                                    |
| Testing          | Vitest unit; component tests via `@testing-library/svelte`. No e2e.                |
| Auth             | Better Auth (Drizzle adapter)                                                      |
| ORM              | Drizzle ORM + `drizzle-kit`                                                        |
| Database         | Cloudflare D1                                                                      |
| Object storage   | Cloudflare R2 (avatars)                                                            |
| Email            | Resend (HTTP API; works in Workers)                                                |
| Runtime / deploy | Cloudflare Workers via `@sveltejs/adapter-cloudflare`                              |
| Repository       | Fresh git repo, separate from current `maflo`                                      |

## 4. Topology

A single Worker serves SSR, static assets, form actions, and API endpoints. Bindings:

| Binding               | Resource    | Purpose                            |
| --------------------- | ----------- | ---------------------------------- |
| `DB`                  | D1 database | Better Auth tables + app tables    |
| `BUCKET`              | R2 bucket   | Avatars                            |
| `SESSION_SECRET`      | secret      | Better Auth                        |
| `RESEND_API_KEY`      | secret      | Email send                         |
| `RESEND_SENDER_EMAIL` | var         | Sender address                     |
| `RESEND_SENDER_NAME`  | var         | Sender display name                |
| `PUBLIC_APP_URL`      | var         | Origin for absolute URLs in emails |

Two environments: `preview` (separate D1, R2) and `production`. Configured in `wrangler.toml`.

## 5. Data Schema

All timestamps are `INTEGER` epoch milliseconds. All money is `INTEGER` cents. All IDs are `TEXT` cuid2 generated client-side / in app code (not by D1).

### 5.1 Better Auth tables

Managed by the Better Auth Drizzle adapter and renamed to avoid clashing with the app `accounts` table:

- `users` — `id`, `email` (unique), `email_verified` (INT 0/1), `name`, `image`, timestamps
- `sessions` — `id`, `user_id` FK, `token`, `expires_at`, `ip_address`, `user_agent`
- `auth_accounts` — provider linkage (renamed from default `accounts`); fields: `id`, `user_id`, `provider_id`, `account_id`, `password` (hash), tokens, timestamps
- `verifications` — `id`, `identifier`, `value`, `expires_at`

### 5.2 App tables

All app tables include `user_id TEXT NOT NULL` referencing `users(id)` with `ON DELETE CASCADE`.

```sql
accounts                          -- financial accounts
  id TEXT PK
  user_id TEXT FK users(id)
  name TEXT NOT NULL
  type TEXT CHECK(type IN ('cash','bank','card','ewallet','other'))
  currency TEXT NOT NULL          -- ISO 4217
  starting_balance_cents INTEGER NOT NULL DEFAULT 0
  color TEXT
  icon TEXT
  archived_at INTEGER             -- epoch ms, null = active
  created_at INTEGER NOT NULL
  updated_at INTEGER NOT NULL

categories
  id TEXT PK
  user_id TEXT FK
  name TEXT NOT NULL
  kind TEXT CHECK(kind IN ('income','expense'))
  parent_id TEXT FK categories(id) NULLABLE
  color TEXT
  icon TEXT
  archived_at INTEGER
  created_at INTEGER NOT NULL
  updated_at INTEGER NOT NULL

transactions
  id TEXT PK
  user_id TEXT FK
  account_id TEXT FK accounts(id)
  category_id TEXT FK categories(id) NULLABLE
  type TEXT CHECK(type IN ('income','expense','transfer'))
  amount_cents INTEGER NOT NULL   -- always positive; sign derived from type
  currency TEXT NOT NULL
  occurred_at INTEGER NOT NULL    -- epoch ms; tz handled in app
  note TEXT
  payee TEXT
  transfer_account_id TEXT FK accounts(id) NULLABLE  -- for type='transfer'
  created_at INTEGER NOT NULL
  updated_at INTEGER NOT NULL

budgets
  id TEXT PK
  user_id TEXT FK
  category_id TEXT FK categories(id) NULLABLE  -- null = overall
  amount_cents INTEGER NOT NULL
  period TEXT CHECK(period IN ('weekly','monthly','yearly'))
  start_date INTEGER NOT NULL     -- period anchor
  created_at INTEGER NOT NULL
  updated_at INTEGER NOT NULL

user_preferences
  user_id TEXT PK FK users(id)
  locale TEXT NOT NULL DEFAULT 'en'
  currency_default TEXT NOT NULL DEFAULT 'USD'
  theme TEXT NOT NULL DEFAULT 'system'
  week_start INTEGER NOT NULL DEFAULT 1   -- 0=Sun, 1=Mon
  updated_at INTEGER NOT NULL
```

### 5.3 Indexes

- `transactions(user_id, occurred_at DESC)` — list + range queries
- `transactions(user_id, category_id)` — category filter / aggregate
- `transactions(user_id, account_id)` — per-account view + balance
- `categories(user_id, kind)` — filter by income/expense
- `budgets(user_id, category_id)` — match a transaction to its budget
- `auth_accounts(user_id)` — login lookup

### 5.4 Migrations

Generated by `drizzle-kit generate` into `drizzle/`. Applied in dev with `wrangler d1 migrations apply DB --local` and on deploy with `wrangler d1 migrations apply DB --remote`.

## 6. Auth & Authorization

### 6.1 Better Auth configuration

- Drizzle adapter pointing at the D1 binding `DB`.
- Email + password (sole provider for MVP).
- Email verification required for sensitive operations (password change, account deletion). Sign-in itself does not require verification.
- Password reset via emailed token.
- Session cookie `__session`: HttpOnly, Secure, SameSite=Lax, 30-day rolling expiry, stored in the D1 `sessions` table (no KV cache for MVP).
- Rate limiting enabled for sign-in, sign-up, and forgot-password endpoints.
- CSRF: Better Auth's built-in token plus SvelteKit's default `Origin` check on form actions.

### 6.2 Session injection

`src/hooks.server.ts` runs on every request:

1. Calls `auth.api.getSession({ headers: event.request.headers })`.
2. Sets `event.locals.user` and `event.locals.session` (typed in `src/app.d.ts`).
3. Provides `event.locals.db` — Drizzle instance bound to `event.platform.env.DB`.

`(app)/+layout.server.ts` redirects to `/sign-in` if `locals.user` is missing.

### 6.3 Authorization model

Single-user. There is no shared resource concept. Every server action, `load`, and `+server.ts` handler:

1. Calls `requireUser(event)` (helper in `src/lib/server/guards.ts`); throws `redirect(303, '/sign-in')` if absent.
2. Scopes every Drizzle query with `where eq(table.userId, locals.user.id)`.

Service functions in `src/lib/server/services/*` accept `(db, userId, payload)` and never trust caller-supplied IDs without scoping by `userId`.

### 6.4 Email flows

- Sign-up: action calls `auth.api.signUp.email`, then inserts a default `user_preferences` row, then sends a verification email (Resend) and redirects to `/dashboard`.
- Forgot password: action calls Better Auth `forgetPassword.requestReset` → Resend.
- Reset password: action calls Better Auth `resetPassword` with the token from the URL.
- Email templates live in `src/lib/server/email/templates/*.ts` as plain template literals (no React Email).

## 7. App Structure

```
src/
  app.html
  app.d.ts                       # Locals type: user, session, db
  app.css                        # Tailwind v4 entry
  hooks.server.ts                # Auth, locals.db, error logger
  hooks.client.ts                # Client error reporter (optional)
  service-worker.ts              # Generated by vite-pwa

  lib/
    server/
      db/
        index.ts                 # drizzle(env.DB) factory
        schema.ts                # re-exports per-domain schema files
        schema/
          auth.ts users.ts accounts.ts categories.ts
          transactions.ts budgets.ts preferences.ts
      auth.ts                    # Better Auth instance + helpers
      email/
        resend.ts                # send() wrapper
        templates/*.ts
      services/                  # business logic, Drizzle calls
        accounts.ts categories.ts transactions.ts budgets.ts preferences.ts
      guards.ts                  # requireUser(event), requireDb(event)
    validation/
      schemas.ts                 # zod schemas (shared client + server)
    utils/
      money.ts dates.ts currency.ts colors.ts icons.ts
    components/
      ui/                        # shadcn-svelte primitives
      forms/                     # reusable form fields
      charts/                    # layerchart wrappers
      layout/                    # bottom-nav, app-shell, header
      shared/                    # empty-state, error-display, loading-state
    stores/
      preferences.ts             # Svelte 5 runes-based
      theme.ts

  routes/
    +layout.svelte               # global providers
    +layout.server.ts            # load user + preferences
    (auth)/
      +layout.svelte             # auth shell
      sign-in/+page.svelte +page.server.ts
      sign-up/+page.svelte +page.server.ts
      forgot-password/+page.svelte +page.server.ts
      reset-password/+page.svelte +page.server.ts
      verify-email/+page.svelte +page.server.ts
    (app)/
      +layout.svelte             # bottom-nav, header
      +layout.server.ts          # redirect if !user
      dashboard/+page.svelte +page.server.ts
      transactions/+page.svelte +page.server.ts +page.ts
      accounts/+page.svelte +page.server.ts
      categories/+page.svelte +page.server.ts
      budgets/+page.svelte +page.server.ts
      settings/+page.svelte +page.server.ts
    api/
      auth/[...all]/+server.ts   # Better Auth handler mount
      health/+server.ts          # readiness probe
    offline/+page.svelte
```

## 8. Data Flow

### 8.1 Read path

1. Request hits `/transactions`.
2. `hooks.server.ts` populates `locals.user` and `locals.db`.
3. `(app)/+layout.server.ts` confirms auth and loads `user` + `preferences`.
4. `transactions/+page.server.ts`'s `load` runs `db.select().from(transactions).where(eq(transactions.userId, user.id))` with filter / pagination params.
5. Returns serialized data; `+page.svelte` renders SSR; client hydrates.

### 8.2 Write path

1. User submits a Superform.
2. SvelteKit form action in `+page.server.ts`:
   - `requireUser(event)`
   - `superValidate(request, schema)` (zod parse)
   - On invalid: `return fail(400, { form })`
   - On valid: call `services/<domain>.create(db, userId, data)`
   - On success: `return { form, ... }` or `throw redirect(...)`
3. SvelteKit auto-revalidates the page's `load` data after the action returns.

### 8.3 Client interactivity

- Forms work without JS (progressive enhancement) and hydrate via Superforms.
- Lists trigger `invalidate('app:transactions')` after mutations.
- Reactive UI state uses Svelte 5 runes (`$state`, `$derived`).
- Cross-component state (theme, preferences) flows via `getContext` / `setContext` set in `+layout.svelte`.
- TanStack Query Svelte is reserved for cases SvelteKit cannot handle ergonomically (infinite scroll lists, optimistic UI, polling).

### 8.4 File uploads (avatars)

- Settings page form action accepts `multipart/form-data`.
- Server action validates file size + MIME, then `event.platform.env.BUCKET.put(key, file.stream(), { httpMetadata })`.
- Public read via a proxy endpoint `/api/avatars/[userId]/+server.ts` that fetches from R2 (`event.platform.env.BUCKET.get`) and streams the response with appropriate cache headers. Avoids exposing R2 directly and keeps URLs stable across rotation. Direct R2 public access can be added later behind a CDN if needed.

## 9. PWA

`@vite-pwa/sveltekit` configured with workbox:

- Precache static assets and `app.html`.
- Runtime cache: image assets (CacheFirst, 30-day), JS/CSS (StaleWhileRevalidate, 24-hour), `/api/health` (NetworkFirst).
- Offline fallback: `/offline`.
- Manifest carries the same identity as the legacy app (name, theme color, icons). Icons regenerated from the existing source via the legacy `scripts/generate-pwa-icons.mjs`-equivalent in the new repo.

## 10. Error Handling

- **Server:** `hooks.server.ts` `handleError` logs structured JSON (correlation id, user id when available, route, error class, trimmed stack). Returns a sanitized message to the client.
- **Client:** `hooks.client.ts` `handleError` is a stub for MVP; a `/api/log` endpoint may be added later if telemetry is needed.
- **Forms:** zod field errors surface inline through Superforms.
- **Auth:** Better Auth typed errors map to friendly user-facing copy in form actions.
- **Routes:** `+error.svelte` per route group ((auth), (app)).
- **Services:** throw typed `AppError` subclasses (`NotFoundError`, `ValidationError`, `AuthError`); higher layers map to `fail()` or `error()`.

## 11. Testing Strategy

- **Pure utilities:** Vitest unit tests for `money`, `dates`, `currency`, schema validators. No I/O.
- **Services:** test `services/*.ts` against in-memory SQLite (`better-sqlite3`) seeded from the same Drizzle schema. Verify scoping by `userId` and business rules (e.g., transfer pairs, budget periods).
- **Form actions:** invoke action handlers with a synthetic `event` (mock `locals.user`, in-memory DB) and assert response shape.
- **Components:** `@testing-library/svelte` for forms with non-trivial validation behavior and list rendering edge cases.
- **Out of scope:** Playwright e2e, Workers-runtime tests, real D1.

## 12. Deployment

- `wrangler.toml` defines bindings, vars, and per-environment overrides (`[env.preview]`, `[env.production]`).
- Secrets via `wrangler secret put`; never committed.
- `npm run build` invokes `@sveltejs/adapter-cloudflare` and produces a Worker bundle.
- `wrangler deploy --env preview` and `wrangler deploy --env production` for the two stages.
- D1 migrations:
  - Local: `wrangler d1 migrations apply DB --local`.
  - Remote: applied as part of the deploy script before `wrangler deploy`.
- Local dev: `npm run dev` (SvelteKit + Vite). Wrangler-bound resources are stubbed via SvelteKit's Cloudflare dev integration; D1 uses a local SQLite file.

## 13. Build / Port Sequence

The detailed implementation plan will be produced by the writing-plans skill. High-level order:

1. Bootstrap fresh repo: SvelteKit + TS, Tailwind v4, shadcn-svelte init, Prettier + ESLint.
2. Configure `wrangler.toml`, provision D1 + R2 (preview + production), wire `adapter-cloudflare`.
3. Drizzle schema + initial migration; seed script for development data.
4. Better Auth integration; sign-up, sign-in, verify-email, forgot-password, reset-password flows.
5. App shell: `(app)` layout, bottom-nav, theme provider, preferences load.
6. Accounts CRUD (list page, form dialog, archive).
7. Categories CRUD with parent / child support.
8. Transactions CRUD with filters and pagination.
9. Budgets CRUD.
10. Dashboard aggregates: balances, monthly summary, top categories.
11. Charts on dashboard and transactions (layerchart).
12. Settings: preferences form, password change, profile, avatar upload to R2.
13. PWA + offline page + manifest + icons.
14. Vitest suites added alongside each feature.
15. Deploy to preview, smoke-test, deploy to production.

## 14. Risks & Open Items

- **Better Auth + Drizzle D1 adapter maturity** — verify current API and Workers compatibility during the writing-plans phase before committing implementation order.
- **Workers CPU / time limits** — dashboard aggregate queries may need to be split or memoized if they exceed the default subrequest budget. Profile under load and consider KV caching as a follow-up.
- **D1 read-replica latency from Asia** — current Appwrite project lives in `syd`. D1 replicates automatically; monitor real-world latency from primary user regions before scaling out.
- **Resend deliverability** — `support@kodesafari.tech` already configured for the legacy app; reuse SPF / DKIM with the new sending environment.
- **Secrets in legacy `.env.local`** — `APPWRITE_API_KEY` and `RESEND_API_KEY` are present in the legacy working tree. Rotate both during the cut-over and ensure they never enter the new repo's git history.

## 15. Out of Scope (Explicit)

- Multi-user sharing, invites, memberships, teams.
- 3D landing visuals.
- i18n / locale switching.
- Existing Appwrite data migration.
- Playwright e2e suite.
- `test-components` page.
- Mobile native shell.
