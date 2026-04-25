import { describe, it, expect, vi } from 'vitest';
import { uploadAvatar } from './avatar';

const fakeBucket = (): R2Bucket =>
	({
		put: vi.fn().mockResolvedValue({}),
		get: vi.fn().mockResolvedValue(null),
		head: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(undefined),
		list: vi.fn().mockResolvedValue({ objects: [] }),
		createMultipartUpload: vi.fn() as never,
		resumeMultipartUpload: vi.fn() as never
	}) as unknown as R2Bucket;

describe('uploadAvatar', () => {
	it('rejects unsupported types', async () => {
		const bucket = fakeBucket();
		const file = new File(['x'], 'avatar.svg', { type: 'image/svg+xml' });
		await expect(uploadAvatar({ bucket, userId: 'u1', file })).rejects.toThrow(/unsupported/i);
	});

	it('rejects files over 2 MB', async () => {
		const bucket = fakeBucket();
		const big = new Uint8Array(3 * 1024 * 1024);
		const file = new File([big], 'avatar.png', { type: 'image/png' });
		await expect(uploadAvatar({ bucket, userId: 'u1', file })).rejects.toThrow(/too large/i);
	});

	it('puts the file at avatars/<userId>', async () => {
		const bucket = fakeBucket();
		const file = new File([new Uint8Array(100)], 'avatar.png', { type: 'image/png' });
		await uploadAvatar({ bucket, userId: 'u1', file });
		expect(bucket.put).toHaveBeenCalledOnce();
		const calls = (bucket.put as ReturnType<typeof vi.fn>).mock.calls;
		expect(calls[0][0]).toBe('avatars/u1');
		expect(calls[0][2].httpMetadata.contentType).toBe('image/png');
	});
});
