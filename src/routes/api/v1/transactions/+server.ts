import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { purgeUserCachesForCurrentCycle } from '$lib/server/purge-user-caches';
import { ok, list, toErrorResponse } from '$lib/server/api/respond';
import { listTx, createTx } from '$lib/server/api/handlers/transactions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return list(await listTx(db, userId, url));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		const data = await createTx(db, userId, body);
		await purgeUserCachesForCurrentCycle(db, userId);
		return ok(data, 201);
	} catch (e) {
		return toErrorResponse(e);
	}
};
