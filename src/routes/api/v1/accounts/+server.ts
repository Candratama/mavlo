import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { ok, list, toErrorResponse } from '$lib/server/api/respond';
import { listAcc, createAcc } from '$lib/server/api/handlers/accounts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return list(await listAcc(db, userId, url));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		return ok(await createAcc(db, userId, body), 201);
	} catch (e) {
		return toErrorResponse(e);
	}
};
