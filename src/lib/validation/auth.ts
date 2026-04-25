import { z } from 'zod';

export const emailField = z.string().trim().toLowerCase().email('Invalid email');
export const passwordField = z.string().min(8, 'Password must be at least 8 characters');

export const signUpSchema = z.object({
	name: z.string().trim().min(1, 'Name required').max(100),
	email: emailField,
	password: passwordField
});

export const signInSchema = z.object({
	email: emailField,
	password: z.string().min(1, 'Password required')
});

export const forgotPasswordSchema = z.object({
	email: emailField
});

export const resetPasswordSchema = z.object({
	token: z.string().min(1, 'Reset token required'),
	password: passwordField
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
