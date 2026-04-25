import { redirect, type RequestEvent } from '@sveltejs/kit';

type User = NonNullable<App.Locals['user']>;

export function requireUser(event: RequestEvent): User {
	if (!event.locals.user) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		throw redirect(302, `/sign-in?next=${next}`);
	}
	return event.locals.user;
}
