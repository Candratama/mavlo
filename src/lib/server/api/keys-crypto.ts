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
