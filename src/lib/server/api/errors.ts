export type ApiErrorCode = 'unauthorized' | 'not_found' | 'validation' | 'conflict' | 'server';

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
