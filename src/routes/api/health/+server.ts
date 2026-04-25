import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	let dbStatus: 'up' | 'down' = 'down';
	try {
		await event.platform!.env.DB.prepare('SELECT 1').first();
		dbStatus = 'up';
	} catch {
		dbStatus = 'down';
	}

	return json({ ok: dbStatus === 'up', db: dbStatus, ts: Date.now() });
};
