import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	throw redirect(302, '/sign-in');
};

export const actions: Actions = {
	default: async (event) => {
		await event.locals.auth.api.signOut({ headers: event.request.headers });
		throw redirect(302, '/sign-in');
	}
};
