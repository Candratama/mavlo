import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	listCategories,
	createCategory,
	updateCategory,
	archiveCategory,
	unarchiveCategory,
	deleteCategory,
	reorderCategories
} from '$lib/server/repositories/categories';
import {
	categoryCreateSchema,
	categoryUpdateSchema,
	categoryIdSchema
} from '$lib/validation/category';
import { transactions } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);
	const includeArchived = event.url.searchParams.get('archived') === '1';
	const categories = await listCategories(db, user.id, { includeArchived });

	const counts = await db
		.select({ categoryId: transactions.categoryId, n: sql<number>`count(*)`.as('n') })
		.from(transactions)
		.where(eq(transactions.userId, user.id))
		.groupBy(transactions.categoryId);
	const countByCategory = Object.fromEntries(counts.map((r) => [r.categoryId ?? '', Number(r.n)]));

	return { categories, includeArchived, countByCategory };
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = categoryCreateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		await createCategory(db, user.id, parsed.data);
		return { success: true, action: 'create' };
	},
	update: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = categoryUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const updated = await updateCategory(db, user.id, parsed.data);
		if (!updated) return fail(404, { action: 'update', message: 'Category not found' });
		return { success: true, action: 'update' };
	},
	archive: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = categoryIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'archive', message: 'Invalid id' });
		await archiveCategory(db, user.id, parsed.data.id);
		return { success: true, action: 'archive' };
	},
	unarchive: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = categoryIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'unarchive', message: 'Invalid id' });
		await unarchiveCategory(db, user.id, parsed.data.id);
		return { success: true, action: 'unarchive' };
	},
	delete: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = categoryIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'delete', message: 'Invalid id' });
		await deleteCategory(db, user.id, parsed.data.id);
		return { success: true, action: 'delete' };
	},
	reorder: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const idsRaw = fd.get('ids');
		if (typeof idsRaw !== 'string') return fail(400, { action: 'reorder', message: 'Invalid ids' });
		const ids = idsRaw.split(',').filter(Boolean);
		if (ids.length === 0) return fail(400, { action: 'reorder', message: 'Empty ids' });
		await reorderCategories(db, user.id, ids);
		return { success: true, action: 'reorder' };
	}
};
