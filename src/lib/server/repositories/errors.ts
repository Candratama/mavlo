/**
 * Thrown by a repository write when the input points at data the user doesn't
 * own, or would break an invariant the database doesn't enforce. `conflict`
 * marks a duplicate rather than bad input (HTTP 409 vs 400).
 */
export class RepoValidationError extends Error {
	constructor(
		message: string,
		public conflict = false
	) {
		super(message);
		this.name = 'RepoValidationError';
	}
}
