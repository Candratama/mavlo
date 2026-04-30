import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { userPreferences, users } from '$lib/server/db/schema';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const [userRow] = await db
		.select({ onboardedAt: users.onboardedAt })
		.from(users)
		.where(eq(users.id, user.id))
		.limit(1);
	if (!userRow?.onboardedAt) {
		throw redirect(302, '/onboarding');
	}

	let prefs = (
		await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1)
	)[0];

	if (!prefs) {
		prefs = (await db.insert(userPreferences).values({ userId: user.id }).returning())[0];
	}

	const [accounts, categories, balances] = await Promise.all([
		listAccounts(db, user.id, { includeArchived: false }),
		listCategories(db, user.id, { includeArchived: false }),
		computeAccountBalances(db, user.id)
	]);

	const accountsWithBalance = accounts.map((a) => ({
		...a,
		balanceCents: balances.get(a.id) ?? a.initialBalanceCents
	}));

	return {
		user: {
			id: user.id,
			name: user.name,
			username: (user as { username?: string | null }).username ?? null,
			email: user.email,
			image: user.image,
			isDemo: (user as { isDemo?: boolean }).isDemo ?? false
		},
		preferences: prefs,
		accounts: accountsWithBalance,
		categories
	};
};
