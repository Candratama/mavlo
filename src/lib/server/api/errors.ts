export type ApiErrorCode = 'unauthorized' | 'not_found' | 'validation' | 'server';

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: ApiErrorCode,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}
