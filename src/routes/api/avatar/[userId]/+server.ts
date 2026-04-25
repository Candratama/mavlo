import { error } from '@sveltejs/kit';
import { getAvatar } from '$lib/server/storage/avatar';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const userId = event.params.userId;
	const obj = await getAvatar({ bucket: event.platform!.env.UPLOADS, userId });
	if (!obj) error(404, 'Avatar not found');
	return new Response(obj.body, {
		headers: {
			'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
			'Cache-Control': 'public, max-age=300'
		}
	});
};
