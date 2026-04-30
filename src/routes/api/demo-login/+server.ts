import { hashPassword } from 'better-auth/crypto';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { users, auth_accounts } from '$lib/server/db/schema';
import { seedDemoData } from '$lib/server/demo-seed';
import type { RequestHandler } from './$types';

const DEMO_DOMAIN = 'mavlo.demo';

const handler: RequestHandler = async (event) => {
	const platformEnv = event.platform?.env;
	if (!platformEnv) {
		return new Response('platform.env unavailable', { status: 500 });
	}

	const db = getDb(platformEnv.DB);
	const userId = createId();
	const random = createId();
	const email = `demo-${random}@${DEMO_DOMAIN}`;
	const password = createId() + createId(); // 24 chars
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

	const passwordHash = await hashPassword(password);

	await db.insert(auth_accounts).values({
		id: createId(),
		accountId: userId,
		providerId: 'credential',
		userId,
		password: passwordHash,
		createdAt: now,
		updatedAt: now
	});

	await seedDemoData(db, userId);

	const authResponse = await event.locals.auth.api.signInEmail({
		body: { email, password },
		asResponse: true
	});

	const setCookie = authResponse.headers.get('set-cookie');
	if (!setCookie) {
		// Cleanup orphan demo user if sign-in failed
		await db.delete(users).where(eq(users.id, userId));
		return new Response('Demo sign-in failed', { status: 500 });
	}

	const headers = new Headers({ Location: '/dashboard' });
	headers.append('Set-Cookie', setCookie);
	return new Response(null, { status: 303, headers });
};

export const POST: RequestHandler = handler;
