import { error } from '@sveltejs/kit';
import { getAvatar } from '$lib/server/storage/avatar';
import type { RequestHandler } from './$types';

// Avatars are only shown to their owner (the app layout), so only the signed-in
// owner may fetch one. Anyone else gets the same 404 as a missing avatar.
export const GET: RequestHandler = async (event) => {
	const userId = event.params.userId;
	if (event.locals.user?.id !== userId) error(404, 'Avatar not found');
	const obj = await getAvatar({ bucket: event.platform!.env.UPLOADS, userId });
	if (!obj) error(404, 'Avatar not found');
	return new Response(obj.body, {
		headers: {
			'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
			'Cache-Control': 'private, max-age=300'
		}
	});
};
