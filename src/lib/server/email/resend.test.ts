import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from './resend';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

describe('sendEmail', () => {
	it('POSTs to Resend with bearer auth and payload', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 })
		);

		await sendEmail({
			apiKey: 'test_key',
			from: 'Mavlo <noreply@mavlo.app>',
			to: 'user@example.com',
			subject: 'Hi',
			text: 'Body'
		});

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.resend.com/emails');
		expect(init.method).toBe('POST');
		expect(init.headers.Authorization).toBe('Bearer test_key');
		const body = JSON.parse(init.body);
		expect(body).toEqual({
			from: 'Mavlo <noreply@mavlo.app>',
			to: 'user@example.com',
			subject: 'Hi',
			text: 'Body'
		});
	});

	it('throws on non-2xx response', async () => {
		fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
		await expect(
			sendEmail({
				apiKey: 'k',
				from: 'a',
				to: 'b',
				subject: 's',
				text: 't'
			})
		).rejects.toThrow(/resend.*429/i);
	});
});
