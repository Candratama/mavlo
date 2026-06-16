import { json } from '@sveltejs/kit';
import { ApiError } from './errors';

export function ok(data: unknown, status = 200): Response {
	return json({ data }, { status });
}

export function list(data: unknown, nextCursor: string | null = null): Response {
	return json({ data, nextCursor });
}

export function noContent(): Response {
	return new Response(null, { status: 204 });
}

export function toErrorResponse(err: unknown): Response {
	if (err instanceof ApiError) {
		return json({ error: { code: err.code, message: err.message } }, { status: err.status });
	}
	console.error('Unhandled API error', err);
	return json({ error: { code: 'server', message: 'Internal error' } }, { status: 500 });
}
