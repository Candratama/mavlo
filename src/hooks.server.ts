import { error, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Demo users can only mutate via these form actions; everything else is read-only.
const DEMO_ALLOWED_ACTIONS = new Set([
	'/transactions?/create',
	'/transactions?/update',
	'/transactions?/delete'
]);

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (!event.platform?.env?.DB)
		throw new Error('D1 binding "DB" not found - are you running with wrangler?');

	event.locals.auth = createAuth(event.platform.env.DB);

	const { auth } = event.locals;
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	// Demo guard: block mutations except whitelisted transaction actions.
	const u = event.locals.user as { isDemo?: boolean } | undefined;
	if (u?.isDemo && event.request.method === 'POST') {
		const path = event.url.pathname;
		// SvelteKit form actions URL format: /path?/actionName → search = "?/actionName"
		const actionMatch = event.url.search.match(/^\?\/([^&=]+)/);
		const actionName = actionMatch?.[1];
		const isFormAction = !!actionName;
		const key = isFormAction ? `${path}?/${actionName}` : path;
		const isAuthApi = path.startsWith('/api/auth/');
		const isSignOut = path === '/sign-out';
		if (isFormAction && !DEMO_ALLOWED_ACTIONS.has(key)) {
			throw error(
				403,
				'Demo mode: only create/update/delete transactions are allowed. Sign up for full access.'
			);
		}
		if (!isFormAction && !isAuthApi && !isSignOut) {
			throw error(
				403,
				'Demo mode: only create/update/delete transactions are allowed. Sign up for full access.'
			);
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
