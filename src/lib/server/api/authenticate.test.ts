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
