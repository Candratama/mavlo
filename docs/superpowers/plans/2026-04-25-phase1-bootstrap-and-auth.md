# Phase 1: Bootstrap & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a fresh SvelteKit + Cloudflare Workers + D1 + R2 + Better Auth + Drizzle codebase that supports sign-up, email verification, sign-in, password reset, and a guarded `(app)` shell with the user's preferences loaded — deployed to a Cloudflare preview environment.

**Architecture:** New greenfield repo (separate from the legacy `maflo` Next.js project). Single Worker built by `@sveltejs/adapter-cloudflare` serves SSR, assets, and form actions. Better Auth manages credential auth with the Drizzle D1 adapter; sessions live in D1. Email is sent through the Resend HTTP API.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Vite, Tailwind v4, shadcn-svelte (bits-ui), Superforms, zod, Drizzle ORM, drizzle-kit, Better Auth, Cloudflare Workers / D1 / R2, Wrangler, Resend, Vitest, better-sqlite3 (test only), `@paralleldrive/cuid2`.

**Spec:** `docs/superpowers/specs/2026-04-25-cloudflare-d1-svelte-rewrite-design.md` (in the legacy repo).

**Out of scope for this plan:** any of accounts / categories / transactions / budgets / dashboard / charts / PWA / avatar uploads. Those land in subsequent plans.

---

## Pre-flight (engineer setup)

Run these once before starting Task 1.

- [ ] **Step 0a: Verify tooling**

```bash
node --version    # expect >= 20.11 (v24 works fine)
npm --version     # expect >= 10
git --version
```

- [ ] **Step 0b: Cloudflare login**

Wrangler is installed as a devDependency in Task 3 — no global install needed. Until then, log in once via `npx`:

```bash
npx wrangler@latest login    # opens browser; log into the Cloudflare account that owns the deploy target
```

After this command, all `wrangler` invocations in subsequent tasks should be prefixed with `npx ` (e.g., `npx wrangler d1 create ...`). The plan reflects this convention.

- [ ] **Step 0c: Confirm the new repo path**

The new repo lives at `/Users/candratama/Project/WebDev/mavlo` — outside the legacy `maflo` directory. The directory already exists and was `git init`-ed (branch `main`) during planning. Throughout this plan, `<NEW_REPO>` refers to that path.

```bash
cd /Users/candratama/Project/WebDev/mavlo
git status    # expect: On branch main, no commits yet
```

The plan document itself stays in the legacy repo (`/Users/candratama/Project/WebDev/maflo/docs/superpowers/plans/...`). Every implementation command in this plan runs inside `<NEW_REPO>` unless stated otherwise.

---

### Task 1: Scaffold the SvelteKit project

**Files:**

- Create: `<NEW_REPO>/` (whole project tree from `sv create`)
- Modify: `<NEW_REPO>/package.json`
- Create: `<NEW_REPO>/.gitignore` (extended)
- Create: `<NEW_REPO>/.editorconfig`
- Create: `<NEW_REPO>/.nvmrc`

- [ ] **Step 1.1: Run the SvelteKit scaffolder**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx sv@latest create .   # scaffold into the current directory (already created + git-initialized)
```

When prompted, choose:

- Template: **SvelteKit minimal**
- Type checking: **Yes, using TypeScript syntax**
- Add to project: **prettier, eslint, vitest, tailwindcss**
- Tailwind plugins: none (Tailwind v4 needs none)
- Package manager: **npm**

```bash

```

Note: the `mavlo/` directory + `git init` already exist (created during planning). `sv create .` scaffolds in-place without re-initializing git. If `sv` refuses because the directory is non-empty, pass `--force`.

- [ ] **Step 1.2: Pin Node version**

Create `<NEW_REPO>/.nvmrc`:

```
20
```

Add an `engines` block to `<NEW_REPO>/package.json` (merge into the existing object):

```json
{
	"engines": {
		"node": ">=20.11.0",
		"npm": ">=10.0.0"
	}
}
```

- [ ] **Step 1.3: Add editor config**

Create `<NEW_REPO>/.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 1.4: Extend gitignore**

Append to `<NEW_REPO>/.gitignore`:

```
.dev.vars
.wrangler
.mf
.svelte-kit
.DS_Store
*.log
node_modules/
build/
dist/
coverage/
.vscode/
.idea/
```

- [ ] **Step 1.5: Smoke-test the scaffold**

```bash
npm install
npm run dev -- --open
```

Expected: dev server starts on `http://localhost:5173`, default SvelteKit demo page loads, no console errors. Stop the server with `Ctrl+C`.

- [ ] **Step 1.6: Stage and create the first commit**

Git is already initialized (Pre-flight 0c). No `git init` needed.

```bash
git add -A
git commit -m "chore: scaffold SvelteKit project"
```

---

### Task 2: Tailwind v4 + base styles

**Files:**

- Modify: `<NEW_REPO>/src/app.css`
- Modify: `<NEW_REPO>/src/routes/+layout.svelte`
- Verify: `<NEW_REPO>/vite.config.ts`

The `sv create` flow already installs `@tailwindcss/vite` and creates `src/app.css`. This task tightens defaults.

- [ ] **Step 2.1: Replace `src/app.css` content**

```css
@import 'tailwindcss';

@layer base {
	:root {
		--background: 0 0% 100%;
		--foreground: 222.2 47.4% 11.2%;
		--muted: 210 40% 96.1%;
		--muted-foreground: 215.4 16.3% 46.9%;
		--border: 214.3 31.8% 91.4%;
		--ring: 222.2 84% 4.9%;
		--radius: 0.5rem;
	}

	.dark {
		--background: 222.2 47.4% 11.2%;
		--foreground: 210 40% 98%;
		--muted: 217.2 32.6% 17.5%;
		--muted-foreground: 215 20.2% 65.1%;
		--border: 217.2 32.6% 17.5%;
		--ring: 212.7 26.8% 83.9%;
	}

	html {
		color-scheme: light dark;
	}

	body {
		@apply bg-background text-foreground antialiased;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			sans-serif;
	}
}
```

- [ ] **Step 2.2: Wire `app.css` into the root layout**

Replace `<NEW_REPO>/src/routes/+layout.svelte` with:

```svelte
<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

{@render children?.()}
```

- [ ] **Step 2.3: Verify Tailwind builds**

```bash
npm run dev
```

Visit `http://localhost:5173` — page should render with the base font + neutral background. Stop the server.

- [ ] **Step 2.4: Commit**

```bash
git add -A
git commit -m "feat(styles): wire Tailwind v4 base layer"
```

---

### Task 3: Install runtime dependencies

**Files:**

- Modify: `<NEW_REPO>/package.json`

- [ ] **Step 3.1: Install runtime deps**

```bash
npm install \
  @sveltejs/adapter-cloudflare \
  better-auth \
  drizzle-orm \
  @paralleldrive/cuid2 \
  zod \
  sveltekit-superforms \
  mode-watcher
```

- [ ] **Step 3.2: Install dev deps**

```bash
npm install -D \
  drizzle-kit \
  better-sqlite3 \
  @types/better-sqlite3 \
  wrangler \
  @cloudflare/workers-types \
  @testing-library/svelte \
  @testing-library/jest-dom \
  jsdom
```

- [ ] **Step 3.3: Verify install + commit**

```bash
npm ls @sveltejs/adapter-cloudflare better-auth drizzle-orm
git add package.json package-lock.json
git commit -m "chore: install runtime + dev dependencies"
```

---

### Task 4: Switch to `adapter-cloudflare`

**Files:**

- Modify: `<NEW_REPO>/svelte.config.js`
- Create: `<NEW_REPO>/src/app.d.ts` (extend if it already exists)

- [ ] **Step 4.1: Replace `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			},
			platformProxy: {
				configPath: 'wrangler.toml',
				environment: undefined,
				persist: true
			}
		})
	}
};

export default config;
```

- [ ] **Step 4.2: Replace `src/app.d.ts`**

```ts
/// <reference types="@cloudflare/workers-types" />

import type { Session, User } from 'better-auth';
import type { DrizzleD1 } from '$lib/server/db/types';

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			user: User | null;
			session: Session | null;
			db: DrizzleD1;
		}
		interface PageData {
			user: User | null;
		}
		interface Platform {
			env: {
				DB: D1Database;
				BUCKET: R2Bucket;
				SESSION_SECRET: string;
				RESEND_API_KEY: string;
				RESEND_SENDER_EMAIL: string;
				RESEND_SENDER_NAME: string;
				PUBLIC_APP_URL: string;
			};
			cf?: IncomingRequestCfProperties;
			ctx?: ExecutionContext;
		}
	}
}

export {};
```

The `DrizzleD1` type is created in Task 6.

- [ ] **Step 4.3: Build to verify the adapter wires**

```bash
npm run build
```

Expected: build completes; you may see TS errors about `$lib/server/db/types` (not yet created). That is fine for now — the build succeeds without strict type-check (SvelteKit defers full check to `svelte-kit sync`).

If the build fails for a different reason, stop and fix before moving on.

- [ ] **Step 4.4: Commit**

```bash
git add -A
git commit -m "feat: configure adapter-cloudflare and platform types"
```

---

### Task 5: Provision Cloudflare resources

This task creates resources in your Cloudflare account. Capture the IDs each command emits — they go into `wrangler.toml` next.

- [ ] **Step 5.1: Create the preview D1 database**

```bash
npx wrangler d1 create mavlo-preview
```

Expected output includes:

```
[[d1_databases]]
binding = "DB"
database_name = "mavlo-preview"
database_id = "<UUID-PREVIEW>"
```

Record `<UUID-PREVIEW>`.

- [ ] **Step 5.2: Create the production D1 database**

```bash
npx wrangler d1 create mavlo-prod
```

Record `<UUID-PROD>`.

- [ ] **Step 5.3: Create the R2 buckets**

```bash
npx wrangler r2 bucket create mavlo-avatars-preview
npx wrangler r2 bucket create mavlo-avatars-prod
```

Both must succeed. They have no IDs to record.

- [ ] **Step 5.4: Set up secrets (deferred until after `wrangler.toml`)**

Leave secrets unset for now. Task 7 sets them.

---

### Task 6: Wrangler config + Drizzle config

**Files:**

- Create: `<NEW_REPO>/wrangler.toml`
- Create: `<NEW_REPO>/.dev.vars`
- Create: `<NEW_REPO>/drizzle.config.ts`
- Create: `<NEW_REPO>/src/lib/server/db/types.ts`

- [ ] **Step 6.1: Write `wrangler.toml`**

Replace `<UUID-PREVIEW>` and `<UUID-PROD>` with the IDs from Task 5.

```toml
name = "mavlo"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]
account_id = ""    # optional; set if your wrangler login spans multiple accounts

[assets]
directory = ".svelte-kit/cloudflare"
binding = "ASSETS"

[vars]
PUBLIC_APP_URL = "http://localhost:5173"
RESEND_SENDER_EMAIL = "support@kodesafari.tech"
RESEND_SENDER_NAME = "Mavlo"

[[d1_databases]]
binding = "DB"
database_name = "mavlo-preview"
database_id = "<UUID-PREVIEW>"
migrations_dir = "drizzle"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "mavlo-avatars-preview"

[env.production]
name = "mavlo"

[env.production.vars]
PUBLIC_APP_URL = "https://mavlo.app"
RESEND_SENDER_EMAIL = "support@kodesafari.tech"
RESEND_SENDER_NAME = "Mavlo"

[[env.production.d1_databases]]
binding = "DB"
database_name = "mavlo-prod"
database_id = "<UUID-PROD>"
migrations_dir = "drizzle"

[[env.production.r2_buckets]]
binding = "BUCKET"
bucket_name = "mavlo-avatars-prod"
```

- [ ] **Step 6.2: Create `.dev.vars`**

`.dev.vars` is git-ignored and supplies secrets to `wrangler dev` and `vite dev` (via the platform proxy).

```
SESSION_SECRET=dev-only-replace-me-with-32-bytes-base64
RESEND_API_KEY=re_dev_placeholder
```

Generate a real local secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output into `.dev.vars` as `SESSION_SECRET=...`.

For local development, leave `RESEND_API_KEY` as the placeholder until Task 11 — emails will log to the console in dev.

- [ ] **Step 6.3: Write `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
		databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? '',
		token: process.env.CLOUDFLARE_API_TOKEN ?? ''
	},
	verbose: true,
	strict: true
});
```

`drizzle-kit` is used only for `generate` (offline) in this plan; remote `push` is not used. The `dbCredentials` block is required by the type but not exercised until you opt into remote ops.

- [ ] **Step 6.4: Create the Drizzle type alias**

`<NEW_REPO>/src/lib/server/db/types.ts`:

```ts
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './schema';

export type DrizzleD1 = DrizzleD1Database<typeof schema>;
```

- [ ] **Step 6.5: Commit**

```bash
git add -A
git commit -m "feat: add wrangler + drizzle config"
```

---

### Task 7: Set Cloudflare secrets

- [ ] **Step 7.1: Generate a production session secret**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- [ ] **Step 7.2: Set preview secrets**

`wrangler secret put` reads from stdin. Paste the value when prompted.

```bash
npx wrangler secret put SESSION_SECRET            # paste a fresh 32-byte base64
npx wrangler secret put RESEND_API_KEY            # paste the Resend key (rotate from legacy first)
```

- [ ] **Step 7.3: Set production secrets**

```bash
npx wrangler secret put SESSION_SECRET --env production
npx wrangler secret put RESEND_API_KEY --env production
```

Use a **different** `SESSION_SECRET` value for production than for preview.

> **Security note:** the legacy repo (`/Users/candratama/Project/WebDev/maflo/.env.local`) contains live `APPWRITE_API_KEY` and `RESEND_API_KEY`. Rotate the Resend key in the Resend dashboard before pasting it into `wrangler secret put`. Never commit the new key to either repo.

---

### Task 8: Drizzle schema (auth + preferences)

**Files:**

- Create: `<NEW_REPO>/src/lib/server/db/schema.ts`
- Create: `<NEW_REPO>/src/lib/server/db/schema/auth.ts`
- Create: `<NEW_REPO>/src/lib/server/db/schema/preferences.ts`
- Create: `<NEW_REPO>/src/lib/server/db/schema/index.ts`

- [ ] **Step 8.1: Auth tables**

`<NEW_REPO>/src/lib/server/db/schema/auth.ts`:

```ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	name: text('name'),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => ({
		byUser: index('idx_sessions_user').on(t.userId),
		byToken: index('idx_sessions_token').on(t.token)
	})
);

// Renamed from Better Auth's default `accounts` to avoid clash with the
// future financial-accounts table.
export const authAccounts = sqliteTable(
	'auth_accounts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
		scope: text('scope'),
		password: text('password'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => ({
		byUser: index('idx_auth_accounts_user').on(t.userId)
	})
);

export const verifications = sqliteTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});
```

- [ ] **Step 8.2: User preferences**

`<NEW_REPO>/src/lib/server/db/schema/preferences.ts`:

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const userPreferences = sqliteTable('user_preferences', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	locale: text('locale').notNull().default('en'),
	currencyDefault: text('currency_default').notNull().default('USD'),
	theme: text('theme').notNull().default('system'),
	weekStart: integer('week_start').notNull().default(1),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});
```

- [ ] **Step 8.3: Schema index**

`<NEW_REPO>/src/lib/server/db/schema/index.ts`:

```ts
export * from './auth';
export * from './preferences';
```

- [ ] **Step 8.4: Top-level schema barrel**

`<NEW_REPO>/src/lib/server/db/schema.ts`:

```ts
export * from './schema/index';
```

- [ ] **Step 8.5: Generate the initial migration**

```bash
npx drizzle-kit generate --name init
```

Expected: a new SQL file appears in `<NEW_REPO>/drizzle/` (e.g. `0000_init.sql`) plus a `meta/` folder. Inspect the SQL — it should declare the four auth tables and `user_preferences`.

- [ ] **Step 8.6: Apply the migration locally**

```bash
npx wrangler d1 migrations apply DB --local
```

Expected: `Migrations applied!`. The local D1 file lives under `.wrangler/state/v3/d1/`.

- [ ] **Step 8.7: Apply the migration to the preview remote**

```bash
npx wrangler d1 migrations apply DB --remote
```

Expected: same output, against the preview Cloudflare database.

- [ ] **Step 8.8: Commit**

```bash
git add -A
git commit -m "feat(db): add auth + preferences schema and initial migration"
```

---

### Task 9: Drizzle factory + locals injection

**Files:**

- Create: `<NEW_REPO>/src/lib/server/db/index.ts`
- Create: `<NEW_REPO>/src/hooks.server.ts`

- [ ] **Step 9.1: Drizzle factory**

`<NEW_REPO>/src/lib/server/db/index.ts`:

```ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import type { DrizzleD1 } from './types';

export function createDb(d1: D1Database): DrizzleD1 {
	return drizzle(d1, { schema });
}

export { schema };
```

- [ ] **Step 9.2: Hooks scaffold**

`<NEW_REPO>/src/hooks.server.ts`:

```ts
import type { Handle } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	if (!env) {
		throw new Error('Cloudflare platform bindings missing — run via wrangler/vite-platform-proxy');
	}

	event.locals.db = createDb(env.DB);
	// user + session populated in Task 12 (after Better Auth is wired).
	event.locals.user = null;
	event.locals.session = null;

	return resolve(event);
};
```

- [ ] **Step 9.3: Quick sanity check**

```bash
npm run build
```

Expected: build succeeds. Type errors about `Locals.user` / `Locals.session` should be gone.

- [ ] **Step 9.4: Commit**

```bash
git add -A
git commit -m "feat(server): drizzle factory + locals.db injection"
```

---

### Task 10: Better Auth — instance + endpoint mount

**Files:**

- Create: `<NEW_REPO>/src/lib/server/auth.ts`
- Create: `<NEW_REPO>/src/routes/api/auth/[...all]/+server.ts`

- [ ] **Step 10.1: Better Auth instance**

`<NEW_REPO>/src/lib/server/auth.ts`:

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb, schema } from './db';

export interface AuthContext {
	d1: D1Database;
	sessionSecret: string;
	appUrl: string;
}

export function createAuth(ctx: AuthContext) {
	const db = createDb(ctx.d1);
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: {
				user: schema.users,
				session: schema.sessions,
				account: schema.authAccounts,
				verification: schema.verifications
			}
		}),
		secret: ctx.sessionSecret,
		baseURL: ctx.appUrl,
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			autoSignIn: true,
			sendResetPassword: async ({ user, url }) => {
				const { sendPasswordReset } = await import('./email/send');
				await sendPasswordReset({ to: user.email, name: user.name, url });
			}
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				const { sendVerification } = await import('./email/send');
				await sendVerification({ to: user.email, name: user.name, url });
			}
		},
		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24
		},
		advanced: {
			cookiePrefix: 'maflo'
		}
	});
}

export type Auth = ReturnType<typeof createAuth>;
```

The dynamic `import("./email/send")` keeps Task 10 standalone — the email module lands in Task 11.

- [ ] **Step 10.2: Mount the Better Auth endpoint**

`<NEW_REPO>/src/routes/api/auth/[...all]/+server.ts`:

```ts
import type { RequestHandler } from './$types';
import { createAuth } from '$lib/server/auth';

const handler: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env) {
		return new Response('Platform bindings unavailable', { status: 500 });
	}
	const auth = createAuth({
		d1: platform.env.DB,
		sessionSecret: platform.env.SESSION_SECRET,
		appUrl: platform.env.PUBLIC_APP_URL
	});
	return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
```

- [ ] **Step 10.3: Commit**

```bash
git add -A
git commit -m "feat(auth): wire Better Auth handler with Drizzle D1 adapter"
```

---

### Task 11: Resend email wrapper + templates

**Files:**

- Create: `<NEW_REPO>/src/lib/server/email/resend.ts`
- Create: `<NEW_REPO>/src/lib/server/email/send.ts`
- Create: `<NEW_REPO>/src/lib/server/email/templates/verification.ts`
- Create: `<NEW_REPO>/src/lib/server/email/templates/reset-password.ts`
- Create: `<NEW_REPO>/src/lib/server/email/context.ts`

- [ ] **Step 11.1: Email context bridge**

Better Auth's email callbacks (Task 10) don't receive the SvelteKit `event`, so we stash the active platform env on a per-request module-scoped store.

`<NEW_REPO>/src/lib/server/email/context.ts`:

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface EmailContext {
	apiKey: string;
	senderEmail: string;
	senderName: string;
	appUrl: string;
}

const storage = new AsyncLocalStorage<EmailContext>();

export function withEmailContext<T>(ctx: EmailContext, fn: () => Promise<T>): Promise<T> {
	return storage.run(ctx, fn);
}

export function getEmailContext(): EmailContext {
	const ctx = storage.getStore();
	if (!ctx) {
		throw new Error('Email context missing — wrap auth calls in withEmailContext');
	}
	return ctx;
}
```

`AsyncLocalStorage` is supported on Workers when `nodejs_compat` is enabled (it is, in `wrangler.toml`).

- [ ] **Step 11.2: Resend wrapper**

`<NEW_REPO>/src/lib/server/email/resend.ts`:

```ts
import { getEmailContext } from './context';

export interface SendInput {
	to: string;
	subject: string;
	html: string;
	text: string;
}

export async function sendEmail(input: SendInput): Promise<void> {
	const ctx = getEmailContext();

	if (!ctx.apiKey || ctx.apiKey === 're_dev_placeholder') {
		console.info('[email:dev]', { to: input.to, subject: input.subject });
		console.info(input.text);
		return;
	}

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${ctx.apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: `${ctx.senderName} <${ctx.senderEmail}>`,
			to: [input.to],
			subject: input.subject,
			html: input.html,
			text: input.text
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Resend error ${res.status}: ${body}`);
	}
}
```

- [ ] **Step 11.3: Verification template**

`<NEW_REPO>/src/lib/server/email/templates/verification.ts`:

```ts
export interface VerificationTemplateInput {
	name: string | null | undefined;
	url: string;
}

export function verificationTemplate(input: VerificationTemplateInput) {
	const greeting = input.name ? `Hi ${input.name},` : 'Hi,';
	const subject = 'Verify your Mavlo email';
	const text = `${greeting}

Please confirm your email by visiting:
${input.url}

If you didn't sign up for Mavlo, ignore this message.

— Mavlo`;
	const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;">
<p>${greeting}</p>
<p>Please confirm your email by clicking below.</p>
<p><a href="${input.url}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Verify email</a></p>
<p>Or paste this link in your browser:<br><code>${input.url}</code></p>
<p>If you didn't sign up for Mavlo, ignore this message.</p>
<p>— Mavlo</p>
</body></html>`;
	return { subject, html, text };
}
```

- [ ] **Step 11.4: Reset-password template**

`<NEW_REPO>/src/lib/server/email/templates/reset-password.ts`:

```ts
export interface ResetTemplateInput {
	name: string | null | undefined;
	url: string;
}

export function resetPasswordTemplate(input: ResetTemplateInput) {
	const greeting = input.name ? `Hi ${input.name},` : 'Hi,';
	const subject = 'Reset your Mavlo password';
	const text = `${greeting}

Use this link to reset your Mavlo password:
${input.url}

The link expires in 1 hour. If you didn't request this, you can ignore the message.

— Mavlo`;
	const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;">
<p>${greeting}</p>
<p>Use the button below to reset your Mavlo password. The link expires in 1 hour.</p>
<p><a href="${input.url}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Reset password</a></p>
<p>Or paste this link in your browser:<br><code>${input.url}</code></p>
<p>If you didn't request this, ignore the message.</p>
<p>— Mavlo</p>
</body></html>`;
	return { subject, html, text };
}
```

- [ ] **Step 11.5: Send helpers used by Better Auth**

`<NEW_REPO>/src/lib/server/email/send.ts`:

```ts
import { sendEmail } from './resend';
import { verificationTemplate } from './templates/verification';
import { resetPasswordTemplate } from './templates/reset-password';

export async function sendVerification(args: { to: string; name: string | null; url: string }) {
	const tpl = verificationTemplate({ name: args.name, url: args.url });
	await sendEmail({ to: args.to, ...tpl });
}

export async function sendPasswordReset(args: { to: string; name: string | null; url: string }) {
	const tpl = resetPasswordTemplate({ name: args.name, url: args.url });
	await sendEmail({ to: args.to, ...tpl });
}
```

- [ ] **Step 11.6: Wrap auth calls in email context**

Update `<NEW_REPO>/src/routes/api/auth/[...all]/+server.ts`:

```ts
import type { RequestHandler } from './$types';
import { createAuth } from '$lib/server/auth';
import { withEmailContext } from '$lib/server/email/context';

const handler: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env) {
		return new Response('Platform bindings unavailable', { status: 500 });
	}
	const env = platform.env;
	const auth = createAuth({
		d1: env.DB,
		sessionSecret: env.SESSION_SECRET,
		appUrl: env.PUBLIC_APP_URL
	});
	return withEmailContext(
		{
			apiKey: env.RESEND_API_KEY,
			senderEmail: env.RESEND_SENDER_EMAIL,
			senderName: env.RESEND_SENDER_NAME,
			appUrl: env.PUBLIC_APP_URL
		},
		() => auth.handler(request)
	);
};

export const GET = handler;
export const POST = handler;
```

- [ ] **Step 11.7: Commit**

```bash
git add -A
git commit -m "feat(email): resend wrapper + verification/reset templates"
```

---

### Task 12: Hook session injection + auth client

**Files:**

- Modify: `<NEW_REPO>/src/hooks.server.ts`
- Create: `<NEW_REPO>/src/lib/auth-client.ts`

- [ ] **Step 12.1: Replace `src/hooks.server.ts`**

```ts
import type { Handle } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { createAuth } from '$lib/server/auth';
import { withEmailContext } from '$lib/server/email/context';

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	if (!env) {
		throw new Error('Cloudflare platform bindings missing — run via wrangler/vite-platform-proxy');
	}

	event.locals.db = createDb(env.DB);

	const auth = createAuth({
		d1: env.DB,
		sessionSecret: env.SESSION_SECRET,
		appUrl: env.PUBLIC_APP_URL
	});

	const result = await withEmailContext(
		{
			apiKey: env.RESEND_API_KEY,
			senderEmail: env.RESEND_SENDER_EMAIL,
			senderName: env.RESEND_SENDER_NAME,
			appUrl: env.PUBLIC_APP_URL
		},
		() => auth.api.getSession({ headers: event.request.headers })
	);

	event.locals.user = result?.user ?? null;
	event.locals.session = result?.session ?? null;

	return resolve(event);
};
```

- [ ] **Step 12.2: Create the client-side auth helper**

`<NEW_REPO>/src/lib/auth-client.ts`:

```ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
	baseURL: typeof window === 'undefined' ? '' : window.location.origin
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

- [ ] **Step 12.3: Smoke build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 12.4: Commit**

```bash
git add -A
git commit -m "feat(auth): inject locals.user/session via Better Auth"
```

---

### Task 13: Validation schemas + guards

**Files:**

- Create: `<NEW_REPO>/src/lib/validation/auth.ts`
- Create: `<NEW_REPO>/src/lib/server/guards.ts`

- [ ] **Step 13.1: Auth zod schemas**

`<NEW_REPO>/src/lib/validation/auth.ts`:

```ts
import { z } from 'zod';

export const signUpSchema = z.object({
	name: z.string().min(1, 'Name is required').max(120),
	email: z.string().email().max(254),
	password: z.string().min(8, 'Min 8 characters').max(128)
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1)
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotSchema = z.object({
	email: z.string().email()
});
export type ForgotInput = z.infer<typeof forgotSchema>;

export const resetSchema = z
	.object({
		token: z.string().min(1),
		password: z.string().min(8).max(128),
		confirmPassword: z.string().min(8).max(128)
	})
	.refine((d) => d.password === d.confirmPassword, {
		path: ['confirmPassword'],
		message: 'Passwords do not match'
	});
export type ResetInput = z.infer<typeof resetSchema>;
```

- [ ] **Step 13.2: Guards**

`<NEW_REPO>/src/lib/server/guards.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { User } from 'better-auth';

export function requireUser(event: RequestEvent): User {
	if (!event.locals.user) {
		throw redirect(303, `/sign-in?next=${encodeURIComponent(event.url.pathname)}`);
	}
	return event.locals.user;
}
```

- [ ] **Step 13.3: Commit**

```bash
git add -A
git commit -m "feat: validation schemas + requireUser guard"
```

---

### Task 14: Sign-up page + action (TDD)

**Files:**

- Create: `<NEW_REPO>/src/lib/validation/auth.test.ts`
- Create: `<NEW_REPO>/src/routes/(auth)/+layout.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/sign-up/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/sign-up/+page.server.ts`

- [ ] **Step 14.1: Write the failing schema test**

`<NEW_REPO>/src/lib/validation/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signUpSchema, resetSchema } from './auth';

describe('signUpSchema', () => {
	it('accepts valid input', () => {
		const r = signUpSchema.safeParse({
			name: 'Asep',
			email: 'asep@example.com',
			password: 'longenough'
		});
		expect(r.success).toBe(true);
	});

	it('rejects short passwords', () => {
		const r = signUpSchema.safeParse({
			name: 'Asep',
			email: 'asep@example.com',
			password: 'short'
		});
		expect(r.success).toBe(false);
		if (!r.success) {
			expect(r.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
		}
	});

	it('rejects bad email', () => {
		const r = signUpSchema.safeParse({
			name: 'Asep',
			email: 'not-an-email',
			password: 'longenough'
		});
		expect(r.success).toBe(false);
	});
});

describe('resetSchema', () => {
	it('rejects mismatched passwords', () => {
		const r = resetSchema.safeParse({
			token: 'tok',
			password: 'longenough',
			confirmPassword: 'different1'
		});
		expect(r.success).toBe(false);
	});
});
```

- [ ] **Step 14.2: Run the test**

```bash
npm test -- --run src/lib/validation/auth.test.ts
```

Expected: PASS (the schemas were written in Task 13). If they fail, fix the schema before continuing.

- [ ] **Step 14.3: Auth layout shell**

`<NEW_REPO>/src/routes/(auth)/+layout.svelte`:

```svelte
<script lang="ts">
	let { children } = $props();
</script>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
	<h1 class="mb-6 text-2xl font-semibold">Mavlo</h1>
	{@render children?.()}
</main>
```

- [ ] **Step 14.4: Sign-up server action**

`<NEW_REPO>/src/routes/(auth)/sign-up/+page.server.ts`:

```ts
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { signUpSchema } from '$lib/validation/auth';
import { createAuth } from '$lib/server/auth';
import { withEmailContext } from '$lib/server/email/context';
import { userPreferences } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(303, '/dashboard');
	const form = await superValidate(zod(signUpSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request, platform, locals }) => {
		const env = platform!.env;
		const form = await superValidate(request, zod(signUpSchema));
		if (!form.valid) return fail(400, { form });

		const auth = createAuth({
			d1: env.DB,
			sessionSecret: env.SESSION_SECRET,
			appUrl: env.PUBLIC_APP_URL
		});

		let userId: string | null = null;
		try {
			const result = await withEmailContext(
				{
					apiKey: env.RESEND_API_KEY,
					senderEmail: env.RESEND_SENDER_EMAIL,
					senderName: env.RESEND_SENDER_NAME,
					appUrl: env.PUBLIC_APP_URL
				},
				() =>
					auth.api.signUpEmail({
						body: {
							email: form.data.email,
							password: form.data.password,
							name: form.data.name
						}
					})
			);
			userId = result?.user?.id ?? null;
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Sign-up failed';
			return fail(400, { form, message });
		}

		if (userId) {
			await locals.db
				.insert(userPreferences)
				.values({
					userId,
					locale: 'en',
					currencyDefault: 'USD',
					theme: 'system',
					weekStart: 1,
					updatedAt: new Date()
				})
				.onConflictDoNothing();
		}

		throw redirect(303, '/sign-in?registered=1');
	}
};
```

- [ ] **Step 14.5: Sign-up page**

`<NEW_REPO>/src/routes/(auth)/sign-up/+page.svelte`:

```svelte
<script lang="ts">
	import { superForm } from 'sveltekit-superforms';

	let { data } = $props();
	const { form, errors, enhance, message, submitting } = superForm(data.form);
</script>

<h2 class="mb-4 text-lg font-medium">Create account</h2>

{#if $message}
	<p class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{$message}</p>
{/if}

<form method="POST" use:enhance class="space-y-4">
	<label class="block">
		<span class="mb-1 block text-sm">Name</span>
		<input
			class="w-full rounded border px-3 py-2"
			name="name"
			bind:value={$form.name}
			autocomplete="name"
			required
		/>
		{#if $errors.name}<small class="text-red-600">{$errors.name}</small>{/if}
	</label>

	<label class="block">
		<span class="mb-1 block text-sm">Email</span>
		<input
			class="w-full rounded border px-3 py-2"
			name="email"
			type="email"
			bind:value={$form.email}
			autocomplete="email"
			required
		/>
		{#if $errors.email}<small class="text-red-600">{$errors.email}</small>{/if}
	</label>

	<label class="block">
		<span class="mb-1 block text-sm">Password</span>
		<input
			class="w-full rounded border px-3 py-2"
			name="password"
			type="password"
			bind:value={$form.password}
			autocomplete="new-password"
			required
		/>
		{#if $errors.password}<small class="text-red-600">{$errors.password}</small>{/if}
	</label>

	<button
		class="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
		type="submit"
		disabled={$submitting}
	>
		{$submitting ? 'Creating…' : 'Create account'}
	</button>
</form>

<p class="mt-4 text-sm">
	Have an account? <a href="/sign-in" class="underline">Sign in</a>
</p>
```

- [ ] **Step 14.6: Manual smoke test**

```bash
npm run dev
```

Visit `http://localhost:5173/sign-up`, submit the form. Expected:

- Local terminal logs `[email:dev] { to: ..., subject: "Verify your Mavlo email" }` and the verification URL.
- Browser is redirected to `/sign-in?registered=1` (404 until Task 15 is complete).

Stop the server.

- [ ] **Step 14.7: Commit**

```bash
git add -A
git commit -m "feat(auth): sign-up page + server action"
```

---

### Task 15: Sign-in page + action

**Files:**

- Create: `<NEW_REPO>/src/routes/(auth)/sign-in/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/sign-in/+page.server.ts`

- [ ] **Step 15.1: Server load (no action — sign-in goes through the Better Auth client)**

`<NEW_REPO>/src/routes/(auth)/sign-in/+page.server.ts`:

```ts
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) throw redirect(303, url.searchParams.get('next') ?? '/dashboard');
	return {
		justRegistered: url.searchParams.get('registered') === '1',
		justReset: url.searchParams.get('reset') === '1'
	};
};
```

The page calls `authClient.signIn.email(...)` from the browser. Better Auth's client posts to its mounted endpoint at `/api/auth/sign-in/email`, which sets the session cookie on the response automatically.

- [ ] **Step 15.2: Page**

`<NEW_REPO>/src/routes/(auth)/sign-in/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { signIn } from '$lib/auth-client';

	let { data } = $props();
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let errorMsg = $state<string | null>(null);

	async function onSubmit(e: Event) {
		e.preventDefault();
		submitting = true;
		errorMsg = null;
		try {
			const res = await signIn.email({ email, password });
			if (res.error) {
				errorMsg = res.error.message ?? 'Sign-in failed';
				return;
			}
			const next = new URL(window.location.href).searchParams.get('next') ?? '/dashboard';
			goto(next);
		} finally {
			submitting = false;
		}
	}
</script>

<h2 class="mb-4 text-lg font-medium">Sign in</h2>

{#if data.justRegistered}
	<p class="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
		Account created. Check your email to verify, then sign in.
	</p>
{/if}
{#if data.justReset}
	<p class="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
		Password updated. Sign in with your new password.
	</p>
{/if}

{#if errorMsg}
	<p class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMsg}</p>
{/if}

<form onsubmit={onSubmit} class="space-y-4">
	<label class="block">
		<span class="mb-1 block text-sm">Email</span>
		<input
			class="w-full rounded border px-3 py-2"
			type="email"
			bind:value={email}
			autocomplete="email"
			required
		/>
	</label>
	<label class="block">
		<span class="mb-1 block text-sm">Password</span>
		<input
			class="w-full rounded border px-3 py-2"
			type="password"
			bind:value={password}
			autocomplete="current-password"
			required
		/>
	</label>
	<button
		class="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
		type="submit"
		disabled={submitting}
	>
		{submitting ? 'Signing in…' : 'Sign in'}
	</button>
</form>

<p class="mt-4 text-sm">
	No account? <a href="/sign-up" class="underline">Create one</a><br />
	<a href="/forgot-password" class="underline">Forgot password?</a>
</p>
```

- [ ] **Step 15.3: Manual smoke**

```bash
npm run dev
```

Sign up a fresh user, copy the verification URL from the dev console, paste it into the browser (it 404s until Task 17), then sign in at `/sign-in`. Expected: redirect to `/dashboard` (404 until Task 18).

- [ ] **Step 15.4: Commit**

```bash
git add -A
git commit -m "feat(auth): sign-in page using Better Auth client"
```

---

### Task 16: Forgot + reset password pages

**Files:**

- Create: `<NEW_REPO>/src/routes/(auth)/forgot-password/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/forgot-password/+page.server.ts`
- Create: `<NEW_REPO>/src/routes/(auth)/reset-password/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/reset-password/+page.server.ts`

- [ ] **Step 16.1: Forgot — server**

```ts
// src/routes/(auth)/forgot-password/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { forgotSchema } from '$lib/validation/auth';
import { createAuth } from '$lib/server/auth';
import { withEmailContext } from '$lib/server/email/context';

export const load: PageServerLoad = async () => ({ form: await superValidate(zod(forgotSchema)) });

export const actions: Actions = {
	default: async ({ request, platform }) => {
		const env = platform!.env;
		const form = await superValidate(request, zod(forgotSchema));
		if (!form.valid) return fail(400, { form });

		const auth = createAuth({
			d1: env.DB,
			sessionSecret: env.SESSION_SECRET,
			appUrl: env.PUBLIC_APP_URL
		});

		await withEmailContext(
			{
				apiKey: env.RESEND_API_KEY,
				senderEmail: env.RESEND_SENDER_EMAIL,
				senderName: env.RESEND_SENDER_NAME,
				appUrl: env.PUBLIC_APP_URL
			},
			() =>
				auth.api.forgetPassword({
					body: { email: form.data.email, redirectTo: `${env.PUBLIC_APP_URL}/reset-password` }
				})
		);

		// Always return success to avoid email enumeration.
		return message(form, 'If that email exists, a reset link is on its way.');
	}
};
```

- [ ] **Step 16.2: Forgot — page**

```svelte
<!-- src/routes/(auth)/forgot-password/+page.svelte -->
<script lang="ts">
	import { superForm } from 'sveltekit-superforms';

	let { data } = $props();
	const { form, errors, enhance, message: msg, submitting } = superForm(data.form);
</script>

<h2 class="mb-4 text-lg font-medium">Forgot password</h2>

{#if $msg}
	<p class="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">{$msg}</p>
{/if}

<form method="POST" use:enhance class="space-y-4">
	<label class="block">
		<span class="mb-1 block text-sm">Email</span>
		<input
			class="w-full rounded border px-3 py-2"
			name="email"
			type="email"
			bind:value={$form.email}
			required
		/>
		{#if $errors.email}<small class="text-red-600">{$errors.email}</small>{/if}
	</label>
	<button
		class="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
		type="submit"
		disabled={$submitting}
	>
		{$submitting ? 'Sending…' : 'Send reset link'}
	</button>
</form>

<p class="mt-4 text-sm"><a href="/sign-in" class="underline">Back to sign in</a></p>
```

- [ ] **Step 16.3: Reset — server**

```ts
// src/routes/(auth)/reset-password/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { resetSchema } from '$lib/validation/auth';
import { createAuth } from '$lib/server/auth';
import { withEmailContext } from '$lib/server/email/context';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	const form = await superValidate({ token, password: '', confirmPassword: '' }, zod(resetSchema), {
		errors: false
	});
	return { form, token };
};

export const actions: Actions = {
	default: async ({ request, platform }) => {
		const env = platform!.env;
		const form = await superValidate(request, zod(resetSchema));
		if (!form.valid) return fail(400, { form });

		const auth = createAuth({
			d1: env.DB,
			sessionSecret: env.SESSION_SECRET,
			appUrl: env.PUBLIC_APP_URL
		});

		try {
			await withEmailContext(
				{
					apiKey: env.RESEND_API_KEY,
					senderEmail: env.RESEND_SENDER_EMAIL,
					senderName: env.RESEND_SENDER_NAME,
					appUrl: env.PUBLIC_APP_URL
				},
				() =>
					auth.api.resetPassword({
						body: { token: form.data.token, newPassword: form.data.password }
					})
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Reset failed';
			return fail(400, { form, message: msg });
		}

		throw redirect(303, '/sign-in?reset=1');
	}
};
```

- [ ] **Step 16.4: Reset — page**

```svelte
<!-- src/routes/(auth)/reset-password/+page.svelte -->
<script lang="ts">
	import { superForm } from 'sveltekit-superforms';

	let { data } = $props();
	const { form, errors, enhance, submitting } = superForm(data.form);
</script>

<h2 class="mb-4 text-lg font-medium">Choose a new password</h2>

<form method="POST" use:enhance class="space-y-4">
	<input type="hidden" name="token" bind:value={$form.token} />
	<label class="block">
		<span class="mb-1 block text-sm">New password</span>
		<input
			class="w-full rounded border px-3 py-2"
			name="password"
			type="password"
			bind:value={$form.password}
			required
		/>
		{#if $errors.password}<small class="text-red-600">{$errors.password}</small>{/if}
	</label>
	<label class="block">
		<span class="mb-1 block text-sm">Confirm password</span>
		<input
			class="w-full rounded border px-3 py-2"
			name="confirmPassword"
			type="password"
			bind:value={$form.confirmPassword}
			required
		/>
		{#if $errors.confirmPassword}<small class="text-red-600">{$errors.confirmPassword}</small>{/if}
	</label>
	<button
		class="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
		type="submit"
		disabled={$submitting}
	>
		{$submitting ? 'Saving…' : 'Save new password'}
	</button>
</form>
```

- [ ] **Step 16.5: Smoke + commit**

```bash
npm run dev
```

Hit `/forgot-password`, request reset for an existing user. Console logs the reset URL. Open the URL → reset works → redirect to `/sign-in?reset=1`.

```bash
git add -A
git commit -m "feat(auth): forgot + reset password flows"
```

---

### Task 17: Verify-email page

**Files:**

- Create: `<NEW_REPO>/src/routes/(auth)/verify-email/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(auth)/verify-email/+page.server.ts`

- [ ] **Step 17.1: Server**

```ts
// src/routes/(auth)/verify-email/+page.server.ts
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { createAuth } from '$lib/server/auth';
import { withEmailContext } from '$lib/server/email/context';

export const load: PageServerLoad = async ({ url, platform }) => {
	const env = platform!.env;
	const token = url.searchParams.get('token');
	if (!token) return { ok: false as const, error: 'Missing verification token.' };

	const auth = createAuth({
		d1: env.DB,
		sessionSecret: env.SESSION_SECRET,
		appUrl: env.PUBLIC_APP_URL
	});

	try {
		await withEmailContext(
			{
				apiKey: env.RESEND_API_KEY,
				senderEmail: env.RESEND_SENDER_EMAIL,
				senderName: env.RESEND_SENDER_NAME,
				appUrl: env.PUBLIC_APP_URL
			},
			() => auth.api.verifyEmail({ query: { token } })
		);
	} catch (e) {
		return { ok: false as const, error: e instanceof Error ? e.message : 'Verification failed.' };
	}

	throw redirect(303, '/dashboard');
};
```

- [ ] **Step 17.2: Page**

```svelte
<!-- src/routes/(auth)/verify-email/+page.svelte -->
<script lang="ts">
	let { data } = $props();
</script>

<h2 class="mb-4 text-lg font-medium">Email verification</h2>
{#if !data.ok}
	<p class="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{data.error}</p>
	<p class="mt-4 text-sm"><a href="/sign-in" class="underline">Back to sign in</a></p>
{/if}
```

- [ ] **Step 17.3: Commit**

```bash
git add -A
git commit -m "feat(auth): verify-email page"
```

---

### Task 18: App shell + dashboard placeholder

**Files:**

- Create: `<NEW_REPO>/src/routes/(app)/+layout.server.ts`
- Create: `<NEW_REPO>/src/routes/(app)/+layout.svelte`
- Create: `<NEW_REPO>/src/routes/(app)/dashboard/+page.svelte`
- Create: `<NEW_REPO>/src/routes/(app)/dashboard/+page.server.ts`
- Create: `<NEW_REPO>/src/lib/server/services/preferences.ts`
- Modify: `<NEW_REPO>/src/routes/+page.svelte`

- [ ] **Step 18.1: Preferences service**

`<NEW_REPO>/src/lib/server/services/preferences.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { DrizzleD1 } from '$lib/server/db/types';
import { userPreferences } from '$lib/server/db/schema';

export async function getOrCreatePreferences(db: DrizzleD1, userId: string) {
	const existing = await db
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);

	if (existing[0]) return existing[0];

	const now = new Date();
	const row = {
		userId,
		locale: 'en',
		currencyDefault: 'USD',
		theme: 'system',
		weekStart: 1,
		updatedAt: now
	};
	await db.insert(userPreferences).values(row).onConflictDoNothing();
	return row;
}
```

- [ ] **Step 18.2: App layout server**

`<NEW_REPO>/src/routes/(app)/+layout.server.ts`:

```ts
import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/guards';
import { getOrCreatePreferences } from '$lib/server/services/preferences';

export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const preferences = await getOrCreatePreferences(event.locals.db, user.id);
	return { user, preferences };
};
```

- [ ] **Step 18.3: App layout shell**

`<NEW_REPO>/src/routes/(app)/+layout.svelte`:

```svelte
<script lang="ts">
	import { signOut } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let { data, children } = $props();

	async function onSignOut() {
		await signOut();
		goto('/sign-in');
	}
</script>

<div class="flex min-h-screen flex-col">
	<header class="flex items-center justify-between border-b px-4 py-3">
		<a href="/dashboard" class="font-semibold">Mavlo</a>
		<div class="flex items-center gap-3 text-sm">
			<span>{data.user?.email}</span>
			<button class="underline" onclick={onSignOut}>Sign out</button>
		</div>
	</header>

	<main class="mx-auto w-full max-w-3xl flex-1 p-4">
		{@render children?.()}
	</main>

	<nav class="border-t bg-white">
		<ul class="mx-auto flex max-w-3xl items-center justify-around py-2 text-sm">
			<li><a href="/dashboard">Dashboard</a></li>
			<li><a href="/settings">Settings</a></li>
		</ul>
	</nav>
</div>
```

- [ ] **Step 18.4: Dashboard placeholder**

`<NEW_REPO>/src/routes/(app)/dashboard/+page.server.ts`:

```ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user, preferences } = await parent();
	return { user, preferences };
};
```

`<NEW_REPO>/src/routes/(app)/dashboard/+page.svelte`:

```svelte
<script lang="ts">
	let { data } = $props();
</script>

<h1 class="mb-4 text-xl font-semibold">Welcome, {data.user.name ?? data.user.email}</h1>
<p class="text-muted-foreground text-sm">
	Locale: {data.preferences.locale} · Currency: {data.preferences.currencyDefault}
</p>
<p class="mt-6 text-sm">
	This shell is ready for accounts, categories, transactions, budgets, and dashboards in subsequent
	plans.
</p>
```

- [ ] **Step 18.5: Root redirect**

Replace `<NEW_REPO>/src/routes/+page.svelte` with:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	onMount(() => goto('/dashboard'));
</script>
```

- [ ] **Step 18.6: Smoke**

```bash
npm run dev
```

Visit `http://localhost:5173/`. Without a session, hitting `/dashboard` should redirect to `/sign-in?next=%2Fdashboard`. After sign-in, dashboard renders with email and preferences.

- [ ] **Step 18.7: Commit**

```bash
git add -A
git commit -m "feat(app): guarded layout shell + dashboard placeholder"
```

---

### Task 19: Vitest infra + preferences test

**Files:**

- Create: `<NEW_REPO>/vitest.config.ts` (or update existing from `sv create`)
- Create: `<NEW_REPO>/src/lib/server/db/__tests__/test-db.ts`
- Create: `<NEW_REPO>/src/lib/server/services/preferences.test.ts`

- [ ] **Step 19.1: Vitest config**

`<NEW_REPO>/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{ts,svelte}'],
		environment: 'node',
		setupFiles: []
	}
});
```

- [ ] **Step 19.2: In-memory DB helper using Drizzle's migrator**

`<NEW_REPO>/src/lib/server/db/__tests__/test-db.ts`:

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import * as schema from '../schema';
import type { DrizzleD1 } from '../types';

export function createTestDb(): DrizzleD1 {
	const sqlite = new Database(':memory:');
	const db = drizzle(sqlite, { schema });

	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });

	// Both better-sqlite3 and D1 use Drizzle's SQLite dialect, so the runtime
	// shape is compatible for the queries used in services. Cast keeps the
	// service signatures DB-agnostic for tests.
	return db as unknown as DrizzleD1;
}
```

- [ ] **Step 19.3: Failing test**

`<NEW_REPO>/src/lib/server/services/preferences.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '$lib/server/db/__tests__/test-db';
import { getOrCreatePreferences } from './preferences';
import { users } from '$lib/server/db/schema';

describe('getOrCreatePreferences', () => {
	it('creates a default row on first call and returns it on subsequent calls', async () => {
		const db = createTestDb();
		const now = new Date();
		await db.insert(users).values({
			id: 'u_1',
			email: 'u1@example.com',
			emailVerified: false,
			name: 'U1',
			image: null,
			createdAt: now,
			updatedAt: now
		});

		const first = await getOrCreatePreferences(db, 'u_1');
		expect(first.userId).toBe('u_1');
		expect(first.locale).toBe('en');
		expect(first.currencyDefault).toBe('USD');

		const second = await getOrCreatePreferences(db, 'u_1');
		expect(second.userId).toBe('u_1');
	});
});
```

- [ ] **Step 19.4: Run**

```bash
npm test -- --run src/lib/server/services/preferences.test.ts
```

Expected: PASS.

- [ ] **Step 19.5: Commit**

```bash
git add -A
git commit -m "test: vitest infra + preferences service test"
```

---

### Task 20: Health check endpoint

**Files:**

- Create: `<NEW_REPO>/src/routes/api/health/+server.ts`

- [ ] **Step 20.1: Implement**

```ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	// Cheap probe: confirm the DB binding answers a trivial query.
	const rows = await locals.db.run(sql`select 1 as ok`);
	return json({ ok: rows?.success ?? true });
};
```

- [ ] **Step 20.2: Smoke + commit**

```bash
npm run dev
curl http://localhost:5173/api/health
# expect: {"ok":true}
```

```bash
git add -A
git commit -m "feat(api): /api/health endpoint"
```

---

### Task 21: Deploy to preview

- [ ] **Step 21.1: Build**

```bash
npm run build
```

Expected: build completes; `.svelte-kit/cloudflare/_worker.js` exists.

- [ ] **Step 21.2: Apply remote migrations (idempotent)**

```bash
npx wrangler d1 migrations apply DB --remote
```

- [ ] **Step 21.3: Deploy**

```bash
npx wrangler deploy
```

Expected: a `https://mavlo.<your-subdomain>.workers.dev` URL is printed. Capture it.

- [ ] **Step 21.4: Update preview `PUBLIC_APP_URL`**

If the printed URL differs from `http://localhost:5173`, update `wrangler.toml` `[vars] PUBLIC_APP_URL` to that workers.dev URL, then redeploy:

```bash
npx wrangler deploy
```

- [ ] **Step 21.5: Smoke against preview**

In a browser:

1. Visit `<preview-url>/sign-up`. Submit a real email you control. Use a real Resend key (set in Task 7) for this to actually deliver mail.
2. Click the verification link.
3. Sign in. Land on `/dashboard`.
4. Sign out.
5. Visit `<preview-url>/api/health`. Expect `{"ok":true}`.

- [ ] **Step 21.6: Commit (no-op safe)**

```bash
git add -A
git commit --allow-empty -m "chore: phase 1 deployed to preview"
```

---

### Task 22: README + handoff notes

**Files:**

- Create: `<NEW_REPO>/README.md`

- [ ] **Step 22.1: Write README**

````markdown
# Mavlo (SvelteKit / Cloudflare)

Greenfield rewrite of the legacy Maflo personal-finance app, rebranded as Mavlo, on Cloudflare Workers + D1 + R2 + Better Auth + Drizzle. See the design spec in the legacy repo at `docs/superpowers/specs/2026-04-25-cloudflare-d1-svelte-rewrite-design.md`.

## Local development

```bash
npm install
npm run dev
```

Cloudflare bindings are stubbed via the SvelteKit platform proxy. Local D1 lives in `.wrangler/state/v3/d1/`.

## Database migrations

Generate after schema changes:

```bash
npx drizzle-kit generate --name <change>
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote
```

## Deploy

Preview:

```bash
npm run build
npx wrangler deploy
```

Production:

```bash
npx wrangler deploy --env production
```

## Tests

```bash
npm test
```
````

- [ ] **Step 22.2: Commit**

```bash
git add -A
git commit -m "docs: add README"
```

---

## Verification checklist

Run this before declaring Phase 1 done.

- [ ] `npm test` passes locally
- [ ] `npm run build` succeeds with no TS errors
- [ ] Local dev: sign-up → console logs verification URL → click URL → sign-in → land on `/dashboard` → sign-out
- [ ] Preview: same flow against the deployed `workers.dev` URL using a real email through Resend
- [ ] `/api/health` returns `{"ok":true}` in both local and preview
- [ ] No secrets in `wrangler.toml` (verify with `git grep -E "RESEND|SESSION_SECRET"`)
- [ ] `.dev.vars` is git-ignored

---

## Self-review notes

Reviewed against spec (`2026-04-25-cloudflare-d1-svelte-rewrite-design.md`):

- §3 Stack: every listed dep is installed in Tasks 1–3.
- §4 Topology: bindings (DB, BUCKET, secrets) all configured in Task 6.
- §5 Schema: only the auth + preferences subset is implemented here. App tables (`accounts`, `categories`, `transactions`, `budgets`) are explicitly deferred to subsequent plans.
- §6 Auth & Authorization: Tasks 10–17 cover Better Auth, hooks injection, guards, sign-up/sign-in/forgot/reset/verify.
- §7 Structure: directories created match the spec (`lib/server/{db,auth.ts,email,services,guards.ts}`, `routes/(auth)`, `routes/(app)`, `routes/api/auth`, `routes/api/health`).
- §8 Data flow: read path demonstrated by `(app)/+layout.server.ts`; write path demonstrated by sign-up / forgot / reset actions using Superforms + zod.
- §9 PWA, §11 Testing (full coverage of features), §12 Deploy/CI, §13 Build sequence steps 6–14 — deferred to later plans (this plan covers steps 1–5 + 15 of the spec sequence).
- §10 Error handling: the centralized `handleError` is not yet implemented; SvelteKit defaults are sufficient until a later plan introduces structured logging.

No placeholders or TBDs remain in code samples. Method names and types match across tasks (`createAuth`, `withEmailContext`, `requireUser`, `getOrCreatePreferences`).
