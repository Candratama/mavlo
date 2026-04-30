import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const usersTableSql = `
	CREATE TABLE users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		email_verified INTEGER DEFAULT 0 NOT NULL,
		image TEXT,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

const accountsTableSql = `
	CREATE TABLE accounts (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		currency TEXT NOT NULL DEFAULT 'IDR',
		initial_balance_cents INTEGER NOT NULL DEFAULT 0,
		color TEXT,
		icon TEXT,
		archived INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

const categoriesTableSql = `
	CREATE TABLE categories (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		kind TEXT NOT NULL,
		color TEXT,
		icon TEXT,
		archived INTEGER NOT NULL DEFAULT 0,
		sort_order INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

const transactionsTableSql = `
	CREATE TABLE transactions (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
		category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
		amount_cents INTEGER NOT NULL,
		kind TEXT NOT NULL,
		note TEXT,
		occurred_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		transfer_to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
		is_seed INTEGER NOT NULL DEFAULT 0
	)
`;

const budgetsTableSql = `
	CREATE TABLE budgets (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
		period_month TEXT NOT NULL,
		limit_cents INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

export interface TestDbHandle {
	db: BetterSQLite3Database<typeof schema>;
	userId: string;
	otherUserId: string;
	sqlite: Database.Database;
}

export function createTestDb(opts: {
	tables: ('accounts' | 'categories' | 'transactions' | 'budgets')[];
}): TestDbHandle {
	const sqlite = new Database(':memory:');
	const db = drizzle(sqlite, { schema });

	sqlite.prepare(usersTableSql).run();
	if (opts.tables.includes('accounts')) sqlite.prepare(accountsTableSql).run();
	if (opts.tables.includes('categories')) sqlite.prepare(categoriesTableSql).run();
	if (opts.tables.includes('transactions')) sqlite.prepare(transactionsTableSql).run();
	if (opts.tables.includes('budgets')) sqlite.prepare(budgetsTableSql).run();

	const now = Date.now();
	const userId = 'user_test_1';
	const otherUserId = 'user_test_2';
	sqlite
		.prepare('INSERT INTO users VALUES (?, ?, ?, 0, NULL, ?, ?)')
		.run(userId, 'A', 'a@b.co', now, now);
	sqlite
		.prepare('INSERT INTO users VALUES (?, ?, ?, 0, NULL, ?, ?)')
		.run(otherUserId, 'B', 'b@b.co', now, now);

	return { db, userId, otherUserId, sqlite };
}
