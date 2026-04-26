# Phase 4 Implementation Plan (Transfers Between Accounts)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Add `transfer` transaction kind so users can move money between their own accounts. Single-row representation: `kind='transfer'`, `account_id` = source, `transfer_to_account_id` = destination. Balance computation gains a JS-fold layer (replacing pure-SQL aggregate) to handle the dual-account effect cleanly.

**Architecture decision (option B from Phase 3 retrospective):** single row per transfer with a new nullable column `transfer_to_account_id`. Cleaner UX than paired-rows; one row per logical transfer.

**Tech Stack:** Same as Phase 3.

**Conventions:**
- `<NEW_REPO>` = `/Users/candratama/Project/WebDev/mavlo`
- Branch: `main` (greenfield, branch strategy A)
- Schema-aware: D1 already has the `transactions` table from Phase 1 (T6b). Adding a column is a `db:push` ALTER (drizzle-kit non-destructive change).

---

## Task 1: Schema Migration — Add `transfer_to_account_id` Column

**Files:**
- Modify: `<NEW_REPO>/src/lib/server/db/schema.ts`

Adds a nullable `transferToAccountId` column to `transactions`. Foreign key references `accounts.id` with `ON DELETE RESTRICT` (don't allow deleting an account if a transfer still points at it — keeps history valid).

- [ ] **Step 1: Edit `transactions` table definition in `src/lib/server/db/schema.ts`**

Add a new column between `categoryId` and `amountCents` (any position works; this keeps related-fields grouped):

```typescript
		categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
		transferToAccountId: text('transfer_to_account_id').references(() => accounts.id, {
			onDelete: 'restrict'
		}),
		amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
```

Also add an index on the new column for the balance-computation aggregate:

In the index list at the bottom of the table definition:

```typescript
	(t) => [
		index('tx_user_idx').on(t.userId),
		index('tx_user_occurred_idx').on(t.userId, t.occurredAt),
		index('tx_account_idx').on(t.accountId),
		index('tx_transfer_to_account_idx').on(t.transferToAccountId)
	]
```

- [ ] **Step 2: Push to D1**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run db:push -- --force
```

`drizzle-kit push --force` is needed because the prompt is interactive otherwise. Adding a nullable column is non-destructive (no data loss), so `--force` is safe here.

- [ ] **Step 3: Verify column added**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler d1 execute mavlo --remote --command "PRAGMA table_info('transactions')"
```

Expected: includes `transfer_to_account_id` (TEXT, nullable). Other columns unchanged.

- [ ] **Step 4: Type-check**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/server/db/schema" || echo "no errors in schema"
```

Expected: no errors. The Drizzle `transactions.transferToAccountId` field is now typed.

- [ ] **Step 5: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/server/db/schema.ts
git commit -m "feat(db): add transfer_to_account_id column for transfers"
```

---

## Task 2: Update Test Fixture for Transfer Column

**Files:**
- Modify: `<NEW_REPO>/src/lib/server/db/test-fixtures.ts`

The in-memory `transactions` table SQL needs the new column. Existing tests (which don't use transfer) keep passing because the new column is nullable.

- [ ] **Step 1: Update `transactionsTableSql` in `test-fixtures.ts`**

```typescript
const transactionsTableSql = `
	CREATE TABLE transactions (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
		category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
		transfer_to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
		amount_cents INTEGER NOT NULL,
		kind TEXT NOT NULL,
		note TEXT,
		occurred_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;
```

The column order matters for raw INSERTs — they use positional params. Existing tests in `accounts.test.ts`, `categories.test.ts`, `transactions.test.ts`, `balances.test.ts` all use either:
- Repository functions (column order doesn't matter)
- Or raw `INSERT INTO transactions VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)` — 9 placeholders for the old 9-column shape

After this change, that raw INSERT now needs 10 placeholders to include the new `transfer_to_account_id` (NULL for non-transfer rows). **Update those raw INSERTs in P3T3 + P3T4 tests** if they exist:

- [ ] **Step 2: Update raw INSERTs in `src/lib/server/repositories/transactions.test.ts`**

The test file from P3T3 doesn't insert raw transactions — it uses `createTransaction()`. So nothing to change there.

- [ ] **Step 3: Update raw INSERTs in `src/lib/server/repositories/balances.test.ts`**

The test file from P3T4 has `insertTx()` helper using:

```sql
INSERT INTO transactions VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)
```

That's 9 placeholders for: id, user_id, account_id, category_id (NULL), amount_cents, kind, note (NULL), occurred_at, created_at, updated_at. The schema added `transfer_to_account_id` between `category_id` and `amount_cents`. New shape needs 10 placeholders:

```sql
INSERT INTO transactions VALUES (?, ?, ?, NULL, NULL, ?, ?, NULL, ?, ?, ?)
```

Order now: id, user_id, account_id, category_id (NULL), transfer_to_account_id (NULL), amount_cents, kind, note (NULL), occurred_at, created_at, updated_at.

Update the helper inside `balances.test.ts`:

```typescript
const insertTx = (
	h: TestDbHandle,
	args: { id: string; accountId: string; amount: number; kind: 'income' | 'expense' }
) => {
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO transactions VALUES (?, ?, ?, NULL, NULL, ?, ?, NULL, ?, ?, ?)')
		.run(args.id, h.userId, args.accountId, args.amount, args.kind, now, now, now);
};
```

Same fix in the cross-user test inside `balances.test.ts` (the inline raw INSERT).

- [ ] **Step 4: Run all tests**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: all 44 tests still pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/server/db/test-fixtures.ts src/lib/server/repositories/balances.test.ts
git commit -m "feat(test): add transfer_to_account_id column to fixture; fix raw INSERTs"
```

---

## Task 3: Update Validation for Transfer Kind

**Files:**
- Modify: `<NEW_REPO>/src/lib/validation/transaction.ts`
- Modify: `<NEW_REPO>/src/lib/validation/transaction.test.ts`

Allow `transfer` kind. When kind=transfer, require `transferToAccountId` distinct from `accountId`.

- [ ] **Step 1: Update test**

Add new test cases to `src/lib/validation/transaction.test.ts`:

```typescript
	it('transfer kind is now allowed and requires transferToAccountId', () => {
		expect(
			transactionCreateSchema.safeParse({ ...validBase, kind: 'transfer' }).success
		).toBe(false); // missing transferToAccountId
		expect(
			transactionCreateSchema.safeParse({
				...validBase,
				kind: 'transfer',
				transferToAccountId: 'acc2'
			}).success
		).toBe(true);
	});

	it('transfer rejects same source and destination', () => {
		expect(
			transactionCreateSchema.safeParse({
				...validBase,
				kind: 'transfer',
				transferToAccountId: validBase.accountId
			}).success
		).toBe(false);
	});

	it('income/expense ignore transferToAccountId field if present', () => {
		const r = transactionCreateSchema.safeParse({
			...validBase,
			kind: 'expense',
			transferToAccountId: 'acc2' // should be stripped/ignored for non-transfer kind
		});
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.transferToAccountId).toBeUndefined();
	});
```

The first existing test (`'create requires accountId, amountCents > 0, kind, occurredAt'`) currently asserts `kind: 'transfer'` → fails. **Remove that line** since transfer is now valid; the test below covers the new behavior. Update that test to:

```typescript
	it('create requires accountId, amountCents > 0, kind, occurredAt', () => {
		expect(transactionCreateSchema.safeParse(validBase).success).toBe(true);
		expect(transactionCreateSchema.safeParse({ ...validBase, accountId: '' }).success).toBe(false);
		expect(transactionCreateSchema.safeParse({ ...validBase, amountCents: 0 }).success).toBe(false);
		expect(transactionCreateSchema.safeParse({ ...validBase, amountCents: -100 }).success).toBe(false);
		expect(transactionCreateSchema.safeParse({ ...validBase, kind: 'invalid' }).success).toBe(false);
	});
```

- [ ] **Step 2: Run test (expect FAIL on the new cases)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 3: Update `src/lib/validation/transaction.ts`**

```typescript
import { z } from 'zod';

export const transactionKindEnum = z.enum(['income', 'expense', 'transfer']);

const emptyToUndefined = z.literal('').transform(() => undefined);

const baseTransactionFields = {
	accountId: z.string().min(1, 'Account required'),
	categoryId: z.string().min(1).optional().or(emptyToUndefined),
	transferToAccountId: z.string().min(1).optional().or(emptyToUndefined),
	amountCents: z.coerce.number().int().positive('Amount must be positive'),
	kind: transactionKindEnum,
	note: z.string().trim().max(200).optional().or(emptyToUndefined),
	occurredAt: z.coerce.number().int().positive('Date required')
};

const enforceTransferRules = <T extends { kind: string; accountId: string; transferToAccountId?: string }>(
	val: T,
	ctx: z.RefinementCtx
) => {
	if (val.kind === 'transfer') {
		if (!val.transferToAccountId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['transferToAccountId'],
				message: 'Destination account required for transfer'
			});
			return;
		}
		if (val.transferToAccountId === val.accountId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['transferToAccountId'],
				message: 'Source and destination must differ'
			});
		}
	}
};

const stripTransferTarget = <T extends { kind: string; transferToAccountId?: string }>(val: T): T => {
	if (val.kind !== 'transfer') {
		return { ...val, transferToAccountId: undefined };
	}
	return val;
};

export const transactionCreateSchema = z
	.object(baseTransactionFields)
	.transform(stripTransferTarget)
	.superRefine(enforceTransferRules);

export const transactionUpdateSchema = z
	.object({ ...baseTransactionFields, id: z.string().min(1, 'Id required') })
	.transform(stripTransferTarget)
	.superRefine(enforceTransferRules);

export const transactionIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export const transactionListFilterSchema = z.object({
	fromMs: z.coerce.number().int().optional(),
	toMs: z.coerce.number().int().optional(),
	accountId: z.string().min(1).optional().or(emptyToUndefined),
	categoryId: z.string().min(1).optional().or(emptyToUndefined),
	kind: transactionKindEnum.optional()
});

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionListFilter = z.infer<typeof transactionListFilterSchema>;
export type TransactionKind = z.infer<typeof transactionKindEnum>;
```

If zod 4's `superRefine` API differs, look at the project's existing zod usage and adapt (the older form takes `(data, ctx) => ...`).

If TypeScript complains about the inferred type because of `transform`, the `TransactionCreateInput` type may have `transferToAccountId?: string | undefined` rather than including it always — that's fine.

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 5: Type-check + Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/validation/transaction" || echo "no errors"
git add src/lib/validation/transaction.ts src/lib/validation/transaction.test.ts
git commit -m "feat(validation): allow transfer kind with transferToAccountId requirement"
```

---

## Task 4: Update Transactions Repository for Transfers

**Files:**
- Modify: `<NEW_REPO>/src/lib/server/repositories/transactions.ts`
- Modify: `<NEW_REPO>/src/lib/server/repositories/transactions.test.ts`

Persist `transferToAccountId` in create + update. Add tests.

- [ ] **Step 1: Add tests for transfer behavior**

Append to `src/lib/server/repositories/transactions.test.ts`:

```typescript
	it('createTransaction persists transferToAccountId for transfers', async () => {
		// create a second account in the same user scope
		const now = Date.now();
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
			.run('acc-bank', h.userId, 'Bank', 'bank', 'IDR', 0, now, now);

		const t = await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			transferToAccountId: 'acc-bank',
			amountCents: 5000,
			kind: 'transfer',
			occurredAt: Date.now()
		});
		expect(t.transferToAccountId).toBe('acc-bank');

		const fetched = await getTransaction(h.db, h.userId, t.id);
		expect(fetched?.transferToAccountId).toBe('acc-bank');
		expect(fetched?.kind).toBe('transfer');
	});

	it('updateTransaction can change transferToAccountId', async () => {
		const now = Date.now();
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
			.run('acc-bank', h.userId, 'Bank', 'bank', 'IDR', 0, now, now);
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
			.run('acc-wallet', h.userId, 'Wallet', 'wallet', 'IDR', 0, now, now);

		const t = await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			transferToAccountId: 'acc-bank',
			amountCents: 5000,
			kind: 'transfer',
			occurredAt: Date.now()
		});

		const updated = await updateTransaction(h.db, h.userId, {
			id: t.id,
			accountId: 'acc1',
			transferToAccountId: 'acc-wallet',
			amountCents: 5000,
			kind: 'transfer',
			occurredAt: Date.now()
		});
		expect(updated?.transferToAccountId).toBe('acc-wallet');
	});
```

- [ ] **Step 2: Update `src/lib/server/repositories/transactions.ts`**

Add `transferToAccountId` to insert/update value sets:

```typescript
export async function createTransaction(
	db: Db,
	userId: string,
	input: TransactionCreateInput
) {
	const [row] = await db
		.insert(transactions)
		.values({
			userId,
			accountId: input.accountId,
			categoryId: input.categoryId ?? null,
			transferToAccountId: input.transferToAccountId ?? null,
			amountCents: input.amountCents,
			kind: input.kind,
			note: input.note ?? null,
			occurredAt: input.occurredAt
		})
		.returning();
	return row;
}

export async function updateTransaction(
	db: Db,
	userId: string,
	input: TransactionUpdateInput
) {
	const [row] = await db
		.update(transactions)
		.set({
			accountId: input.accountId,
			categoryId: input.categoryId ?? null,
			transferToAccountId: input.transferToAccountId ?? null,
			amountCents: input.amountCents,
			kind: input.kind,
			note: input.note ?? null,
			occurredAt: input.occurredAt,
			updatedAt: Date.now()
		})
		.where(and(eq(transactions.userId, userId), eq(transactions.id, input.id)))
		.returning();
	return row ?? null;
}
```

`listTransactions` and `getTransaction` need no changes — `select()` returns the new column automatically.

- [ ] **Step 3: Run test (expect PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 4: Type-check + Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/server/repositories/transactions" || echo "no errors"
git add src/lib/server/repositories/transactions.ts src/lib/server/repositories/transactions.test.ts
git commit -m "feat(repo): persist transferToAccountId on create/update"
```

---

## Task 5: Replace Balance Compute With Transfer-Aware JS Fold

**Files:**
- Modify: `<NEW_REPO>/src/lib/server/repositories/balances.ts`
- Modify: `<NEW_REPO>/src/lib/server/repositories/balances.test.ts`

The current SQL aggregate doesn't account for transfers. Replace with a JS-fold approach: load accounts + all user transactions, compute balances by reducing over them. Simpler than OR-JOIN gymnastics.

Cost: loads all transactions. For personal-finance scale (likely <10k rows per user) D1 reads are cheap. Phase 5 can optimize if needed.

- [ ] **Step 1: Add tests for transfer behavior**

Append to `src/lib/server/repositories/balances.test.ts`:

```typescript
	it('transfer kind subtracts from src and adds to dest within same user', async () => {
		const now = Date.now();
		h.sqlite
			.prepare('INSERT INTO transactions VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?)')
			.run('t-transfer', h.userId, 'acc1', 'acc2', 30000, 'transfer', now, now, now);

		const map = await computeAccountBalances(h.db, h.userId);
		expect(map.get('acc1')).toBe(70000); // 100000 - 30000
		expect(map.get('acc2')).toBe(530000); // 500000 + 30000
	});

	it('transfer to other-user account is impossible (validated upstream); cross-user transactions excluded from compute', async () => {
		// Verify the compute simply ignores cross-user rows even if they reference our account_id
		const now = Date.now();
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
			.run('acc-other', h.otherUserId, 'Other', 'cash', 'IDR', 0, now, now);
		// This would never happen via the validated repo (transferToAccountId must be own), but in raw SQL we can simulate:
		h.sqlite
			.prepare('INSERT INTO transactions VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?)')
			.run('t-x', h.otherUserId, 'acc-other', 'acc1', 99999, 'transfer', now, now, now);

		const map = await computeAccountBalances(h.db, h.userId);
		// Our acc1 must NOT receive the cross-user transfer
		expect(map.get('acc1')).toBe(100000);
	});
```

The 11-placeholder INSERT shape: id, user_id, account_id, category_id (NULL), transfer_to_account_id, amount_cents, kind, note (NULL), occurred_at, created_at, updated_at.

- [ ] **Step 2: Replace `src/lib/server/repositories/balances.ts`**

```typescript
import { eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { accounts, transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

/**
 * Returns Map<accountId, balanceCents>. Includes only accounts owned by `userId`.
 *
 * Balance per account = initial_balance_cents
 *   + SUM(income.amount_cents WHERE account_id = this)
 *   - SUM(expense.amount_cents WHERE account_id = this)
 *   - SUM(transfer.amount_cents WHERE account_id = this)        // outgoing transfers
 *   + SUM(transfer.amount_cents WHERE transfer_to_account_id = this) // incoming transfers
 *
 * Computed via JS fold over all user transactions (cheaper than dual-JOIN aggregate; correct for transfers).
 */
export async function computeAccountBalances(
	db: Db,
	userId: string
): Promise<Map<string, number>> {
	const ownedAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
	const ownTransactions = await db
		.select()
		.from(transactions)
		.where(eq(transactions.userId, userId));

	const balances = new Map<string, number>();
	for (const a of ownedAccounts) {
		balances.set(a.id, a.initialBalanceCents);
	}

	for (const t of ownTransactions) {
		// Defensive: only act on accounts owned by this user. Cross-user data shouldn't reach here
		// (we filtered transactions.userId), but transferToAccountId could in theory point at an
		// account no longer in `balances` (e.g., archived from compute). Skip if so.
		if (!balances.has(t.accountId)) continue;

		if (t.kind === 'income') {
			balances.set(t.accountId, balances.get(t.accountId)! + t.amountCents);
		} else if (t.kind === 'expense') {
			balances.set(t.accountId, balances.get(t.accountId)! - t.amountCents);
		} else if (t.kind === 'transfer' && t.transferToAccountId) {
			balances.set(t.accountId, balances.get(t.accountId)! - t.amountCents);
			if (balances.has(t.transferToAccountId)) {
				balances.set(
					t.transferToAccountId,
					balances.get(t.transferToAccountId)! + t.amountCents
				);
			}
		}
	}

	return balances;
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: all 44 prior tests still pass + 2 new transfer tests pass = 46+.

- [ ] **Step 4: Type-check + Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/server/repositories/balances" || echo "no errors"
git add src/lib/server/repositories/balances.ts src/lib/server/repositories/balances.test.ts
git commit -m "feat(balances): JS-fold computation handles transfers (src out, dest in)"
```

---

## Task 6: Update Transactions Page UI for Transfers

**Files:**
- Modify: `<NEW_REPO>/src/routes/(app)/transactions/+page.server.ts`
- Modify: `<NEW_REPO>/src/routes/(app)/transactions/+page.svelte`

Server `actions.create` + `actions.update` already pipe `transferToAccountId` via `formObject(fd)` (because `Object.fromEntries(fd.entries())` includes any field present in the form). No server changes needed unless the action fails to receive it — but it should because the validator already accepts the field.

UI changes:
- Filter bar: add `transfer` to the kind dropdown
- Create + edit dialogs: add `transfer` option to kind select + a conditional `transferToAccountId` picker (visible when kind=transfer)
- Table: render transfer rows specially — show "Transfer" kind in muted color, show `account → transferToAccount` in account column, sign-less amount

- [ ] **Step 1: Update `src/routes/(app)/transactions/+page.svelte`**

Top of `<script>`: add a tracked dialog kind state for conditional rendering.

```typescript
	let createKind = $state<'income' | 'expense' | 'transfer'>('expense');
	let editKind = $state<'income' | 'expense' | 'transfer'>('expense');
```

Reset `createKind` whenever the create dialog opens (on click of the "New transaction" button — set `createKind = 'expense'; createOpen = true;`).

Reset `editKind = editTarget.kind` inside `openEdit`:

```typescript
	const openEdit = (t: TxRow) => {
		editTarget = t;
		editKind = t.kind;
		editOpen = true;
	};
```

Filter bar kind select gains a transfer option:

```svelte
				<select
					id="filter-kind"
					name="kind"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value="">All</option>
					<option value="income" selected={data.filter.kind === 'income'}>Income</option>
					<option value="expense" selected={data.filter.kind === 'expense'}>Expense</option>
					<option value="transfer" selected={data.filter.kind === 'transfer'}>Transfer</option>
				</select>
```

Table row — modify the Kind column to color transfer differently and the Account column to show src→dest. Replace the existing per-row markup:

```svelte
				{#each data.transactions as tx (tx.id)}
					{@const acc = accountById.get(tx.accountId)}
					{@const destAcc = tx.transferToAccountId ? accountById.get(tx.transferToAccountId) : null}
					{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
					<Table.Row>
						<Table.Cell>{formatDate(tx.occurredAt)}</Table.Cell>
						<Table.Cell class="capitalize">
							{#if tx.kind === 'income'}
								<span class="text-emerald-600 dark:text-emerald-400">income</span>
							{:else if tx.kind === 'expense'}
								<span class="text-rose-600 dark:text-rose-400">expense</span>
							{:else}
								<span class="text-blue-600 dark:text-blue-400">transfer</span>
							{/if}
						</Table.Cell>
						<Table.Cell>
							{#if tx.kind === 'transfer' && destAcc}
								<span class="text-xs">{acc?.name ?? '—'} → {destAcc.name}</span>
							{:else}
								{acc?.name ?? '—'}
							{/if}
						</Table.Cell>
						<Table.Cell>
							{#if tx.kind === 'transfer'}
								<span class="text-muted-foreground text-xs">—</span>
							{:else}
								{cat?.name ?? '—'}
							{/if}
						</Table.Cell>
						<Table.Cell class="max-w-xs truncate">{tx.note ?? ''}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{#if tx.kind === 'expense'}
								<span class="text-rose-600 dark:text-rose-400">−{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
							{:else if tx.kind === 'income'}
								<span class="text-emerald-600 dark:text-emerald-400">+{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
							{:else}
								<span class="text-blue-600 dark:text-blue-400">{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
							{/if}
						</Table.Cell>
						... (dropdown menu unchanged) ...
					</Table.Row>
				{:else}
					...
				{/each}
```

Create dialog — replace the existing kind+amount grid + the accountId/categoryId blocks with:

```svelte
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="tx-c-kind">Kind</Label>
					<select
						id="tx-c-kind"
						name="kind"
						required
						bind:value={createKind}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="expense">Expense</option>
						<option value="income">Income</option>
						<option value="transfer">Transfer</option>
					</select>
				</div>
				<div class="space-y-1">
					<Label for="tx-c-amount">Amount (cents)</Label>
					<Input id="tx-c-amount" type="number" name="amountCents" min="1" required />
				</div>
			</div>
			<div class="space-y-1">
				<Label for="tx-c-account">{createKind === 'transfer' ? 'From account' : 'Account'}</Label>
				<select
					id="tx-c-account"
					name="accountId"
					required
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					{#each data.accounts as a}
						<option value={a.id}>{a.name} ({a.currency})</option>
					{/each}
				</select>
			</div>
			{#if createKind === 'transfer'}
				<div class="space-y-1">
					<Label for="tx-c-to">To account</Label>
					<select
						id="tx-c-to"
						name="transferToAccountId"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each data.accounts as a}
							<option value={a.id}>{a.name} ({a.currency})</option>
						{/each}
					</select>
				</div>
			{:else}
				<div class="space-y-1">
					<Label for="tx-c-category">Category (optional)</Label>
					<select
						id="tx-c-category"
						name="categoryId"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="">None</option>
						<optgroup label="Expense">
							{#each expenseCategories as c}
								<option value={c.id}>{c.name}</option>
							{/each}
						</optgroup>
						<optgroup label="Income">
							{#each incomeCategories as c}
								<option value={c.id}>{c.name}</option>
							{/each}
						</optgroup>
					</select>
				</div>
			{/if}
			... (date + note grid unchanged) ...
```

Apply equivalent changes to the edit dialog using `editKind` for the conditional + `editTarget.transferToAccountId` for the prefill:

```svelte
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="tx-e-kind">Kind</Label>
						<select
							id="tx-e-kind"
							name="kind"
							required
							bind:value={editKind}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="expense">Expense</option>
							<option value="income">Income</option>
							<option value="transfer">Transfer</option>
						</select>
					</div>
					...
				</div>
				...
				{#if editKind === 'transfer'}
					<div class="space-y-1">
						<Label for="tx-e-to">To account</Label>
						<select
							id="tx-e-to"
							name="transferToAccountId"
							required
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							{#each data.accounts as a}
								<option value={a.id} selected={a.id === editTarget.transferToAccountId}>
									{a.name} ({a.currency})
								</option>
							{/each}
						</select>
					</div>
				{:else}
					<div class="space-y-1">
						<Label for="tx-e-category">Category (optional)</Label>
						... (existing category select)
					</div>
				{/if}
```

Update the "New transaction" button click handler to reset kind:

```svelte
	<Button onclick={() => { createKind = 'expense'; createOpen = true; }}>
		<Plus class="size-4 mr-1" /> New transaction
	</Button>
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)/transactions" || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(app)/transactions/"
git commit -m "feat(transactions): add transfer kind with conditional dest account picker"
```

---

## Task 7: Build + Smoke + Deploy

- [ ] **Step 1: Build**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run build 2>&1 | tail -30
```

- [ ] **Step 2: Local preview smoke**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run preview > /tmp/mavlo-preview.log 2>&1 &
PREVIEW_PID=$!
sleep 8
echo "=== /transactions ==="
curl -sI http://localhost:4173/transactions | head -5
echo "=== /api/health ==="
curl -s http://localhost:4173/api/health
kill $PREVIEW_PID 2>/dev/null
sleep 2
```

- [ ] **Step 3: Deploy**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler deploy 2>&1 | tail -30
```

- [ ] **Step 4: Deployed smoke**

```bash
curl -s https://mavlo.wahyucandratama.workers.dev/api/health
curl -sI https://mavlo.wahyucandratama.workers.dev/transactions | head -5
```

- [ ] **Step 5: Manual e2e (user-run)**

Sign in → /accounts: confirm at least 2 accounts exist → /transactions:
- Create a transfer from acc-A to acc-B for 100000 cents (Rp 1.000)
- Confirm row appears with `acc-A → acc-B` and `Rp 1.000` in blue
- Visit /dashboard: net worth unchanged (transfers move money internally), this month spending unchanged, recent activity shows the transfer

---

## Phase 4 Done When

- [ ] Schema includes `transfer_to_account_id` column with index
- [ ] Validators accept `transfer` kind, require non-self destination
- [ ] Repo persists/retrieves `transferToAccountId`
- [ ] Balance compute correctly handles transfers (src debited, dest credited)
- [ ] Transactions UI offers transfer kind with conditional dest picker
- [ ] List view shows transfer with `src → dest` + neutral coloring
- [ ] Tests pass; build clean; deploy clean
- [ ] Manual e2e: net worth stable across transfers (proves both sides applied)

## Out of Scope for Phase 4

- Transfer fees (e.g., wire fees) — would require splitting a transfer into transfer + fee txn
- Cross-currency transfers with conversion rates (keep src+dest currencies equal for now; UI doesn't enforce this — Phase 5 may add)
- Recurring transfers, scheduling
