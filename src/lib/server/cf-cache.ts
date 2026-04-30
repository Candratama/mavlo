// Lightweight wrapper over Cloudflare's edge cache (caches.default).
// Used to avoid recomputing heavy aggregations on every request.
// - Keys are namespaced by userId so cache isolation matches data ownership.
// - TTL bounded by `s-maxage` header (CF caches respect it).
// - On mutation, callers should call `purgeUserCache(env, userId)`.

const ORIGIN = 'https://__internal-cache.mavlo';

const buildKey = (userId: string, name: string): Request =>
	new Request(`${ORIGIN}/u/${userId}/${name}`);

/**
 * Get a cached JSON value, or compute + cache if absent.
 * Falls through to `compute` if `caches.default` is unavailable (e.g. some dev environments).
 */
export async function cachedJson<T>(
	userId: string,
	name: string,
	ttlSeconds: number,
	compute: () => Promise<T>
): Promise<T> {
	const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
	if (!cache) return compute();

	const key = buildKey(userId, name);
	try {
		const hit = await cache.match(key);
		if (hit) {
			return (await hit.json()) as T;
		}
	} catch {
		// Cache read errors are non-fatal — fall through.
	}

	const value = await compute();
	try {
		await cache.put(
			key,
			new Response(JSON.stringify(value), {
				headers: {
					'content-type': 'application/json',
					'cache-control': `public, s-maxage=${ttlSeconds}`
				}
			})
		);
	} catch {
		// Cache write errors are non-fatal.
	}
	return value;
}

/**
 * Best-effort purge of all cached aggregates for a single user.
 * Call after any data mutation so the next request recomputes fresh.
 */
export async function purgeUserCache(userId: string, names: string[]): Promise<void> {
	const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
	if (!cache) return;
	await Promise.all(
		names.map((n) =>
			cache.delete(buildKey(userId, n)).catch(() => {
				// Silently ignore — stale cache is acceptable for next ~60s.
			})
		)
	);
}

// Cache key registry — keep all names here so purge is exhaustive.
export const CACHE_KEYS = {
	spendingByCategory: (period: string) => `dash/spending-by-cat/${period}`,
	dailySpending: (period: string) => `dash/daily/${period}`,
	monthlyIncomeExpense: (period: string, monthsBack: number) =>
		`dash/monthly/${period}/${monthsBack}`
} as const;

// All cache names a user has — used by purge.
export const allUserCacheNames = (period: string, monthsBack: number): string[] => [
	CACHE_KEYS.spendingByCategory(period),
	CACHE_KEYS.dailySpending(period),
	CACHE_KEYS.monthlyIncomeExpense(period, monthsBack)
];
