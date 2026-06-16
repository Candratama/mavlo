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
