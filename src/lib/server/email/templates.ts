export const verifyEmailTemplate = (url: string, name?: string) => ({
	subject: 'Verify your Mavlo email',
	text: `Hi${name ? ` ${name}` : ''},

Confirm your Mavlo email by visiting:
${url}

If you didn't create a Mavlo account, ignore this message.`
});

export const resetPasswordTemplate = (url: string, name?: string) => ({
	subject: 'Reset your Mavlo password',
	text: `Hi${name ? ` ${name}` : ''},

We received a request to reset your Mavlo password. Click below within the next hour:
${url}

If you didn't request a reset, ignore this message — your password is unchanged.`
});
