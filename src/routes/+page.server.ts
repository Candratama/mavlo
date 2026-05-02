import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const u = event.locals.user as { isDemo?: boolean } | undefined;
	if (u && !u.isDemo) throw redirect(302, '/dashboard');
};
