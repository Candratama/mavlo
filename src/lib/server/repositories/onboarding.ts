import { eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { users, accounts, categories, userPreferences } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import { DEFAULT_CATEGORIES } from '$lib/server/onboarding-defaults';
import type { OnboardingCompleteInput } from '$lib/validation/onboarding';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function completeOnboarding(
	db: Db,
	userId: string,
	input: OnboardingCompleteInput
): Promise<void> {
	await db
		.insert(userPreferences)
		.values({
			userId,
			currency: input.currency,
			locale: input.locale,
			timezone: input.timezone
		})
		.onConflictDoUpdate({
			target: userPreferences.userId,
			set: {
				currency: input.currency,
				locale: input.locale,
				timezone: input.timezone,
				updatedAt: Date.now()
			}
		});

	await db.insert(accounts).values({
		userId,
		name: input.accountName,
		type: input.accountType,
		currency: input.currency,
		initialBalanceCents: input.initialBalanceCents
	});

	const selected =
		input.categoryNames.length > 0
			? DEFAULT_CATEGORIES.filter((c) => input.categoryNames.includes(c.name))
			: DEFAULT_CATEGORIES;

	if (selected.length > 0) {
		await db.insert(categories).values(
			selected.map((c) => ({
				userId,
				name: c.name,
				kind: c.kind,
				icon: c.icon,
				color: c.color
			}))
		);
	}

	await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, userId));
}
