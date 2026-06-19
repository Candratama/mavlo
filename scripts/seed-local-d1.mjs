// Seed this workspace's local D1 from a production dump (.conductor/prod-seed.sql).
//
// Why not `wrangler d1 execute --file`? Wrangler runs each statement separately, so
// `PRAGMA defer_foreign_keys` does not persist — a child-table INSERT (e.g. auth_accounts
// -> users) runs before its parent table exists and the whole import rolls back with
// "no such table: users". Loading the dump in a single better-sqlite3 transaction with
// foreign keys OFF avoids the ordering problem entirely.
//
// Run order matters: the local D1 sqlite must already exist (created by a prior
// `wrangler d1 execute --local`) so we write to miniflare's canonical file — the same
// one the dev server reads.

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DUMP = '.conductor/prod-seed.sql';
const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

if (!fs.existsSync(DUMP)) {
	console.error(`seed: ${DUMP} not found — skipping`);
	process.exit(0);
}

const file = fs
	.readdirSync(D1_DIR)
	.find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');

if (!file) {
	console.error(`seed: no local D1 sqlite in ${D1_DIR} — skipping`);
	process.exit(0);
}

const db = new Database(path.join(D1_DIR, file));
db.pragma('foreign_keys = OFF');
db.exec(fs.readFileSync(DUMP, 'utf8'));
db.close();
console.log(`seed: imported prod data into local D1 (${file})`);
