import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Constant-time string compare to avoid timing leaks on secret check.
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return mismatch === 0;
}

export const POST: RequestHandler = async (event) => {
	const platformEnv = event.platform?.env;
	if (!platformEnv) return new Response('platform.env unavailable', { status: 500 });

	const expectedSecret = (platformEnv as { CRON_SECRET?: string }).CRON_SECRET;
	if (!expectedSecret) return new Response('CRON_SECRET not configured', { status: 500 });
	const provided = event.request.headers.get('x-cron-secret');
	if (!provided || !safeEqual(provided, expectedSecret)) {
		return new Response('Forbidden', { status: 403 });
	}

	const db = getDb(platformEnv.DB);
	const cutoff = new Date(Date.now() - ONE_DAY_MS);

	const deleted = await db
		.delete(users)
		.where(and(eq(users.isDemo, true), lt(users.createdAt, cutoff)))
		.returning({ id: users.id });

	return new Response(
		JSON.stringify({ deleted: deleted.length, cutoff: cutoff.toISOString() }),
		{ status: 200, headers: { 'content-type': 'application/json' } }
	);
};
