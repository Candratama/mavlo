export interface SendEmailArgs {
	apiKey: string;
	from: string;
	to: string;
	subject: string;
	text: string;
	html?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
	const { apiKey, from, to, subject, text, html } = args;
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) })
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Resend error ${res.status}: ${body}`);
	}
}
