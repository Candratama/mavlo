import { getDb } from '$lib/server/db';
import { requireApiKey } from '$lib/server/api/authenticate';
import { ok, noContent, toErrorResponse } from '$lib/server/api/respond';
import { getTx, updateTx, deleteTx } from '$lib/server/api/handlers/transactions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		return ok(await getTx(db, userId, params.id));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const PATCH: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		const body = await request.json().catch(() => ({}));
		return ok(await updateTx(db, userId, params.id, body));
	} catch (e) {
		return toErrorResponse(e);
	}
};

export const DELETE: RequestHandler = async ({ request, params, platform }) => {
	try {
		const db = getDb(platform!.env.DB);
		const userId = await requireApiKey(request, db);
		await deleteTx(db, userId, params.id);
		return noContent();
	} catch (e) {
		return toErrorResponse(e);
	}
};
