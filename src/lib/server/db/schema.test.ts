import { describe, it, expect } from 'vitest';
import * as schema from './schema';

describe('app schema exports', () => {
	it('exports all required app tables', () => {
		expect(schema.accounts).toBeDefined();
		expect(schema.categories).toBeDefined();
		expect(schema.transactions).toBeDefined();
		expect(schema.budgets).toBeDefined();
		expect(schema.userPreferences).toBeDefined();
	});

	it('does not export the demo task table', () => {
		// @ts-expect-error: demo table should be removed
		expect(schema.task).toBeUndefined();
	});

	it('re-exports auth tables', () => {
		expect(schema.users).toBeDefined();
		expect(schema.sessions).toBeDefined();
		expect(schema.verifications).toBeDefined();
	});
});
