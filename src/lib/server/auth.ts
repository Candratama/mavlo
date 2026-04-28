import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';
import { sendEmail } from '$lib/server/email/resend';
import { verifyEmailTemplate, resetPasswordTemplate } from '$lib/server/email/templates';

const sendFromRequest = async (to: string, subject: string, text: string) => {
	const event = getRequestEvent();
	const platformEnv = event.platform?.env;
	if (!platformEnv) throw new Error('platform.env unavailable in auth email callback');
	await sendEmail({
		apiKey: platformEnv.RESEND_API_KEY,
		from: platformEnv.RESEND_FROM,
		to,
		subject,
		text
	});
};

const authConfig = {
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			const tpl = resetPasswordTemplate(url, user.name);
			await sendFromRequest(user.email, tpl.subject, tpl.text);
		}
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			const tpl = verifyEmailTemplate(url, user.name);
			await sendFromRequest(user.email, tpl.subject, tpl.text);
		},
		sendOnSignUp: true,
		autoSignInAfterVerification: true
	},
	user: {
		modelName: 'users',
		additionalFields: {
			username: { type: 'string', required: false, input: true }
		}
	},
	session: { modelName: 'sessions' },
	account: { modelName: 'auth_accounts' },
	verification: { modelName: 'verifications' },
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>;

export const createAuth = (d1: D1Database) =>
	betterAuth({
		...authConfig,
		database: drizzleAdapter(getDb(d1), { provider: 'sqlite' })
	});

/**
 * DO NOT USE!
 *
 * This instance is used by the `better-auth` CLI for schema generation ONLY.
 * To access `auth` at runtime, use `event.locals.auth`.
 */
export const auth = createAuth(null!);
