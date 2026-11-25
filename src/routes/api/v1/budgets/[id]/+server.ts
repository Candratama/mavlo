import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { purgeUserCachesForCurrentCycle } from '$lib/server/purge-user-caches';
import { ok, noContent, toErrorResponse } from '$lib/server/api/respond';
import { getBgt, updateBgt, deleteBgt } from '$lib/server/api/handlers/budgets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return ok(await getBgt(db, userId, params.id));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const PATCH: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		const data = await updateBgt(db, userId, params.id, body);
		await purgeUserCachesForCurrentCycle(db, userId);
		return ok(data);
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const DELETE: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		await deleteBgt(db, userId, params.id);
		await purgeUserCachesForCurrentCycle(db, userId);
		return noContent();
	} catch (e) {
		return toErrorResponse(e);
	}
};
