import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './auth.schema';

const cuid = () => text().notNull().$defaultFn(() => createId());
const userIdFk = () =>
	text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' });
const epochMsNow = (name: string) =>
	integer(name, { mode: 'number' })
		.notNull()
		.$defaultFn(() => Date.now());

export const accounts = sqliteTable(
	'accounts',
	{
		id: cuid().primaryKey(),
		userId: userIdFk(),
		name: text('name').notNull(),
		type: text('type', { enum: ['cash', 'bank', 'credit', 'wallet', 'other'] }).notNull(),
		currency: text('currency').notNull().default('IDR'),
		initialBalanceCents: integer('initial_balance_cents', { mode: 'number' }).notNull().default(0),
		color: text('color'),
		icon: text('icon'),
		archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
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
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
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
		transferToAccountId: text('transfer_to_account_id').references(() => accounts.id, {
			onDelete: 'restrict'
		}),
		amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
		kind: text('kind', { enum: ['income', 'expense', 'transfer'] }).notNull(),
		note: text('note'),
		occurredAt: integer('occurred_at', { mode: 'number' }).notNull(),
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
	},
	(t) => [
		index('tx_user_idx').on(t.userId),
		index('tx_user_occurred_idx').on(t.userId, t.occurredAt),
		index('tx_account_idx').on(t.accountId),
		index('tx_transfer_to_account_idx').on(t.transferToAccountId)
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
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
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
	monthStartDay: integer('month_start_day', { mode: 'number' }).notNull().default(1),
	createdAt: epochMsNow('created_at'),
	updatedAt: epochMsNow('updated_at')
});

export * from './auth.schema';
