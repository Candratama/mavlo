import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from './brevo';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

describe('sendEmail', () => {
	it('POSTs to Brevo with api-key header and parsed sender', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ messageId: 'msg_123' }), { status: 201 })
		);

		await sendEmail({
			apiKey: 'test_key',
			from: 'Mavlo <noreply@mavlo.web.id>',
			to: 'user@example.com',
			subject: 'Hi',
			text: 'Body'
		});

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.brevo.com/v3/smtp/email');
		expect(init.method).toBe('POST');
		expect(init.headers['api-key']).toBe('test_key');
		const body = JSON.parse(init.body);
		expect(body).toEqual({
			sender: { name: 'Mavlo', email: 'noreply@mavlo.web.id' },
			to: [{ email: 'user@example.com' }],
			subject: 'Hi',
			textContent: 'Body'
		});
	});

	it('handles bare email sender without name', async () => {
		fetchMock.mockResolvedValueOnce(new Response('{}', { status: 201 }));

		await sendEmail({
			apiKey: 'k',
			from: 'noreply@mavlo.web.id',
			to: 'u@e.com',
			subject: 's',
			text: 't'
		});

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.sender).toEqual({ email: 'noreply@mavlo.web.id' });
	});

	it('throws on non-2xx response', async () => {
		fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
		await expect(
			sendEmail({
				apiKey: 'k',
				from: 'a@b.com',
				to: 'b@c.com',
				subject: 's',
				text: 't'
			})
		).rejects.toThrow(/brevo.*429/i);
	});
});
