import { describe, it, expect } from 'vitest';
import { signInSchema, signUpSchema, forgotPasswordSchema, resetPasswordSchema } from './auth';

describe('auth validation', () => {
	it('signUp requires name + email + password >= 8', () => {
		expect(signUpSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'short' }).success).toBe(
			false
		);
		expect(
			signUpSchema.safeParse({ name: 'Ada', email: 'a@b.co', password: 'longenough1' }).success
		).toBe(true);
	});

	it('signIn requires email + non-empty password', () => {
		expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
		expect(signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
	});

	it('forgotPassword requires email', () => {
		expect(forgotPasswordSchema.safeParse({ email: 'invalid' }).success).toBe(false);
		expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
	});

	it('resetPassword requires token + password >= 8', () => {
		expect(resetPasswordSchema.safeParse({ token: 't', password: 'short' }).success).toBe(false);
		expect(resetPasswordSchema.safeParse({ token: 't', password: 'longenough1' }).success).toBe(
			true
		);
	});
});
