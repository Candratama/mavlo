import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { createApiKey, listApiKeys, revokeApiKey, authenticateApiKey } from './api-keys';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['api_keys'] });
});

describe('api-keys repository', () => {
	it('createApiKey returns plaintext once and a public key with no keyHash', async () => {
		const result = await createApiKey(h.db, h.userId, 'My Key');
		expect(result.plaintext.startsWith('mavlo_sk_')).toBe(true);
		expect(result.key.name).toBe('My Key');
		expect(result.key).not.toHaveProperty('keyHash');
		const keys = await listApiKeys(h.db, h.userId);
		expect(keys).toHaveLength(1);
		expect(keys[0]).not.toHaveProperty('keyHash');
		expect(keys[0].prefix).toBe(result.plaintext.slice(0, 16));
	});

	it('authenticateApiKey resolves the owning userId for a valid key and touches lastUsedAt', async () => {
		const { key, plaintext } = await createApiKey(h.db, h.userId, 'k');
		expect(await authenticateApiKey(h.db, plaintext)).toBe(h.userId);
		const stored = h.sqlite
			.prepare('SELECT last_used_at FROM api_keys WHERE id = ?')
			.get(key.id) as { last_used_at: number | null };
		expect(stored.last_used_at).not.toBeNull();
	});

	it('authenticateApiKey returns null for an unknown key', async () => {
		expect(await authenticateApiKey(h.db, 'mavlo_sk_nope')).toBeNull();
	});

	it('authenticateApiKey returns null for a revoked key', async () => {
		const { key, plaintext } = await createApiKey(h.db, h.userId, 'k');
		await revokeApiKey(h.db, h.userId, key.id);
		expect(await authenticateApiKey(h.db, plaintext)).toBeNull();
	});

	it('authenticateApiKey returns null for a demo user', async () => {
		const { plaintext } = await createApiKey(h.db, h.userId, 'k');
		h.sqlite.prepare('UPDATE users SET is_demo = 1 WHERE id = ?').run(h.userId);
		expect(await authenticateApiKey(h.db, plaintext)).toBeNull();
	});

	it('revokeApiKey is scoped to the owner', async () => {
		const { key } = await createApiKey(h.db, h.userId, 'k');
		expect(await revokeApiKey(h.db, h.otherUserId, key.id)).toBeNull();
		expect(await revokeApiKey(h.db, h.userId, key.id)).not.toBeNull();
	});

	it('listApiKeys returns only the owner keys', async () => {
		await createApiKey(h.db, h.userId, 'a');
		await createApiKey(h.db, h.otherUserId, 'b');
		expect(await listApiKeys(h.db, h.userId)).toHaveLength(1);
	});
});
