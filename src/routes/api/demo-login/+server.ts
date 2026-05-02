import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { seedDemoData } from '$lib/server/demo-seed';
import type { RequestHandler } from './$types';

const DEMO_DOMAIN = 'mavlo.demo';
const SESSION_COOKIE_NAME = 'better-auth.session_token';

async function signCookieValue(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
	const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
	return encodeURIComponent(`${value}.${sigB64}`);
}

const handler: RequestHandler = async (event) => {
	const platformEnv = event.platform?.env;
	if (!platformEnv) {
		return new Response('platform.env unavailable', { status: 500 });
	}

	const db = getDb(platformEnv.DB);
	const userId = createId();
	const random = createId();
	const email = `demo-${random}@${DEMO_DOMAIN}`;
	const now = new Date();

	await db.insert(users).values({
		id: userId,
		name: 'Demo User',
		email,
		emailVerified: true,
		isDemo: true,
		onboardedAt: now,
		createdAt: now,
		updatedAt: now
	});

	try {
		await seedDemoData(db, userId);
	} catch (err) {
		await db.delete(users).where(eq(users.id, userId));
		console.error('seedDemoData failed', err);
		return new Response('Demo seed failed', { status: 500 });
	}

	const ctx = await event.locals.auth.$context;
	const session = await ctx.internalAdapter.createSession(userId, false);
	if (!session) {
		await db.delete(users).where(eq(users.id, userId));
		return new Response('Demo session creation failed', { status: 500 });
	}

	const signed = await signCookieValue(session.token, env.BETTER_AUTH_SECRET);
	const isProd = (env.ORIGIN ?? '').startsWith('https://');
	const maxAge = Math.max(
		1,
		Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)
	);
	const cookieParts = [
		`${SESSION_COOKIE_NAME}=${signed}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${maxAge}`
	];
	if (isProd) cookieParts.push('Secure');

	const headers = new Headers({ Location: '/dashboard' });
	headers.append('Set-Cookie', cookieParts.join('; '));
	return new Response(null, { status: 303, headers });
};

export const POST: RequestHandler = handler;
