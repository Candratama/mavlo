import { describe, it, expect } from 'vitest';
import { requireUser } from './guards';

const makeEvent = (user: unknown, pathname = '/dashboard') =>
	({
		locals: { user },
		url: new URL(`http://localhost${pathname}`)
	}) as never;

describe('requireUser', () => {
	it('returns the user when present', () => {
		const u = { id: 'u1', email: 'a@b.co' };
		expect(requireUser(makeEvent(u))).toBe(u);
	});

	it('throws a redirect when no user', () => {
		let caught: { status: number; location: string } | undefined;
		try {
			requireUser(makeEvent(undefined, '/dashboard'));
		} catch (e) {
			caught = e as typeof caught;
		}
		expect(caught).toBeDefined();
		expect(caught!.status).toBe(302);
		expect(caught!.location).toBe('/sign-in?next=%2Fdashboard');
	});

	it('preserves query string in next param', () => {
		let caught: { status: number; location: string } | undefined;
		try {
			requireUser(makeEvent(undefined, '/transactions?range=month'));
		} catch (e) {
			caught = e as typeof caught;
		}
		expect(caught!.location).toBe('/sign-in?next=%2Ftransactions%3Frange%3Dmonth');
	});
});
