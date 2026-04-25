const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export interface AvatarUploadArgs {
	bucket: R2Bucket;
	userId: string;
	file: File;
}

export interface AvatarUploadResult {
	contentType: string;
	bytes: number;
}

export async function uploadAvatar(args: AvatarUploadArgs): Promise<AvatarUploadResult> {
	const { bucket, userId, file } = args;

	if (!ALLOWED_TYPES.has(file.type)) {
		throw new Error(`Unsupported image type: ${file.type}`);
	}
	if (file.size > MAX_BYTES) {
		throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB > 2 MB`);
	}

	const key = `avatars/${userId}`;
	const arrayBuffer = await file.arrayBuffer();
	await bucket.put(key, arrayBuffer, {
		httpMetadata: { contentType: file.type },
		customMetadata: { userId }
	});

	return { contentType: file.type, bytes: file.size };
}

export async function getAvatar(args: { bucket: R2Bucket; userId: string }) {
	return args.bucket.get(`avatars/${args.userId}`);
}
