-- One-time: register existing applied migrations with wrangler's tracker.
-- Run once against remote D1 before enabling auto-deploy:
--   npx wrangler d1 execute mavlo --remote --file=scripts/bootstrap-d1-migrations.sql

CREATE TABLE IF NOT EXISTS d1_migrations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT UNIQUE,
	applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES
	('0000_adorable_serpent_society.sql'),
	('0001_yielding_speed.sql'),
	('0002_accounts_sort_order.sql'),
	('0003_narrow_azazel.sql'),
	('0004_add_username.sql');
