# Phase 1 Adapted Implementation Plan (Bootstrap + Auth)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach a deployed Cloudflare Workers preview with working email+password auth (sign-up, sign-in, email verification, password reset, sign-out), authenticated app shell, dashboard placeholder, and `user_preferences` upsert — built on top of the `sv create` scaffold already present at `/Users/candratama/Project/WebDev/mavlo`.

**Architecture:** SvelteKit 2 + Svelte 5 (runes) on Cloudflare Workers via `@sveltejs/adapter-cloudflare`. D1 (SQLite) accessed through Drizzle ORM. Better Auth (`better-auth/minimal`) with Drizzle adapter for sessions/users. Resend for transactional email. Tailwind v4 + shadcn-svelte (added incrementally). Form-action sign-in (server-only via `auth.api.signInEmail`); no client-side auth-client.

**Tech Stack:** SvelteKit 2.57, Svelte 5.55, drizzle-orm 0.45, drizzle-kit 0.31, better-auth ~1.4.21, wrangler ^4.81, vitest 4.1, tailwindcss 4.2, typescript 6.0.

**Conventions:**
- `<NEW_REPO>` = `/Users/candratama/Project/WebDev/mavlo`
- All `wrangler` invocations: `npx wrangler ...`
- Money: INTEGER cents
- Timestamps: INTEGER epoch ms
- IDs: cuid2
- Branch: subagents commit directly to `main` (fresh empty repo, branch strategy A)
- Run `npm` commands from `<NEW_REPO>`

---

## What `sv create` Already Did (Skip / Reference Only)

Scaffold at `<NEW_REPO>` already provides:
- ✅ SvelteKit 2 + Svelte 5 runes (`svelte.config.js` forces runes mode)
- ✅ `@sveltejs/adapter-cloudflare` configured in `svelte.config.js`
- ✅ Tailwind v4 + `@tailwindcss/typography`
- ✅ ESLint + Prettier + `prettier-plugin-tailwindcss`
- ✅ `wrangler.jsonc` (compatibility flag `nodejs_als`, ASSETS binding, workers_dev) — **needs D1/R2/vars bindings added**
- ✅ `drizzle.config.ts` (sqlite + d1-http driver) — schema path `./src/lib/server/db/schema.ts`
- ✅ `src/lib/server/db/index.ts` — `getDb(d1)` returns Drizzle client
- ✅ `src/lib/server/db/schema.ts` — currently exports demo `task` table; re-exports `./auth.schema`
- ✅ `src/lib/server/db/auth.schema.ts` — placeholder; populated by `npm run auth:schema`
- ✅ `src/lib/server/auth.ts` — `createAuth(d1)` with `better-auth/minimal`, drizzleAdapter, `sveltekitCookies` plugin, `getRequestEvent` bridge
- ✅ `src/hooks.server.ts` — injects `locals.auth/user/session` per request, fails if `platform.env.DB` missing
- ✅ `src/app.d.ts` — `Locals.user/session/auth` typed; `Platform.env: Env`
- ✅ Vitest 4 dual-project config (`client` browser via Playwright, `server` node) — server include glob `src/**/*.{test,spec}.{js,ts}` already covers what we need
- ✅ Demo Better Auth route at `/demo/better-auth` + `/demo/better-auth/login` with form-action sign-in/sign-up — **delete in T17**
- ✅ npm scripts: `dev`, `build`, `preview`, `gen`, `db:push`, `db:generate`, `db:migrate`, `db:studio`, `auth:schema`, `lint`, `format`, `test`, `test:unit`, `check`
- ✅ `.env` + `.env.example` with `CLOUDFLARE_ACCOUNT_ID/DATABASE_ID/D1_TOKEN`, `ORIGIN`, `BETTER_AUTH_SECRET` — **populated in T2/T3**

**Plan tasks below ONLY cover what's still missing.**

---

## Pre-Flight (User-Run, Not Subagent-Run)

These require Cloudflare account access. User executes manually before subagent dispatch resumes.

- [ ] **PF-1: Authenticate Wrangler**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler@latest login
```

Expected: opens browser, OAuth flow, `Successfully logged in`.

- [ ] **PF-2: Create initial commit (empty scaffold baseline)**

User runs once before any subagent dispatch so subagents have a base commit to add to:

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add -A
git commit -m "chore: initial sv create scaffold

Bootstrap from sv@latest with: typescript, prettier, eslint, vitest,
tailwindcss (typography), sveltekit-adapter (cloudflare/workers),
drizzle (D1), better-auth (email/password demo)."
```

---

## Task 1: Add Project Dependencies

**Files:**
- Modify: `<NEW_REPO>/package.json`

Adds runtime deps (shadcn-svelte foundation + Resend + cuid2 + zod + vite-pwa + dev tooling for in-memory DB tests).

- [ ] **Step 1: Install runtime deps**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm install \
  @paralleldrive/cuid2 \
  bits-ui \
  clsx \
  formsnap \
  lucide-svelte \
  mode-watcher \
  resend \
  svelte-sonner \
  sveltekit-superforms \
  tailwind-merge \
  tailwind-variants \
  zod
```

- [ ] **Step 2: Install dev deps**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm install -D \
  @types/better-sqlite3 \
  better-sqlite3 \
  @vite-pwa/sveltekit \
  vite-plugin-pwa \
  workbox-window
```

`better-sqlite3` is for Vitest server-tests against an in-memory SQLite DB. `@types/better-sqlite3` typings only.

- [ ] **Step 3: Verify**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm ls zod @paralleldrive/cuid2 better-sqlite3 resend
```

Expected: all four resolve, no `UNMET DEPENDENCY`.

- [ ] **Step 4: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add package.json package-lock.json
git commit -m "chore: add runtime + test dependencies for phase 1"
```

---

## Task 2 (User-Run): Provision D1 + R2 + Generate Secret

**Files:** none (Cloudflare-side resources)

User runs because requires Cloudflare creds. Returns IDs needed for T3.

- [ ] **Step 1: Create D1 database**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler d1 create mavlo
```

Capture from output:
- `database_name = "mavlo"`
- `database_id = "<UUID>"` ← record this

- [ ] **Step 2: Create D1 API token (Cloudflare dashboard)**

Dashboard → My Profile → API Tokens → Create Token → Custom token:
- Account → D1 → Edit (account: your account)
- Save token value as `CLOUDFLARE_D1_TOKEN`

Also record `CLOUDFLARE_ACCOUNT_ID` (visible in dashboard URL or `npx wrangler whoami`).

- [ ] **Step 3: Create R2 bucket**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler r2 bucket create mavlo-uploads
```

- [ ] **Step 4: Generate Better Auth secret**

```bash
openssl rand -base64 32
```

Record output as `BETTER_AUTH_SECRET`.

- [ ] **Step 5: Resend account + API key**

If not already done: sign up at resend.com, verify sending domain (`mavlo.app` or chosen), create API key. Record as `RESEND_API_KEY`.

Also choose `RESEND_FROM` (e.g., `Mavlo <noreply@mavlo.app>`).

- [ ] **Step 6: Hand off to subagent**

User pastes IDs/secrets to controller; controller injects into T3.

---

## Task 3: Wire Bindings + Secrets Files

**Files:**
- Modify: `<NEW_REPO>/wrangler.jsonc`
- Modify: `<NEW_REPO>/.env`
- Modify: `<NEW_REPO>/.env.example`
- Create: `<NEW_REPO>/.dev.vars`
- Create: `<NEW_REPO>/.dev.vars.example`
- Modify: `<NEW_REPO>/.gitignore`

Adds D1, R2, vars to `wrangler.jsonc`. `.env` populated for `drizzle-kit` (HTTP driver). `.dev.vars` populated for `wrangler dev` runtime secrets (Resend, Better Auth secret).

- [ ] **Step 1: Update `wrangler.jsonc`**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "mavlo",
  "compatibility_date": "2026-04-25",
  "compatibility_flags": ["nodejs_als"],
  "main": ".svelte-kit/cloudflare/_worker.js",
  "assets": {
    "binding": "ASSETS",
    "directory": ".svelte-kit/cloudflare"
  },
  "workers_dev": true,
  "preview_urls": true,
  "vars": {
    "ORIGIN": "https://mavlo.<your-subdomain>.workers.dev",
    "RESEND_FROM": "Mavlo <noreply@mavlo.app>"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "mavlo",
      "database_id": "<DATABASE_ID_FROM_T2>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "UPLOADS",
      "bucket_name": "mavlo-uploads"
    }
  ]
}
```

Replace `<DATABASE_ID_FROM_T2>` and `<your-subdomain>` with values from T2. `RESEND_API_KEY` and `BETTER_AUTH_SECRET` are NOT in `vars` — they go in `.dev.vars` for local + `npx wrangler secret put` for production (T20).

- [ ] **Step 2: Populate `.env`** (drizzle-kit only, gitignored)

Replace contents:

```
# Cloudflare D1 (used by drizzle-kit d1-http driver for db:push/generate)
CLOUDFLARE_ACCOUNT_ID="<ACCOUNT_ID_FROM_T2>"
CLOUDFLARE_DATABASE_ID="<DATABASE_ID_FROM_T2>"
CLOUDFLARE_D1_TOKEN="<D1_TOKEN_FROM_T2>"

# Used by SvelteKit (Vite dev) and better-auth schema generation
ORIGIN="http://localhost:5173"
BETTER_AUTH_SECRET="<SECRET_FROM_T2>"
```

- [ ] **Step 3: Update `.env.example`** (committed, no secrets)

```
# Cloudflare D1 (drizzle-kit d1-http driver)
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_DATABASE_ID=""
CLOUDFLARE_D1_TOKEN=""

# SvelteKit dev + better-auth CLI
ORIGIN="http://localhost:5173"
BETTER_AUTH_SECRET=""
```

- [ ] **Step 4: Create `.dev.vars`** (gitignored — runtime secrets for `wrangler dev` / `npm run preview`)

```
BETTER_AUTH_SECRET="<SAME_SECRET_AS_DOTENV>"
RESEND_API_KEY="<RESEND_KEY_FROM_T2>"
```

- [ ] **Step 5: Create `.dev.vars.example`** (committed)

```
BETTER_AUTH_SECRET=""
RESEND_API_KEY=""
```

- [ ] **Step 6: Update `.gitignore`** — confirm `.dev.vars` and `.env` ignored (scaffold already ignores `.env`; add `.dev.vars` line if missing)

```bash
cd /Users/candratama/Project/WebDev/mavlo
grep -E '^\.env$|^\.dev\.vars$' .gitignore
```

If `.dev.vars` not present, append:

```
.dev.vars
```

- [ ] **Step 7: Verify wrangler config valid**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler types
```

Expected: regenerates `worker-configuration.d.ts` with `Env { DB: D1Database; UPLOADS: R2Bucket; ORIGIN: string; RESEND_FROM: string; BETTER_AUTH_SECRET: string; RESEND_API_KEY: string }` (secrets get added too).

- [ ] **Step 8: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add wrangler.jsonc .env.example .dev.vars.example .gitignore worker-configuration.d.ts
git commit -m "feat(infra): bind D1, R2, vars; add dev.vars template"
```

`.env` and `.dev.vars` are NOT committed.

---

## Task 4: Replace Demo Schema with App Schema

**Files:**
- Modify: `<NEW_REPO>/src/lib/server/db/schema.ts`
- Test: `<NEW_REPO>/src/lib/server/db/schema.test.ts`

Replaces demo `task` table with mavlo app tables: `accounts`, `categories`, `transactions`, `budgets`, `user_preferences`. All scoped by `user_id` FK to Better Auth `users` table (referenced via `./auth.schema`).

- [ ] **Step 1: Write failing test**

Create `<NEW_REPO>/src/lib/server/db/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as schema from './schema';

describe('app schema exports', () => {
  it('exports all required app tables', () => {
    expect(schema.accounts).toBeDefined();
    expect(schema.categories).toBeDefined();
    expect(schema.transactions).toBeDefined();
    expect(schema.budgets).toBeDefined();
    expect(schema.userPreferences).toBeDefined();
  });

  it('does not export the demo task table', () => {
    // @ts-expect-error: should be removed
    expect(schema.task).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: FAIL — `accounts is undefined` (and `task` still defined).

- [ ] **Step 3: Replace `src/lib/server/db/schema.ts`**

```typescript
import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './auth.schema';

const cuid = () => text().notNull().$defaultFn(() => createId());
const userIdFk = () =>
  text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' });
const epochMsNow = () => integer({ mode: 'number' }).notNull().$defaultFn(() => Date.now());

export const accounts = sqliteTable(
  'accounts',
  {
    id: cuid().primaryKey(),
    userId: userIdFk(),
    name: text('name').notNull(),
    type: text('type', { enum: ['cash', 'bank', 'credit', 'wallet', 'other'] }).notNull(),
    currency: text('currency').notNull().default('IDR'),
    initialBalanceCents: integer('initial_balance_cents', { mode: 'number' }).notNull().default(0),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: epochMsNow(),
    updatedAt: epochMsNow()
  },
  (t) => [index('accounts_user_idx').on(t.userId)]
);

export const categories = sqliteTable(
  'categories',
  {
    id: cuid().primaryKey(),
    userId: userIdFk(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['income', 'expense'] }).notNull(),
    color: text('color'),
    icon: text('icon'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: epochMsNow(),
    updatedAt: epochMsNow()
  },
  (t) => [index('categories_user_idx').on(t.userId)]
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: cuid().primaryKey(),
    userId: userIdFk(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
    kind: text('kind', { enum: ['income', 'expense', 'transfer'] }).notNull(),
    note: text('note'),
    occurredAt: integer('occurred_at', { mode: 'number' }).notNull(),
    createdAt: epochMsNow(),
    updatedAt: epochMsNow()
  },
  (t) => [
    index('tx_user_idx').on(t.userId),
    index('tx_user_occurred_idx').on(t.userId, t.occurredAt),
    index('tx_account_idx').on(t.accountId)
  ]
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: cuid().primaryKey(),
    userId: userIdFk(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    periodMonth: text('period_month').notNull(), // 'YYYY-MM'
    limitCents: integer('limit_cents', { mode: 'number' }).notNull(),
    createdAt: epochMsNow(),
    updatedAt: epochMsNow()
  },
  (t) => [index('budgets_user_period_idx').on(t.userId, t.periodMonth)]
);

export const userPreferences = sqliteTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull().default('IDR'),
  locale: text('locale').notNull().default('id-ID'),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  theme: text('theme', { enum: ['light', 'dark', 'system'] }).notNull().default('system'),
  weekStartsOn: integer('week_starts_on', { mode: 'number' }).notNull().default(1),
  createdAt: epochMsNow(),
  updatedAt: epochMsNow()
});

export * from './auth.schema';
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: PASS.

- [ ] **Step 5: Type-check**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check
```

Expected: 0 errors. (`auth.schema.ts` may still be the placeholder until T6 — it's a `*` re-export that will resolve once populated. If `users` import fails because placeholder doesn't export it, that's expected — T6 fixes.)

If T5 placement breaks check, swap order: do T6 (`npm run auth:schema`) first to populate `auth.schema.ts`, then this. Update plan order.

- [ ] **Step 6: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/server/db/schema.ts src/lib/server/db/schema.test.ts
git commit -m "feat(db): replace demo task table with mavlo app schema"
```

---

## Task 5: Configure Better Auth (verification, password reset, callbacks)

**Files:**
- Modify: `<NEW_REPO>/src/lib/server/auth.ts`
- Create: `<NEW_REPO>/src/lib/server/email/resend.ts`
- Create: `<NEW_REPO>/src/lib/server/email/templates.ts`
- Test: `<NEW_REPO>/src/lib/server/email/resend.test.ts`

Adds: `requireEmailVerification`, `sendVerificationEmail`, `sendResetPassword` callbacks. Resend client wrapper reads `RESEND_API_KEY` from `getRequestEvent().platform.env`. Plain-string email templates (no React/MJML — keeps Workers bundle small).

- [ ] **Step 1: Write failing test for Resend wrapper**

Create `<NEW_REPO>/src/lib/server/email/resend.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from './resend';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('sendEmail', () => {
  it('POSTs to Resend with bearer auth and payload', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 })
    );

    await sendEmail({
      apiKey: 'test_key',
      from: 'Mavlo <noreply@mavlo.app>',
      to: 'user@example.com',
      subject: 'Hi',
      text: 'Body'
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test_key');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      from: 'Mavlo <noreply@mavlo.app>',
      to: 'user@example.com',
      subject: 'Hi',
      text: 'Body'
    });
  });

  it('throws on non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    await expect(
      sendEmail({
        apiKey: 'k',
        from: 'a',
        to: 'b',
        subject: 's',
        text: 't'
      })
    ).rejects.toThrow(/resend.*429/i);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL — file missing)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: FAIL — `Cannot find module './resend'`.

- [ ] **Step 3: Create `src/lib/server/email/resend.ts`**

```typescript
export interface SendEmailArgs {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const { apiKey, from, to, subject, text, html } = args;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}
```

- [ ] **Step 4: Create `src/lib/server/email/templates.ts`**

```typescript
export const verifyEmailTemplate = (url: string, name?: string) => ({
  subject: 'Verify your Mavlo email',
  text: `Hi${name ? ` ${name}` : ''},

Confirm your Mavlo email by visiting:
${url}

If you didn't create a Mavlo account, ignore this message.`
});

export const resetPasswordTemplate = (url: string, name?: string) => ({
  subject: 'Reset your Mavlo password',
  text: `Hi${name ? ` ${name}` : ''},

We received a request to reset your Mavlo password. Click below within the next hour:
${url}

If you didn't request a reset, ignore this message — your password is unchanged.`
});
```

- [ ] **Step 5: Run test (expect PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: PASS (both `sendEmail` cases).

- [ ] **Step 6: Update `src/lib/server/auth.ts`**

```typescript
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';
import { sendEmail } from '$lib/server/email/resend';
import { verifyEmailTemplate, resetPasswordTemplate } from '$lib/server/email/templates';

const sendFromRequest = async (
  to: string,
  subject: string,
  text: string
) => {
  const event = getRequestEvent();
  const platformEnv = event.platform?.env;
  if (!platformEnv) throw new Error('platform.env unavailable in auth email callback');
  await sendEmail({
    apiKey: platformEnv.RESEND_API_KEY,
    from: platformEnv.RESEND_FROM,
    to,
    subject,
    text
  });
};

const authConfig = {
  baseURL: env.ORIGIN,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const tpl = resetPasswordTemplate(url, user.name);
      await sendFromRequest(user.email, tpl.subject, tpl.text);
    }
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const tpl = verifyEmailTemplate(url, user.name);
      await sendFromRequest(user.email, tpl.subject, tpl.text);
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true
  },
  plugins: [sveltekitCookies(getRequestEvent)] // last
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>;

export const createAuth = (d1: D1Database) =>
  betterAuth({
    ...authConfig,
    database: drizzleAdapter(getDb(d1), { provider: 'sqlite' })
  });

/**
 * DO NOT USE!
 *
 * This instance is used by the `better-auth` CLI for schema generation ONLY.
 * To access `auth` at runtime, use `event.locals.auth`.
 */
export const auth = createAuth(null!);
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check
```

Expected: 0 errors. (`platformEnv.RESEND_API_KEY` etc. typed via `worker-configuration.d.ts` from T3.)

- [ ] **Step 8: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/server/auth.ts src/lib/server/email/
git commit -m "feat(auth): require email verification, wire Resend for verify+reset"
```

---

## Task 6: Generate Better Auth Schema + Push to D1

**Files:**
- Modify (regenerated): `<NEW_REPO>/src/lib/server/db/auth.schema.ts`

Runs `npm run auth:schema` to populate the auth tables (`users`, `sessions`, `accounts` ← will rename to `auth_accounts` in adapter to avoid clash with our app `accounts`, `verifications`).

**Important name clash:** Better Auth default table name `accounts` collides with our app `accounts`. Need to override via Better Auth schema config OR rename our app table. Per spec: rename auth's `accounts` table to `auth_accounts`.

- [ ] **Step 1: Add table-name override to `src/lib/server/auth.ts`**

Insert into `authConfig` (before `plugins`):

```typescript
  user: { modelName: 'users' },
  session: { modelName: 'sessions' },
  account: { modelName: 'auth_accounts' },
  verification: { modelName: 'verifications' },
```

- [ ] **Step 2: Run schema generator**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run auth:schema
```

Expected: rewrites `src/lib/server/db/auth.schema.ts` with `users`, `sessions`, `auth_accounts`, `verifications` table definitions. Confirm `users` is exported (referenced by app schema).

- [ ] **Step 3: Type-check**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check
```

Expected: 0 errors. App schema references to `users.id` resolve.

- [ ] **Step 4: Push schema to D1** (development push, no migrations file needed yet)

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run db:push
```

Expected: drizzle-kit prompts to confirm CREATE TABLEs against D1 over HTTP. Confirm. All tables created.

- [ ] **Step 5: Verify D1 table list**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler d1 execute mavlo --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected output includes: `accounts`, `auth_accounts`, `budgets`, `categories`, `sessions`, `transactions`, `user_preferences`, `users`, `verifications`.

- [ ] **Step 6: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/server/auth.ts src/lib/server/db/auth.schema.ts
git commit -m "feat(auth): generate auth schema with namespaced auth_accounts table"
```

---

## Task 7: Validation Schemas + Auth Form Helpers

**Files:**
- Create: `<NEW_REPO>/src/lib/validation/auth.ts`
- Test: `<NEW_REPO>/src/lib/validation/auth.test.ts`

Zod schemas for sign-up, sign-in, forgot-password, reset-password forms. Reused by Superforms in T8–T11.

- [ ] **Step 1: Write failing test**

Create `<NEW_REPO>/src/lib/validation/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { signInSchema, signUpSchema, forgotPasswordSchema, resetPasswordSchema } from './auth';

describe('auth validation', () => {
  it('signUp requires name + email + password >= 8', () => {
    expect(signUpSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'short' }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: 'Ada', email: 'a@b.co', password: 'longenough1' }).success).toBe(true);
  });

  it('signIn requires email + non-empty password', () => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('forgotPassword requires email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'invalid' }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
  });

  it('resetPassword requires token + password >= 8', () => {
    expect(resetPasswordSchema.safeParse({ token: 't', password: 'short' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 't', password: 'longenough1' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: FAIL — `Cannot find module ./auth`.

- [ ] **Step 3: Create `src/lib/validation/auth.ts`**

```typescript
import { z } from 'zod';

export const emailField = z.string().trim().toLowerCase().email('Invalid email');
export const passwordField = z.string().min(8, 'Password must be at least 8 characters');

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name required').max(100),
  email: emailField,
  password: passwordField
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password required')
});

export const forgotPasswordSchema = z.object({
  email: emailField
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token required'),
  password: passwordField
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/validation/
git commit -m "feat(validation): zod schemas for auth forms"
```

---

## Task 8: Sign-Up Page (server-action form)

**Files:**
- Create: `<NEW_REPO>/src/routes/(auth)/+layout.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/sign-up/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/sign-up/+page.server.ts`

Centered auth layout (no app shell). Form action calls `auth.api.signUpEmail`. On success: redirect to `/auth/verify-sent`. Pattern modeled on scaffold's demo route (`/demo/better-auth/login/+page.server.ts`).

- [ ] **Step 1: Create `src/routes/(auth)/+layout.svelte`**

```svelte
<script lang="ts">
  let { children } = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
  <div class="w-full max-w-md rounded-lg border bg-white dark:bg-zinc-900 p-8 shadow-sm">
    {@render children()}
  </div>
</div>
```

- [ ] **Step 2: Create `src/routes/(auth)/sign-up/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { signUpSchema } from '$lib/validation/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
  if (event.locals.user) throw redirect(302, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const parsed = signUpSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password')
    });

    if (!parsed.success) {
      return fail(400, {
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
        email: formData.get('email')?.toString() ?? '',
        name: formData.get('name')?.toString() ?? ''
      });
    }

    try {
      await event.locals.auth.api.signUpEmail({ body: parsed.data });
    } catch (err) {
      if (err instanceof APIError) {
        return fail(400, {
          message: err.message || 'Sign-up failed',
          email: parsed.data.email,
          name: parsed.data.name
        });
      }
      return fail(500, {
        message: 'Unexpected error',
        email: parsed.data.email,
        name: parsed.data.name
      });
    }

    throw redirect(302, '/auth/verify-sent');
  }
};
```

- [ ] **Step 3: Create `src/routes/(auth)/sign-up/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<svelte:head><title>Sign up — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-6">Create your Mavlo account</h1>

<form method="POST" use:enhance class="space-y-4">
  <label class="block">
    <span class="text-sm font-medium">Name</span>
    <input
      name="name"
      type="text"
      required
      maxlength="100"
      autocomplete="name"
      value={form?.name ?? ''}
      class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
    />
  </label>
  <label class="block">
    <span class="text-sm font-medium">Email</span>
    <input
      name="email"
      type="email"
      required
      autocomplete="email"
      value={form?.email ?? ''}
      class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
    />
  </label>
  <label class="block">
    <span class="text-sm font-medium">Password</span>
    <input
      name="password"
      type="password"
      required
      minlength="8"
      autocomplete="new-password"
      class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
    />
    <span class="text-xs text-zinc-500">Minimum 8 characters.</span>
  </label>

  {#if form?.message}
    <p class="text-sm text-red-600">{form.message}</p>
  {/if}

  <button
    type="submit"
    class="w-full rounded bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-2 font-medium hover:opacity-90"
  >
    Sign up
  </button>
</form>

<p class="mt-6 text-sm text-center text-zinc-600 dark:text-zinc-400">
  Already have an account? <a href="/sign-in" class="underline">Sign in</a>
</p>
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(auth)/"
git commit -m "feat(auth): sign-up page with form action"
```

---

## Task 9: Sign-In Page

**Files:**
- Create: `<NEW_REPO>/src/routes/(auth)/sign-in/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/sign-in/+page.server.ts`

Server action calls `auth.api.signInEmail`. Redirects to `/dashboard` on success.

- [ ] **Step 1: Create `src/routes/(auth)/sign-in/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { signInSchema } from '$lib/validation/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
  if (event.locals.user) throw redirect(302, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const parsed = signInSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password')
    });

    if (!parsed.success) {
      return fail(400, {
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
        email: formData.get('email')?.toString() ?? ''
      });
    }

    try {
      await event.locals.auth.api.signInEmail({ body: parsed.data });
    } catch (err) {
      if (err instanceof APIError) {
        return fail(400, {
          message: err.message || 'Invalid email or password',
          email: parsed.data.email
        });
      }
      return fail(500, { message: 'Unexpected error', email: parsed.data.email });
    }

    throw redirect(302, '/dashboard');
  }
};
```

- [ ] **Step 2: Create `src/routes/(auth)/sign-in/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<svelte:head><title>Sign in — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-6">Sign in to Mavlo</h1>

<form method="POST" use:enhance class="space-y-4">
  <label class="block">
    <span class="text-sm font-medium">Email</span>
    <input
      name="email"
      type="email"
      required
      autocomplete="email"
      value={form?.email ?? ''}
      class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
    />
  </label>
  <label class="block">
    <span class="text-sm font-medium">Password</span>
    <input
      name="password"
      type="password"
      required
      autocomplete="current-password"
      class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
    />
  </label>

  {#if form?.message}
    <p class="text-sm text-red-600">{form.message}</p>
  {/if}

  <button
    type="submit"
    class="w-full rounded bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-2 font-medium hover:opacity-90"
  >
    Sign in
  </button>
</form>

<div class="mt-6 flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
  <a href="/sign-up" class="underline">Create account</a>
  <a href="/forgot-password" class="underline">Forgot password?</a>
</div>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(auth)/sign-in/"
git commit -m "feat(auth): sign-in page with form action"
```

---

## Task 10: Forgot Password + Reset Password Pages

**Files:**
- Create: `<NEW_REPO>/src/routes/(auth)/forgot-password/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/forgot-password/+page.server.ts`
- Create: `<NEW_REPO>/src/routes/(auth)/reset-password/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/reset-password/+page.server.ts`

Forgot: calls `auth.api.forgetPassword` (email enumeration safe — always shows success). Reset: reads `token` from `?token=...`, calls `auth.api.resetPassword`.

- [ ] **Step 1: Create `src/routes/(auth)/forgot-password/+page.server.ts`**

```typescript
import { fail } from '@sveltejs/kit';
import { forgotPasswordSchema } from '$lib/validation/auth';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });

    if (!parsed.success) {
      return fail(400, {
        message: parsed.error.issues[0]?.message ?? 'Invalid email',
        email: formData.get('email')?.toString() ?? ''
      });
    }

    // Better Auth handles enumeration safety; we always claim success regardless.
    try {
      await event.locals.auth.api.forgetPassword({
        body: {
          email: parsed.data.email,
          redirectTo: '/reset-password'
        }
      });
    } catch {
      // swallow — never reveal whether email exists
    }

    return { sent: true };
  }
};
```

- [ ] **Step 2: Create `src/routes/(auth)/forgot-password/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<svelte:head><title>Forgot password — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-6">Reset your password</h1>

{#if form?.sent}
  <p class="text-sm">If an account exists for that email, we've sent a reset link. Check your inbox.</p>
  <p class="mt-4 text-sm"><a href="/sign-in" class="underline">Back to sign in</a></p>
{:else}
  <form method="POST" use:enhance class="space-y-4">
    <label class="block">
      <span class="text-sm font-medium">Email</span>
      <input
        name="email"
        type="email"
        required
        autocomplete="email"
        value={form?.email ?? ''}
        class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
      />
    </label>

    {#if form?.message}
      <p class="text-sm text-red-600">{form.message}</p>
    {/if}

    <button
      type="submit"
      class="w-full rounded bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-2 font-medium hover:opacity-90"
    >
      Send reset link
    </button>
  </form>
{/if}
```

- [ ] **Step 3: Create `src/routes/(auth)/reset-password/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { resetPasswordSchema } from '$lib/validation/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
  const token = event.url.searchParams.get('token') ?? '';
  return { token };
};

export const actions: Actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const parsed = resetPasswordSchema.safeParse({
      token: formData.get('token'),
      password: formData.get('password')
    });

    if (!parsed.success) {
      return fail(400, {
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
        token: formData.get('token')?.toString() ?? ''
      });
    }

    try {
      await event.locals.auth.api.resetPassword({
        body: { newPassword: parsed.data.password, token: parsed.data.token }
      });
    } catch (err) {
      if (err instanceof APIError) {
        return fail(400, {
          message: err.message || 'Reset failed — request a new link',
          token: parsed.data.token
        });
      }
      return fail(500, { message: 'Unexpected error', token: parsed.data.token });
    }

    throw redirect(302, '/sign-in?reset=ok');
  }
};
```

- [ ] **Step 4: Create `src/routes/(auth)/reset-password/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();
</script>

<svelte:head><title>Reset password — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-6">Choose a new password</h1>

{#if !data.token}
  <p class="text-sm text-red-600">Reset token missing. <a href="/forgot-password" class="underline">Request a new link.</a></p>
{:else}
  <form method="POST" use:enhance class="space-y-4">
    <input type="hidden" name="token" value={form?.token ?? data.token} />
    <label class="block">
      <span class="text-sm font-medium">New password</span>
      <input
        name="password"
        type="password"
        required
        minlength="8"
        autocomplete="new-password"
        class="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
      />
    </label>

    {#if form?.message}
      <p class="text-sm text-red-600">{form.message}</p>
    {/if}

    <button
      type="submit"
      class="w-full rounded bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-2 font-medium hover:opacity-90"
    >
      Set new password
    </button>
  </form>
{/if}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(auth)/forgot-password/" "src/routes/(auth)/reset-password/"
git commit -m "feat(auth): forgot-password + reset-password flows"
```

---

## Task 11: Verify-Sent + Verify-Success Pages

**Files:**
- Create: `<NEW_REPO>/src/routes/(auth)/verify-sent/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/verify-success/+page.svelte`

Static informational pages. The `verify-sent` page is shown after sign-up. The `verify-success` page is the `callbackURL` Better Auth uses after the user clicks the verify link.

- [ ] **Step 1: Create `src/routes/(auth)/verify-sent/+page.svelte`**

```svelte
<svelte:head><title>Check your email — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-4">Verify your email</h1>
<p class="text-sm text-zinc-600 dark:text-zinc-400">
  We sent you a link. Click it to finish signing up. The link expires in 24 hours.
</p>
<p class="mt-6 text-sm"><a href="/sign-in" class="underline">Back to sign in</a></p>
```

- [ ] **Step 2: Create `src/routes/(auth)/verify-success/+page.svelte`**

```svelte
<script lang="ts">
  // After Better Auth verifies, autoSignInAfterVerification=true means session cookie is set.
</script>

<svelte:head><title>Email verified — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold mb-4">You're in</h1>
<p class="text-sm text-zinc-600 dark:text-zinc-400">
  Email verified. <a href="/dashboard" class="underline">Go to dashboard</a>
</p>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(auth)/verify-sent/" "src/routes/(auth)/verify-success/"
git commit -m "feat(auth): verify-sent + verify-success pages"
```

---

## Task 12: Auth Route Guards Helper

**Files:**
- Create: `<NEW_REPO>/src/lib/server/auth/guards.ts`
- Test: `<NEW_REPO>/src/lib/server/auth/guards.test.ts`

`requireUser(event)` returns the user or throws redirect to `/sign-in?next=<path>`.

- [ ] **Step 1: Write failing test**

Create `<NEW_REPO>/src/lib/server/auth/guards.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { requireUser } from './guards';

const makeEvent = (user: any, pathname = '/dashboard') => ({
  locals: { user },
  url: new URL(`http://localhost${pathname}`)
}) as any;

describe('requireUser', () => {
  it('returns the user when present', () => {
    const u = { id: 'u1', email: 'a@b.co' };
    expect(requireUser(makeEvent(u))).toBe(u);
  });

  it('throws a redirect when no user', () => {
    let caught: any;
    try {
      requireUser(makeEvent(undefined, '/dashboard'));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.status).toBe(302);
    expect(caught.location).toBe('/sign-in?next=%2Fdashboard');
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/server/auth/guards.ts`**

```typescript
import { redirect, type RequestEvent } from '@sveltejs/kit';
import type { User } from 'better-auth/minimal';

export function requireUser(event: RequestEvent): User {
  if (!event.locals.user) {
    const next = encodeURIComponent(event.url.pathname + event.url.search);
    throw redirect(302, `/sign-in?next=${next}`);
  }
  return event.locals.user;
}
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/server/auth/
git commit -m "feat(auth): requireUser guard helper"
```

---

## Task 13: App Shell Layout (`(app)` group)

**Files:**
- Create: `<NEW_REPO>/src/routes/(app)/+layout.server.ts`
- Create: `<NEW_REPO>/src/routes/(app)/+layout.svelte`

Server load gates with `requireUser`, fetches `userPreferences` (creates default row on first load). Layout renders sidebar + main, sign-out button.

- [ ] **Step 1: Create `src/routes/(app)/+layout.server.ts`**

```typescript
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { userPreferences } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const user = requireUser(event);
  const db = getDb(event.platform!.env.DB);

  let [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.id))
    .limit(1);

  if (!prefs) {
    [prefs] = await db
      .insert(userPreferences)
      .values({ userId: user.id })
      .returning();
  }

  return {
    user: { id: user.id, name: user.name, email: user.email },
    preferences: prefs
  };
};
```

- [ ] **Step 2: Create `src/routes/(app)/+layout.svelte`**

```svelte
<script lang="ts">
  let { children, data } = $props();
</script>

<svelte:head><title>Mavlo</title></svelte:head>

<div class="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
  <aside class="w-60 border-r bg-white dark:bg-zinc-900 p-4 hidden md:block">
    <div class="font-semibold text-lg mb-6">Mavlo</div>
    <nav class="space-y-1 text-sm">
      <a href="/dashboard" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Dashboard</a>
      <a href="/transactions" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Transactions</a>
      <a href="/accounts" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Accounts</a>
      <a href="/categories" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Categories</a>
      <a href="/budgets" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Budgets</a>
      <a href="/settings" class="block px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">Settings</a>
    </nav>
  </aside>

  <main class="flex-1 flex flex-col">
    <header class="border-b bg-white dark:bg-zinc-900 px-6 py-3 flex items-center justify-between">
      <span class="text-sm text-zinc-600 dark:text-zinc-400">Hi, {data.user.name}</span>
      <form method="POST" action="/sign-out">
        <button type="submit" class="text-sm underline text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
          Sign out
        </button>
      </form>
    </header>
    <div class="p-6 flex-1">
      {@render children()}
    </div>
  </main>
</div>
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(app)/"
git commit -m "feat(app): app-shell layout with sidebar + preferences upsert"
```

---

## Task 14: Sign-Out Action

**Files:**
- Create: `<NEW_REPO>/src/routes/sign-out/+page.server.ts`

Standalone POST endpoint. Calls `auth.api.signOut`, redirects to `/sign-in`.

- [ ] **Step 1: Create `src/routes/sign-out/+page.server.ts`**

```typescript
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  throw redirect(302, '/sign-in');
};

export const actions: Actions = {
  default: async (event) => {
    await event.locals.auth.api.signOut({ headers: event.request.headers });
    throw redirect(302, '/sign-in');
  }
};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/routes/sign-out/
git commit -m "feat(auth): sign-out form action"
```

---

## Task 15: Dashboard Placeholder

**Files:**
- Create: `<NEW_REPO>/src/routes/(app)/dashboard/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(app)/dashboard/+page.server.ts`

Reads parent `data.user/preferences`, shows hello + "Phase 2 coming soon" stubs.

- [ ] **Step 1: Create `src/routes/(app)/dashboard/+page.server.ts`**

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {};
};
```

- [ ] **Step 2: Create `src/routes/(app)/dashboard/+page.svelte`**

```svelte
<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>Dashboard — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold">Dashboard</h1>
<p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
  Welcome, {data.user.name}. Currency: {data.preferences.currency} · Locale: {data.preferences.locale}
</p>

<div class="mt-8 grid gap-4 md:grid-cols-3">
  <div class="rounded-lg border bg-white dark:bg-zinc-900 p-6">
    <h2 class="text-sm font-medium text-zinc-500">Net worth</h2>
    <p class="mt-2 text-2xl">—</p>
    <p class="text-xs text-zinc-400 mt-1">Coming in Phase 2</p>
  </div>
  <div class="rounded-lg border bg-white dark:bg-zinc-900 p-6">
    <h2 class="text-sm font-medium text-zinc-500">This month</h2>
    <p class="mt-2 text-2xl">—</p>
    <p class="text-xs text-zinc-400 mt-1">Coming in Phase 2</p>
  </div>
  <div class="rounded-lg border bg-white dark:bg-zinc-900 p-6">
    <h2 class="text-sm font-medium text-zinc-500">Recent activity</h2>
    <p class="mt-2 text-2xl">—</p>
    <p class="text-xs text-zinc-400 mt-1">Coming in Phase 2</p>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(app)/dashboard/"
git commit -m "feat(dashboard): placeholder welcome page"
```

---

## Task 16: Root Redirect

**Files:**
- Modify: `<NEW_REPO>/src/routes/+page.svelte` → delete
- Create: `<NEW_REPO>/src/routes/+page.server.ts`

Replace SvelteKit welcome page with server-side redirect: signed in → `/dashboard`, else → `/sign-in`.

- [ ] **Step 1: Delete current welcome page**

```bash
cd /Users/candratama/Project/WebDev/mavlo
rm src/routes/+page.svelte
```

- [ ] **Step 2: Create `src/routes/+page.server.ts`**

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
  throw redirect(302, event.locals.user ? '/dashboard' : '/sign-in');
};
```

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add -A src/routes/+page.svelte src/routes/+page.server.ts
git commit -m "feat(routing): root redirects based on session"
```

---

## Task 17: Remove Demo Better-Auth Routes

**Files:**
- Delete: `<NEW_REPO>/src/routes/demo/`

Scaffold's `/demo/better-auth*` routes are no longer needed.

- [ ] **Step 1: Remove**

```bash
cd /Users/candratama/Project/WebDev/mavlo
rm -rf src/routes/demo
```

- [ ] **Step 2: Verify nothing references it**

```bash
cd /Users/candratama/Project/WebDev/mavlo
grep -r "demo/better-auth" src 2>/dev/null
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add -A src/routes/demo
git commit -m "chore: remove sv create demo better-auth routes"
```

---

## Task 18: Health Endpoint

**Files:**
- Create: `<NEW_REPO>/src/routes/api/health/+server.ts`

Lightweight readiness check. Returns 200 with `{ ok: true, db: 'up' | 'down' }` after a `SELECT 1`. Used by uptime monitors and deployment smoke tests.

- [ ] **Step 1: Create `src/routes/api/health/+server.ts`**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  let dbStatus: 'up' | 'down' = 'down';
  try {
    await event.platform!.env.DB.prepare('SELECT 1').first();
    dbStatus = 'up';
  } catch {
    dbStatus = 'down';
  }

  return json({ ok: dbStatus === 'up', db: dbStatus, ts: Date.now() });
};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/routes/api/
git commit -m "feat(api): health endpoint with D1 ping"
```

---

## Task 19: Local Dev Smoke Test

**Files:** none (manual verification)

Subagent runs `npm run dev`, hits a page via curl/fetch to confirm the SvelteKit dev server starts and the D1 binding works through the Vite plugin's Miniflare integration.

**Note:** SvelteKit's adapter-cloudflare provides D1 binding access during `vite dev` via Miniflare in newer versions. If `event.platform` is undefined in dev, fall back to `npm run preview` (which uses `wrangler dev` directly) for end-to-end verification.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run dev &
DEV_PID=$!
sleep 5
```

- [ ] **Step 2: Health check**

```bash
curl -s http://localhost:5173/api/health
```

Expected: `{"ok":true,"db":"up","ts":...}`. If `db: "down"` because D1 binding not exposed in `vite dev`, that's a known limitation — Step 4 covers it via `npm run preview`.

- [ ] **Step 3: Root redirect**

```bash
curl -sI http://localhost:5173/ | head -5
```

Expected: `HTTP/1.1 302` with `location: /sign-in`.

- [ ] **Step 4: Stop dev, build, run preview**

```bash
kill $DEV_PID 2>/dev/null
cd /Users/candratama/Project/WebDev/mavlo
npm run build
npm run preview &
PREVIEW_PID=$!
sleep 5
curl -s http://localhost:4173/api/health
kill $PREVIEW_PID 2>/dev/null
```

Expected: build succeeds, `/api/health` returns `{"ok":true,"db":"up"...}` from local Wrangler with D1 binding.

- [ ] **Step 5: No commit** (verification only)

---

## Task 20 (User-Run): Push Production Secrets

**Files:** none (Cloudflare-side)

User pushes secrets to the Workers env. `vars` are already in `wrangler.jsonc` (committed). Secrets stay out of source control.

- [ ] **Step 1: Push secrets**

```bash
cd /Users/candratama/Project/WebDev/mavlo
echo "<BETTER_AUTH_SECRET>" | npx wrangler secret put BETTER_AUTH_SECRET
echo "<RESEND_API_KEY>" | npx wrangler secret put RESEND_API_KEY
```

(Use the same values as in `.dev.vars`.)

Expected: each prompts for confirmation; success messages.

- [ ] **Step 2: Verify**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler secret list
```

Expected: `BETTER_AUTH_SECRET`, `RESEND_API_KEY` listed.

---

## Task 21 (User-Run): Deploy Preview

**Files:** none

- [ ] **Step 1: Deploy**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run build
npx wrangler deploy
```

Expected: deploys to `https://mavlo.<your-subdomain>.workers.dev`. Wrangler prints URL.

- [ ] **Step 2: Update `wrangler.jsonc` `vars.ORIGIN`**

Now that you have the deployed URL, update `vars.ORIGIN` in `wrangler.jsonc` to that URL. Re-deploy.

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add wrangler.jsonc
git commit -m "chore(infra): set ORIGIN to deployed Workers URL"
npx wrangler deploy
```

- [ ] **Step 3: Smoke test**

```bash
curl -s https://mavlo.<your-subdomain>.workers.dev/api/health
```

Expected: `{"ok":true,"db":"up",...}`.

Visit `/sign-up`, register a real test user, check email, click verify link, sign in, land on `/dashboard`. End-to-end auth flow works.

---

## Task 22: README

**Files:**
- Modify: `<NEW_REPO>/README.md`

Replaces scaffold's stub with project-specific runbook.

- [ ] **Step 1: Overwrite `README.md`**

```markdown
# Mavlo

Personal finance tracker. SvelteKit on Cloudflare Workers + D1 + R2 + Better Auth + Drizzle ORM.

## Stack

- SvelteKit 2 + Svelte 5 (runes) + TypeScript
- Cloudflare Workers via `@sveltejs/adapter-cloudflare`
- D1 (SQLite) via Drizzle ORM (HTTP driver for migrations, native binding at runtime)
- R2 for avatar/upload storage
- Better Auth (`better-auth/minimal`) — email + password with verification
- Resend for transactional email
- Tailwind v4 + shadcn-svelte (incremental)

## Local development

Prerequisites: Node 20+, Cloudflare account, Resend account.

1. Install:
   ```bash
   npm install
   ```

2. Set up secrets:
   - Copy `.env.example` → `.env`, fill `CLOUDFLARE_*`, `BETTER_AUTH_SECRET`, `ORIGIN`.
   - Copy `.dev.vars.example` → `.dev.vars`, fill `BETTER_AUTH_SECRET` (same value), `RESEND_API_KEY`.

3. Push schema:
   ```bash
   npm run auth:schema
   npm run db:push
   ```

4. Run dev server (Vite + Miniflare via SvelteKit):
   ```bash
   npm run dev
   ```

5. Run preview (Wrangler local with full D1 binding):
   ```bash
   npm run build
   npm run preview
   ```

## Deploy

```bash
# One-time: push secrets
echo "$BETTER_AUTH_SECRET" | npx wrangler secret put BETTER_AUTH_SECRET
echo "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY

npm run build
npx wrangler deploy
```

## Schema changes

Edit `src/lib/server/db/schema.ts`. For Better Auth tables, edit `src/lib/server/auth.ts` config and re-run:

```bash
npm run auth:schema
npm run db:push   # dev: direct push
# or
npm run db:generate && npm run db:migrate   # prod: tracked migrations
```

## Health check

`GET /api/health` → `{ ok, db, ts }`.

## Layout

```
src/
  lib/
    server/
      auth.ts             # Better Auth instance factory
      auth/guards.ts      # requireUser
      db/
        index.ts          # getDb(d1)
        schema.ts         # app tables
        auth.schema.ts    # generated by `auth:schema`
      email/
        resend.ts         # HTTP client wrapper
        templates.ts      # plain-text templates
    validation/
      auth.ts             # zod schemas
  routes/
    (auth)/               # public auth pages, centered layout
      sign-in/
      sign-up/
      forgot-password/
      reset-password/
      verify-sent/
      verify-success/
    (app)/                # authed app shell
      dashboard/
    api/
      health/
    sign-out/
  hooks.server.ts         # session injection
  app.d.ts
```
```

- [ ] **Step 2: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add README.md
git commit -m "docs: project README with runbook"
```

---

## Phase 1 Done When

- [ ] Sign-up at `/sign-up` succeeds, sends verification email via Resend
- [ ] Verify link routes to `/verify-success`, auto-signs-in
- [ ] Sign-in at `/sign-in` works, redirects to `/dashboard`
- [ ] `/dashboard` shows user name + preferences (auto-created on first visit)
- [ ] Forgot/reset password flow works end-to-end
- [ ] Sign-out works
- [ ] `/api/health` returns 200 from deployed Workers URL
- [ ] All Phase 1 tests pass: `npm run test`
- [ ] Type check clean: `npm run check`
- [ ] Lint clean: `npm run lint`

## Out of Scope for Phase 1 (Later Phases)

- Phase 2: Accounts CRUD, Categories CRUD
- Phase 3: Transactions list + form
- Phase 4: Budgets, Settings page
- Phase 5: Charts (layerchart), PWA wiring (`@vite-pwa/sveltekit`), R2 avatar upload
