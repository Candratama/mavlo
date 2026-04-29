export interface SendEmailArgs {
	apiKey: string;
	from: string;
	to: string;
	subject: string;
	text: string;
	html?: string;
}

interface BrevoSender {
	email: string;
	name?: string;
}

const parseFrom = (from: string): BrevoSender => {
	const match = from.match(/^\s*(.*?)\s*<\s*([^<>\s]+)\s*>\s*$/);
	if (match && match[2]) {
		const name = match[1].trim();
		return name ? { name, email: match[2] } : { email: match[2] };
	}
	return { email: from.trim() };
};

export async function sendEmail(args: SendEmailArgs): Promise<void> {
	const { apiKey, from, to, subject, text, html } = args;
	const res = await fetch('https://api.brevo.com/v3/smtp/email', {
		method: 'POST',
		headers: {
			'api-key': apiKey,
			'content-type': 'application/json',
			accept: 'application/json'
		},
		body: JSON.stringify({
			sender: parseFrom(from),
			to: [{ email: to }],
			subject,
			textContent: text,
			...(html ? { htmlContent: html } : {})
		})
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Brevo error ${res.status}: ${body}`);
	}
}
