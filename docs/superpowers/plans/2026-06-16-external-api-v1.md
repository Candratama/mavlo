# External API v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an externally-accessible HTTP/JSON API (per-user Bearer API keys) for CRUD on transactions, accounts, and categories, plus an in-app settings page to manage keys.

**Architecture:** New `api_keys` table (SHA-256 hashed keys). A thin auth helper resolves `userId` from the Bearer token. Per-resource handler modules wrap the existing user-scoped repositories with validation + a consistent JSON envelope; SvelteKit `+server.ts` routes wire `getDb` + auth + handler. Key creation/revocation lives in a session-authed settings page reusing the existing form-action pattern.

**Tech Stack:** SvelteKit, Drizzle ORM (D1 in prod, better-sqlite3 in tests), Zod v4, Web Crypto (`crypto.subtle`, `crypto.getRandomValues`), Vitest.

---

## File Structure

**Create:**
- `src/lib/server/api/errors.ts` — `ApiError` class
- `src/lib/server/api/respond.ts` — JSON envelope helpers (`ok`, `list`, `toErrorResponse`)
- `src/lib/server/api/keys-crypto.ts` — key generation + hashing
- `src/lib/server/api/authenticate.ts` — `requireApiKey(request, db)`
- `src/lib/server/api/keys-crypto.test.ts`
- `src/lib/server/api/authenticate.test.ts`
- `src/lib/server/repositories/api-keys.ts` — key repo (create/list/revoke/authenticate)
- `src/lib/server/repositories/api-keys.test.ts`
- `src/lib/server/api/handlers/transactions.ts` + `.test.ts`
- `src/lib/server/api/handlers/accounts.ts` + `.test.ts`
- `src/lib/server/api/handlers/categories.ts` + `.test.ts`
- `src/routes/api/v1/transactions/+server.ts`
- `src/routes/api/v1/transactions/[id]/+server.ts`
- `src/routes/api/v1/accounts/+server.ts`
- `src/routes/api/v1/accounts/[id]/+server.ts`
- `src/routes/api/v1/categories/+server.ts`
- `src/routes/api/v1/categories/[id]/+server.ts`
- `src/routes/(app)/settings/api-keys/+page.server.ts`
- `src/routes/(app)/settings/api-keys/+page.svelte`

**Modify:**
- `src/lib/server/db/schema.ts` — add `apiKeys` table
- `src/lib/server/db/test-fixtures.ts` — add `api_keys` table SQL + union type
- `drizzle/` — new generated migration (via `npm run db:generate`)

---

## Task 1: `api_keys` schema + migration

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/server/db/test-fixtures.ts`
- Create (generated): `drizzle/00XX_*.sql`

- [ ] **Step 1: Add the `apiKeys` table to schema**

In `src/lib/server/db/schema.ts`, after the `userPreferences` table and before `export * from './auth.schema';`, add:

```ts
export const apiKeys = sqliteTable(
	'api_keys',
	{
		id: cuid().primaryKey(),
		userId: userIdFk(),
		name: text('name').notNull(),
		keyHash: text('key_hash').notNull(),
		prefix: text('prefix').notNull(),
		lastUsedAt: integer('last_used_at', { mode: 'number' }),
		createdAt: epochMsNow('created_at'),
		revokedAt: integer('revoked_at', { mode: 'number' })
	},
	(t) => [index('api_keys_hash_idx').on(t.keyHash), index('api_keys_user_idx').on(t.userId)]
);
```

- [ ] **Step 2: Add the table to test fixtures**

In `src/lib/server/db/test-fixtures.ts`, add this constant after `debtsTableSql`:

```ts
const apiKeysTableSql = `
	CREATE TABLE api_keys (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		key_hash TEXT NOT NULL,
		prefix TEXT NOT NULL,
		last_used_at INTEGER,
		created_at INTEGER NOT NULL,
		revoked_at INTEGER
	)
`;
```

Update the `tables` union type in the `createTestDb` signature to include `'api_keys'`:

```ts
export function createTestDb(opts: {
	tables: (
		| 'accounts'
		| 'categories'
		| 'transactions'
		| 'budgets'
		| 'budget_subsidies'
		| 'debts'
		| 'api_keys'
	)[];
}): TestDbHandle {
```

And add the conditional create alongside the others (after the `budget_subsidies` line):

```ts
	if (opts.tables.includes('api_keys')) sqlite.prepare(apiKeysTableSql).run();
```

- [ ] **Step 3: Generate the migration**

Run: `npm run db:generate`
Expected: a new file `drizzle/00XX_*.sql` containing `CREATE TABLE \`api_keys\`` and the two indexes. drizzle-kit prints the created migration filename.

- [ ] **Step 4: Verify types compile**

Run: `./node_modules/.bin/svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`
Expected: no NEW errors referencing `schema.ts` or `test-fixtures.ts` (pre-existing warnings about `state_referenced_locally` are unrelated).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/test-fixtures.ts drizzle/
git commit -m "feat(api): add api_keys table + migration"
```

---

## Task 2: Key crypto util

**Files:**
- Create: `src/lib/server/api/keys-crypto.ts`
- Test: `src/lib/server/api/keys-crypto.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/server/api/keys-crypto.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey } from './keys-crypto';

describe('keys-crypto', () => {
	it('generateApiKey returns mavlo_sk_-prefixed plaintext and a matching prefix', () => {
		const { plaintext, prefix } = generateApiKey();
		expect(plaintext.startsWith('mavlo_sk_')).toBe(true);
		expect(prefix.length).toBe(16);
		expect(plaintext.startsWith(prefix)).toBe(true);
	});

	it('generateApiKey produces unique keys', () => {
		expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
	});

	it('hashApiKey is deterministic and 64 hex chars', async () => {
		const a = await hashApiKey('mavlo_sk_abc');
		const b = await hashApiKey('mavlo_sk_abc');
		expect(a).toBe(b);
		expect(a).toMatch(/^[0-9a-f]{64}$/);
	});

	it('hashApiKey differs for different inputs', async () => {
		expect(await hashApiKey('mavlo_sk_a')).not.toBe(await hashApiKey('mavlo_sk_b'));
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/api/keys-crypto.test.ts`
Expected: FAIL — cannot find module `./keys-crypto`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/server/api/keys-crypto.ts`:

```ts
const KEY_PREFIX = 'mavlo_sk_';

function toBase64Url(bytes: Uint8Array): string {
	const b64 = btoa(String.fromCharCode(...bytes));
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateApiKey(): { plaintext: string; prefix: string } {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const plaintext = KEY_PREFIX + toBase64Url(bytes);
	return { plaintext, prefix: plaintext.slice(0, 16) };
}

export async function hashApiKey(plaintext: string): Promise<string> {
	const data = new TextEncoder().encode(plaintext);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/api/keys-crypto.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/api/keys-crypto.ts src/lib/server/api/keys-crypto.test.ts
git commit -m "feat(api): add API key generation + hashing"
```

---

## Task 3: API keys repository

**Files:**
- Create: `src/lib/server/repositories/api-keys.ts`
- Test: `src/lib/server/repositories/api-keys.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/server/repositories/api-keys.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { createApiKey, listApiKeys, revokeApiKey, authenticateApiKey } from './api-keys';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['api_keys'] });
});

describe('api-keys repository', () => {
	it('createApiKey returns plaintext once and stores a row (no plaintext leak in list)', async () => {
		const { row, plaintext } = await createApiKey(h.db, h.userId, 'My Key');
		expect(plaintext.startsWith('mavlo_sk_')).toBe(true);
		expect(row.name).toBe('My Key');
		const keys = await listApiKeys(h.db, h.userId);
		expect(keys).toHaveLength(1);
		expect(keys[0]).not.toHaveProperty('keyHash');
		expect(keys[0].prefix).toBe(plaintext.slice(0, 16));
	});

	it('authenticateApiKey resolves the owning userId for a valid key', async () => {
		const { plaintext } = await createApiKey(h.db, h.userId, 'k');
		expect(await authenticateApiKey(h.db, plaintext)).toBe(h.userId);
	});

	it('authenticateApiKey returns null for an unknown key', async () => {
		expect(await authenticateApiKey(h.db, 'mavlo_sk_nope')).toBeNull();
	});

	it('authenticateApiKey returns null for a revoked key', async () => {
		const { row, plaintext } = await createApiKey(h.db, h.userId, 'k');
		await revokeApiKey(h.db, h.userId, row.id);
		expect(await authenticateApiKey(h.db, plaintext)).toBeNull();
	});

	it('revokeApiKey is scoped to the owner', async () => {
		const { row } = await createApiKey(h.db, h.userId, 'k');
		expect(await revokeApiKey(h.db, h.otherUserId, row.id)).toBeNull();
		expect(await revokeApiKey(h.db, h.userId, row.id)).not.toBeNull();
	});

	it('listApiKeys returns only the owner keys', async () => {
		await createApiKey(h.db, h.userId, 'a');
		await createApiKey(h.db, h.otherUserId, 'b');
		expect(await listApiKeys(h.db, h.userId)).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/repositories/api-keys.test.ts`
Expected: FAIL — cannot find module `./api-keys`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/server/repositories/api-keys.ts`:

```ts
import { and, desc, eq, isNull } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { apiKeys } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import { generateApiKey, hashApiKey } from '$lib/server/api/keys-crypto';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

const publicColumns = {
	id: apiKeys.id,
	name: apiKeys.name,
	prefix: apiKeys.prefix,
	lastUsedAt: apiKeys.lastUsedAt,
	createdAt: apiKeys.createdAt,
	revokedAt: apiKeys.revokedAt
};

export async function createApiKey(db: Db, userId: string, name: string) {
	const { plaintext, prefix } = generateApiKey();
	const keyHash = await hashApiKey(plaintext);
	const [row] = await db.insert(apiKeys).values({ userId, name, keyHash, prefix }).returning();
	return { row, plaintext };
}

export async function listApiKeys(db: Db, userId: string) {
	return db
		.select(publicColumns)
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))
		.orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(db: Db, userId: string, id: string) {
	const [row] = await db
		.update(apiKeys)
		.set({ revokedAt: Date.now() })
		.where(and(eq(apiKeys.userId, userId), eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
		.returning();
	return row ?? null;
}

export async function authenticateApiKey(db: Db, plaintext: string): Promise<string | null> {
	const keyHash = await hashApiKey(plaintext);
	const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
	if (!row || row.revokedAt) return null;
	await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, row.id));
	return row.userId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/repositories/api-keys.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/repositories/api-keys.ts src/lib/server/repositories/api-keys.test.ts
git commit -m "feat(api): add api-keys repository"
```

---

## Task 4: Errors + response envelope helpers

**Files:**
- Create: `src/lib/server/api/errors.ts`
- Create: `src/lib/server/api/respond.ts`

(No standalone test — exercised by handler + authenticate tests in later tasks.)

- [ ] **Step 1: Write `ApiError`**

`src/lib/server/api/errors.ts`:

```ts
export type ApiErrorCode = 'unauthorized' | 'not_found' | 'validation' | 'server';

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: ApiErrorCode,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}
```

- [ ] **Step 2: Write the envelope helpers**

`src/lib/server/api/respond.ts`:

```ts
import { json } from '@sveltejs/kit';
import { ApiError } from './errors';

export function ok(data: unknown, status = 200): Response {
	return json({ data }, { status });
}

export function list(data: unknown, nextCursor: string | null = null): Response {
	return json({ data, nextCursor });
}

export function noContent(): Response {
	return new Response(null, { status: 204 });
}

export function toErrorResponse(err: unknown): Response {
	if (err instanceof ApiError) {
		return json({ error: { code: err.code, message: err.message } }, { status: err.status });
	}
	console.error('Unhandled API error', err);
	return json({ error: { code: 'server', message: 'Internal error' } }, { status: 500 });
}
```

- [ ] **Step 3: Verify types compile**

Run: `./node_modules/.bin/svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`
Expected: no new errors referencing `errors.ts` or `respond.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/api/errors.ts src/lib/server/api/respond.ts
git commit -m "feat(api): add ApiError + JSON envelope helpers"
```

---

## Task 5: Bearer auth helper

**Files:**
- Create: `src/lib/server/api/authenticate.ts`
- Test: `src/lib/server/api/authenticate.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/server/api/authenticate.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { createApiKey } from '$lib/server/repositories/api-keys';
import { requireApiKey } from './authenticate';
import { ApiError } from './errors';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['api_keys'] });
});

function req(authHeader?: string): Request {
	const headers = new Headers();
	if (authHeader) headers.set('authorization', authHeader);
	return new Request('https://x/api/v1/transactions', { headers });
}

describe('requireApiKey', () => {
	it('resolves userId for a valid bearer token', async () => {
		const { plaintext } = await createApiKey(h.db, h.userId, 'k');
		expect(await requireApiKey(req(`Bearer ${plaintext}`), h.db)).toBe(h.userId);
	});

	it('throws 401 when header is missing', async () => {
		await expect(requireApiKey(req(), h.db)).rejects.toMatchObject({
			status: 401,
			code: 'unauthorized'
		});
	});

	it('throws 401 when scheme is not Bearer', async () => {
		await expect(requireApiKey(req('Basic abc'), h.db)).rejects.toBeInstanceOf(ApiError);
	});

	it('throws 401 for an invalid token', async () => {
		await expect(requireApiKey(req('Bearer mavlo_sk_nope'), h.db)).rejects.toMatchObject({
			status: 401
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/api/authenticate.test.ts`
Expected: FAIL — cannot find module `./authenticate`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/server/api/authenticate.ts`:

```ts
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { authenticateApiKey } from '$lib/server/repositories/api-keys';
import { ApiError } from './errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function requireApiKey(request: Request, db: Db): Promise<string> {
	const header = request.headers.get('authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) throw new ApiError(401, 'unauthorized', 'Missing or malformed bearer token');
	const userId = await authenticateApiKey(db, match[1].trim());
	if (!userId) throw new ApiError(401, 'unauthorized', 'Invalid or revoked API key');
	return userId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/api/authenticate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/api/authenticate.ts src/lib/server/api/authenticate.test.ts
git commit -m "feat(api): add Bearer API key auth helper"
```

---

## Task 6: Transactions handler module

**Files:**
- Create: `src/lib/server/api/handlers/transactions.ts`
- Test: `src/lib/server/api/handlers/transactions.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/server/api/handlers/transactions.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { ApiError } from '../errors';
import { listTx, createTx, getTx, updateTx, deleteTx } from './transactions';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts', 'categories', 'transactions', 'budgets', 'budget_subsidies', 'debts'] });
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
});

function url(qs = ''): URL {
	return new URL(`https://x/api/v1/transactions${qs}`);
}

describe('transactions handler', () => {
	it('createTx + listTx round-trips', async () => {
		const created = await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 5000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		expect(created.amountCents).toBe(5000);
		const rows = await listTx(h.db, h.userId, url());
		expect(rows).toHaveLength(1);
	});

	it('createTx throws 400 on invalid body', async () => {
		await expect(createTx(h.db, h.userId, { kind: 'expense' })).rejects.toMatchObject({
			status: 400,
			code: 'validation'
		});
	});

	it('getTx throws 404 for missing id', async () => {
		await expect(getTx(h.db, h.userId, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('updateTx updates and returns the row', async () => {
		const created = await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		const updated = await updateTx(h.db, h.userId, created.id, {
			accountId: 'acc1',
			amountCents: 2000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		expect(updated.amountCents).toBe(2000);
	});

	it('updateTx throws 404 for another user', async () => {
		const created = await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		await expect(
			updateTx(h.db, h.otherUserId, created.id, {
				accountId: 'acc1',
				amountCents: 2000,
				kind: 'expense',
				occurredAt: Date.now()
			})
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteTx throws 404 when missing, succeeds when present', async () => {
		const created = await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		await expect(deleteTx(h.db, h.otherUserId, created.id)).rejects.toMatchObject({ status: 404 });
		await expect(deleteTx(h.db, h.userId, created.id)).resolves.toBeUndefined();
	});

	it('listTx applies kind filter from query string', async () => {
		await createTx(h.db, h.userId, { accountId: 'acc1', amountCents: 1, kind: 'income', occurredAt: Date.now() });
		await createTx(h.db, h.userId, { accountId: 'acc1', amountCents: 2, kind: 'expense', occurredAt: Date.now() });
		expect(await listTx(h.db, h.userId, url('?kind=income'))).toHaveLength(1);
	});

	it('ApiError is the thrown type', async () => {
		await expect(getTx(h.db, h.userId, 'nope')).rejects.toBeInstanceOf(ApiError);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/api/handlers/transactions.test.ts`
Expected: FAIL — cannot find module `./transactions`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/server/api/handlers/transactions.ts`:

```ts
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionListFilterSchema
} from '$lib/validation/transaction';
import * as repo from '$lib/server/repositories/transactions';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

export async function listTx(db: Db, userId: string, url: URL) {
	const parsed = transactionListFilterSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.listTransactions(db, userId, parsed.data);
}

export async function createTx(db: Db, userId: string, body: unknown) {
	const parsed = transactionCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.createTransaction(db, userId, parsed.data);
}

export async function getTx(db: Db, userId: string, id: string) {
	const row = await repo.getTransaction(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
	return row;
}

export async function updateTx(db: Db, userId: string, id: string, body: unknown) {
	const parsed = transactionUpdateSchema.safeParse({ ...(body as object), id });
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateTransaction(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
	return row;
}

export async function deleteTx(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteTransaction(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/api/handlers/transactions.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/api/handlers/transactions.ts src/lib/server/api/handlers/transactions.test.ts
git commit -m "feat(api): add transactions handler module"
```

---

## Task 7: Accounts handler module

**Files:**
- Create: `src/lib/server/api/handlers/accounts.ts`
- Test: `src/lib/server/api/handlers/accounts.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/server/api/handlers/accounts.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { listAcc, createAcc, getAcc, updateAcc, deleteAcc } from './accounts';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts'] });
});

function url(qs = ''): URL {
	return new URL(`https://x/api/v1/accounts${qs}`);
}

describe('accounts handler', () => {
	it('createAcc + listAcc round-trips', async () => {
		const created = await createAcc(h.db, h.userId, { name: 'Bank', type: 'bank', currency: 'IDR' });
		expect(created.name).toBe('Bank');
		expect(await listAcc(h.db, h.userId, url())).toHaveLength(1);
	});

	it('createAcc throws 400 on invalid body', async () => {
		await expect(createAcc(h.db, h.userId, { name: '' })).rejects.toMatchObject({
			status: 400,
			code: 'validation'
		});
	});

	it('listAcc excludes archived by default and includes them with ?includeArchived=true', async () => {
		const a = await createAcc(h.db, h.userId, { name: 'A', type: 'cash', currency: 'IDR' });
		h.sqlite.prepare('UPDATE accounts SET archived = 1 WHERE id = ?').run(a.id);
		expect(await listAcc(h.db, h.userId, url())).toHaveLength(0);
		expect(await listAcc(h.db, h.userId, url('?includeArchived=true'))).toHaveLength(1);
	});

	it('getAcc throws 404 for missing id', async () => {
		await expect(getAcc(h.db, h.userId, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('updateAcc throws 404 for another user', async () => {
		const a = await createAcc(h.db, h.userId, { name: 'A', type: 'cash', currency: 'IDR' });
		await expect(
			updateAcc(h.db, h.otherUserId, a.id, { name: 'B', type: 'cash', currency: 'IDR' })
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteAcc throws 404 when missing, succeeds when present', async () => {
		const a = await createAcc(h.db, h.userId, { name: 'A', type: 'cash', currency: 'IDR' });
		await expect(deleteAcc(h.db, h.otherUserId, a.id)).rejects.toMatchObject({ status: 404 });
		await expect(deleteAcc(h.db, h.userId, a.id)).resolves.toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/api/handlers/accounts.test.ts`
Expected: FAIL — cannot find module `./accounts`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/server/api/handlers/accounts.ts`:

```ts
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { accountCreateSchema, accountUpdateSchema } from '$lib/validation/account';
import * as repo from '$lib/server/repositories/accounts';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

export async function listAcc(db: Db, userId: string, url: URL) {
	const includeArchived = url.searchParams.get('includeArchived') === 'true';
	return repo.listAccounts(db, userId, { includeArchived });
}

export async function createAcc(db: Db, userId: string, body: unknown) {
	const parsed = accountCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.createAccount(db, userId, parsed.data);
}

export async function getAcc(db: Db, userId: string, id: string) {
	const row = await repo.getAccount(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
	return row;
}

export async function updateAcc(db: Db, userId: string, id: string, body: unknown) {
	const parsed = accountUpdateSchema.safeParse({ ...(body as object), id });
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateAccount(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
	return row;
}

export async function deleteAcc(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteAccount(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/api/handlers/accounts.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/api/handlers/accounts.ts src/lib/server/api/handlers/accounts.test.ts
git commit -m "feat(api): add accounts handler module"
```

---

## Task 8: Categories handler module

**Files:**
- Create: `src/lib/server/api/handlers/categories.ts`
- Test: `src/lib/server/api/handlers/categories.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/server/api/handlers/categories.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { listCat, createCat, getCat, updateCat, deleteCat } from './categories';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['categories'] });
});

function url(qs = ''): URL {
	return new URL(`https://x/api/v1/categories${qs}`);
}

describe('categories handler', () => {
	it('createCat + listCat round-trips', async () => {
		const created = await createCat(h.db, h.userId, { name: 'Food', kind: 'expense' });
		expect(created.name).toBe('Food');
		expect(await listCat(h.db, h.userId, url())).toHaveLength(1);
	});

	it('createCat throws 400 on invalid body', async () => {
		await expect(createCat(h.db, h.userId, { name: '' })).rejects.toMatchObject({
			status: 400,
			code: 'validation'
		});
	});

	it('getCat throws 404 for missing id', async () => {
		await expect(getCat(h.db, h.userId, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('updateCat throws 404 for another user', async () => {
		const c = await createCat(h.db, h.userId, { name: 'Food', kind: 'expense' });
		await expect(
			updateCat(h.db, h.otherUserId, c.id, { name: 'X', kind: 'expense' })
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteCat throws 404 when missing, succeeds when present', async () => {
		const c = await createCat(h.db, h.userId, { name: 'Food', kind: 'expense' });
		await expect(deleteCat(h.db, h.otherUserId, c.id)).rejects.toMatchObject({ status: 404 });
		await expect(deleteCat(h.db, h.userId, c.id)).resolves.toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/api/handlers/categories.test.ts`
Expected: FAIL — cannot find module `./categories`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/server/api/handlers/categories.ts`:

```ts
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { categoryCreateSchema, categoryUpdateSchema } from '$lib/validation/category';
import * as repo from '$lib/server/repositories/categories';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

export async function listCat(db: Db, userId: string, url: URL) {
	const includeArchived = url.searchParams.get('includeArchived') === 'true';
	return repo.listCategories(db, userId, { includeArchived });
}

export async function createCat(db: Db, userId: string, body: unknown) {
	const parsed = categoryCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.createCategory(db, userId, parsed.data);
}

export async function getCat(db: Db, userId: string, id: string) {
	const row = await repo.getCategory(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Category not found');
	return row;
}

export async function updateCat(db: Db, userId: string, id: string, body: unknown) {
	const parsed = categoryUpdateSchema.safeParse({ ...(body as object), id });
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateCategory(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Category not found');
	return row;
}

export async function deleteCat(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteCategory(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Category not found');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/api/handlers/categories.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/api/handlers/categories.ts src/lib/server/api/handlers/categories.test.ts
git commit -m "feat(api): add categories handler module"
```

---

## Task 9: Route files — wire handlers to HTTP

**Files:**
- Create: `src/routes/api/v1/transactions/+server.ts`
- Create: `src/routes/api/v1/transactions/[id]/+server.ts`
- Create: `src/routes/api/v1/accounts/+server.ts`
- Create: `src/routes/api/v1/accounts/[id]/+server.ts`
- Create: `src/routes/api/v1/categories/+server.ts`
- Create: `src/routes/api/v1/categories/[id]/+server.ts`

These are thin glue (auth + getDb + handler + envelope) and are verified by Task 11's manual smoke test plus type-checking. No unit test (would require a D1 shim; the logic lives in tested handler modules).

- [ ] **Step 1: Transactions collection route**

`src/routes/api/v1/transactions/+server.ts`:

```ts
import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { ok, list, toErrorResponse } from '$lib/server/api/respond';
import { listTx, createTx } from '$lib/server/api/handlers/transactions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return list(await listTx(db, userId, url));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		return ok(await createTx(db, userId, body), 201);
	} catch (e) {
		return toErrorResponse(e);
	}
};
```

- [ ] **Step 2: Transactions item route**

`src/routes/api/v1/transactions/[id]/+server.ts`:

```ts
import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { ok, noContent, toErrorResponse } from '$lib/server/api/respond';
import { getTx, updateTx, deleteTx } from '$lib/server/api/handlers/transactions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return ok(await getTx(db, userId, params.id));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const PATCH: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		return ok(await updateTx(db, userId, params.id, body));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const DELETE: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		await deleteTx(db, userId, params.id);
		return noContent();
	} catch (e) {
		return toErrorResponse(e);
	}
};
```

- [ ] **Step 3: Accounts collection route**

`src/routes/api/v1/accounts/+server.ts`:

```ts
import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { ok, list, toErrorResponse } from '$lib/server/api/respond';
import { listAcc, createAcc } from '$lib/server/api/handlers/accounts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return list(await listAcc(db, userId, url));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		return ok(await createAcc(db, userId, body), 201);
	} catch (e) {
		return toErrorResponse(e);
	}
};
```

- [ ] **Step 4: Accounts item route**

`src/routes/api/v1/accounts/[id]/+server.ts`:

```ts
import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { ok, noContent, toErrorResponse } from '$lib/server/api/respond';
import { getAcc, updateAcc, deleteAcc } from '$lib/server/api/handlers/accounts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return ok(await getAcc(db, userId, params.id));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const PATCH: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		return ok(await updateAcc(db, userId, params.id, body));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const DELETE: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		await deleteAcc(db, userId, params.id);
		return noContent();
	} catch (e) {
		return toErrorResponse(e);
	}
};
```

- [ ] **Step 5: Categories collection route**

`src/routes/api/v1/categories/+server.ts`:

```ts
import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { ok, list, toErrorResponse } from '$lib/server/api/respond';
import { listCat, createCat } from '$lib/server/api/handlers/categories';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return list(await listCat(db, userId, url));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		return ok(await createCat(db, userId, body), 201);
	} catch (e) {
		return toErrorResponse(e);
	}
};
```

- [ ] **Step 6: Categories item route**

`src/routes/api/v1/categories/[id]/+server.ts`:

```ts
import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { ok, noContent, toErrorResponse } from '$lib/server/api/respond';
import { getCat, updateCat, deleteCat } from '$lib/server/api/handlers/categories';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return ok(await getCat(db, userId, params.id));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const PATCH: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		return ok(await updateCat(db, userId, params.id, body));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const DELETE: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		await deleteCat(db, userId, params.id);
		return noContent();
	} catch (e) {
		return toErrorResponse(e);
	}
};
```

- [ ] **Step 7: Sync routes + verify types**

Run: `npm run prepare && ./node_modules/.bin/svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10`
Expected: no new errors in `src/routes/api/v1/**`. (`npm run prepare` runs `svelte-kit sync` so `./$types` resolves.)

- [ ] **Step 8: Commit**

```bash
git add src/routes/api/v1/
git commit -m "feat(api): add /api/v1 route handlers for transactions, accounts, categories"
```

---

## Task 10: API key management settings page

**Files:**
- Create: `src/routes/(app)/settings/api-keys/+page.server.ts`
- Create: `src/routes/(app)/settings/api-keys/+page.svelte`

> **Pre-step:** confirm the settings group exists. Run `ls "src/routes/(app)/settings"`. If a `+layout.svelte`/`+layout.server.ts` exists there, the new page nests under it automatically — no extra wiring. If `settings/` does not exist, the page still works as a standalone route; no layout creation is required for this plan.

- [ ] **Step 1: Write the load + actions**

`src/routes/(app)/settings/api-keys/+page.server.ts`:

```ts
import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { createApiKey, listApiKeys, revokeApiKey } from '$lib/server/repositories/api-keys';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);
	return { keys: await listApiKeys(db, user.id) };
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const name = String(fd.get('name') ?? '').trim();
		if (!name) return fail(400, { action: 'create', message: 'Name required' });
		const { plaintext } = await createApiKey(db, user.id, name);
		return { success: true, action: 'create', plaintext };
	},

	revoke: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const id = String(fd.get('id') ?? '');
		if (!id) return fail(400, { action: 'revoke', message: 'Id required' });
		const revoked = await revokeApiKey(db, user.id, id);
		if (!revoked) return fail(404, { action: 'revoke', message: 'Key not found' });
		return { success: true, action: 'revoke' };
	}
};
```

- [ ] **Step 2: Write the page UI**

`src/routes/(app)/settings/api-keys/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { notify } from '$lib/utils/toast.js';
	import { Copy, Trash2, KeyRound } from 'lucide-svelte';

	let { data, form } = $props();

	let newName = $state('');
	const createdKey = $derived(form?.action === 'create' && form?.success ? form.plaintext : null);

	function copyKey() {
		if (createdKey) {
			navigator.clipboard.writeText(createdKey);
			notify.success('Key copied');
		}
	}
</script>

<svelte:head><title>API Keys — Mavlo</title></svelte:head>

<div class="mb-6">
	<h1 class="flex items-center gap-2 text-xl font-semibold">
		<KeyRound class="size-5" /> API Keys
	</h1>
	<p class="text-muted-foreground mt-1 text-sm">
		Use these to access the Mavlo API. Send as <code>Authorization: Bearer &lt;key&gt;</code>.
	</p>
</div>

<form
	method="POST"
	action="?/create"
	class="mb-4 flex gap-2"
	use:enhance={() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				newName = '';
				await invalidateAll();
			}
		}}
>
	<Input name="name" bind:value={newName} placeholder="Key name (e.g. Zapier)" required />
	<Button type="submit">Generate</Button>
</form>

{#if createdKey}
	<div class="bg-card mb-4 rounded-lg border p-4">
		<p class="text-sm font-medium">Copy your key now — it won't be shown again.</p>
		<div class="mt-2 flex items-center gap-2">
			<code class="bg-muted flex-1 overflow-x-auto rounded px-2 py-1 text-xs">{createdKey}</code>
			<Button variant="ghost" size="icon" onclick={copyKey} aria-label="Copy key">
				<Copy class="size-4" />
			</Button>
		</div>
	</div>
{/if}

<ul class="space-y-2">
	{#each data.keys as key (key.id)}
		<li class="bg-card flex items-center gap-3 rounded-lg border p-3">
			<div class="min-w-0 flex-1">
				<div class="truncate text-sm font-medium">
					{key.name}
					{#if key.revokedAt}
						<span class="text-destructive ml-1 text-xs">(revoked)</span>
					{/if}
				</div>
				<div class="text-muted-foreground truncate text-xs">
					{key.prefix}… · {key.lastUsedAt
						? 'last used ' + new Date(key.lastUsedAt).toLocaleDateString()
						: 'never used'}
				</div>
			</div>
			{#if !key.revokedAt}
				<form
					method="POST"
					action="?/revoke"
					use:enhance={() =>
						async ({ result }) => {
							if (result.type === 'success') {
								await invalidateAll();
								notify.success('Key revoked');
							} else if (result.type === 'failure') {
								notify.error('Could not revoke key');
							}
						}}
				>
					<input type="hidden" name="id" value={key.id} />
					<Button type="submit" variant="ghost" size="icon" aria-label="Revoke key">
						<Trash2 class="text-destructive size-4" />
					</Button>
				</form>
			{/if}
		</li>
	{:else}
		<li class="text-muted-foreground py-8 text-center text-sm">No API keys yet.</li>
	{/each}
</ul>
```

> **Note:** if `$lib/components/ui/input` or `lucide-svelte` icon names differ, match what the existing accounts/settings pages import. Confirm with `grep -r "from '\$lib/components/ui/input'" src/routes` before writing.

- [ ] **Step 3: Sync + type-check + lint**

Run: `npm run prepare && ./node_modules/.bin/svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10 && npx prettier --check "src/routes/(app)/settings/api-keys/*" && npx eslint "src/routes/(app)/settings/api-keys/"`
Expected: no new type errors; prettier + eslint clean (run `npx prettier --write` on the two files if prettier complains).

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/settings/api-keys/"
git commit -m "feat(api): add API key management settings page"
```

---

## Task 11: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass, including the new `keys-crypto`, `api-keys`, `authenticate`, and three handler test files.

- [ ] **Step 2: Lint + types green**

Run: `npm run lint && ./node_modules/.bin/svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`
Expected: "No issues found" from eslint; prettier passes; no new svelte-check errors.

- [ ] **Step 3: Manual smoke test against local dev**

Start dev (applies the new migration locally): `npm run dev` (background).

In the running app: sign in, open `/settings/api-keys`, generate a key, copy the plaintext.

Then exercise the API (replace `KEY`):

```bash
# list accounts
curl -s -H "Authorization: Bearer KEY" http://localhost:5173/api/v1/accounts
# create a transaction (use a real accountId from the list above)
curl -s -X POST -H "Authorization: Bearer KEY" -H "Content-Type: application/json" \
	-d '{"accountId":"<ACC_ID>","amountCents":12345,"kind":"expense","occurredAt":1750000000000}' \
	http://localhost:5173/api/v1/transactions
# missing key → 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/api/v1/accounts
```

Expected: list returns `{"data":[...]}`; create returns `{"data":{...}}` with status 201; no-key returns `401`.

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore(api): verification fixes for external API v1"
```

---

## Self-Review Notes

- **Spec coverage:** api_keys table (T1) ✓ · key gen/hash shown-once (T2) ✓ · repo create/list/revoke/authenticate (T3) ✓ · envelope + status codes (T4) ✓ · Bearer auth + 401 (T5) ✓ · transactions/accounts/categories CRUD handlers (T6–T8) ✓ · `/api/v1` routes (T9) ✓ · settings UI session-authed (T10) ✓ · unit + cross-user + manual integration tests (T3,T5–T8,T11) ✓ · cents-as-int (handlers pass through repo ints, no float conversion) ✓ · rate limiting intentionally omitted ✓.
- **Type consistency:** handler exports named `listTx/createTx/getTx/updateTx/deleteTx`, `listAcc/createAcc/getAcc/updateAcc/deleteAcc`, `listCat/createCat/getCat/updateCat/deleteCat` — used identically in route files. `ApiError(status, code, message)` signature consistent across all throwers. `requireApiKey(request, db)` arg order matches route call sites.
- **Money:** repos store/return integer `amountCents`; handlers and envelope never convert to float. Documented in spec.
