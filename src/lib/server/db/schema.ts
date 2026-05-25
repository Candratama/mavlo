import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './auth.schema';

const cuid = () =>
	text()
		.notNull()
		.$defaultFn(() => createId());
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
		type: text('type', {
			enum: ['cash', 'bank', 'credit', 'wallet', 'savings', 'other']
		}).notNull(),
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
		expenseType: text('expense_type', { enum: ['fixed', 'variable'] })
			.notNull()
			.default('variable'),
		color: text('color'),
		icon: text('icon'),
		archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
		sortOrder: integer('sort_order', { mode: 'number' }).notNull().default(0),
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
		debtId: text('debt_id').references(() => debts.id, { onDelete: 'set null' }),
		amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
		kind: text('kind', { enum: ['income', 'expense', 'transfer'] }).notNull(),
		note: text('note'),
		occurredAt: integer('occurred_at', { mode: 'number' }).notNull(),
		isSeed: integer('is_seed', { mode: 'boolean' }).notNull().default(false),
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
	},
	(t) => [
		index('tx_user_idx').on(t.userId),
		index('tx_user_occurred_idx').on(t.userId, t.occurredAt),
		index('tx_account_idx').on(t.accountId),
		index('tx_transfer_to_account_idx').on(t.transferToAccountId),
		index('tx_debt_idx').on(t.debtId)
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
		carryoverDeficitCents: integer('carryover_deficit_cents', { mode: 'number' })
			.notNull()
			.default(0),
		carryoverFromPeriod: text('carryover_from_period'),
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
	},
	(t) => [index('budgets_user_period_idx').on(t.userId, t.periodMonth)]
);

export const budgetSubsidies = sqliteTable(
	'budget_subsidies',
	{
		id: cuid().primaryKey(),
		userId: userIdFk(),
		periodMonth: text('period_month').notNull(),
		fromBudgetId: text('from_budget_id')
			.notNull()
			.references(() => budgets.id, { onDelete: 'cascade' }),
		toBudgetId: text('to_budget_id')
			.notNull()
			.references(() => budgets.id, { onDelete: 'cascade' }),
		amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
		note: text('note'),
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
	},
	(t) => [
		index('subsidies_user_period_idx').on(t.userId, t.periodMonth),
		index('subsidies_from_idx').on(t.fromBudgetId),
		index('subsidies_to_idx').on(t.toBudgetId)
	]
);

export const debts = sqliteTable(
	'debts',
	{
		id: cuid().primaryKey(),
		userId: userIdFk(),
		name: text('name').notNull(),
		type: text('type', {
			enum: ['credit_card', 'kta', 'kpr', 'auto', 'bnpl', 'pinjol', 'informal', 'other']
		}).notNull(),
		lender: text('lender'),
		principalCents: integer('principal_cents', { mode: 'number' }).notNull(),
		currentBalanceCents: integer('current_balance_cents', { mode: 'number' }).notNull(),
		interestRatePct: integer('interest_rate_pct', { mode: 'number' }).notNull().default(0),
		minimumPaymentCents: integer('minimum_payment_cents', { mode: 'number' }).notNull().default(0),
		dueDay: integer('due_day', { mode: 'number' }),
		startDate: integer('start_date', { mode: 'number' }).notNull(),
		maturityDate: integer('maturity_date', { mode: 'number' }),
		status: text('status', { enum: ['active', 'paid_off', 'in_arrears'] })
			.notNull()
			.default('active'),
		accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
		direction: text('direction', { enum: ['borrowed', 'lent'] })
			.notNull()
			.default('borrowed'),
		note: text('note'),
		interestAppliedFromPeriod: text('interest_applied_from_period'),
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
	},
	(t) => [
		index('debts_user_idx').on(t.userId),
		index('debts_user_status_idx').on(t.userId, t.status)
	]
);

export const userPreferences = sqliteTable('user_preferences', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	currency: text('currency').notNull().default('IDR'),
	locale: text('locale').notNull().default('id-ID'),
	timezone: text('timezone').notNull().default('Asia/Jakarta'),
	theme: text('theme', { enum: ['light', 'dark', 'system'] })
		.notNull()
		.default('system'),
	weekStartsOn: integer('week_starts_on', { mode: 'number' }).notNull().default(1),
	monthStartDay: integer('month_start_day', { mode: 'number' }).notNull().default(1),
	createdAt: epochMsNow('created_at'),
	updatedAt: epochMsNow('updated_at')
});

export * from './auth.schema';
