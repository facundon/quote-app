import { db } from '$lib/server/db';
import { study } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function createStudy(name: string, categoryId: number) {
	if (!name.trim() || categoryId === 0) throw Error('Missing name or category');
	return db.insert(study).values({ name: String(name.trim()), category_id: Number(categoryId) });
}

export async function updateStudy(newName: string, categoryId: number, studyId: number) {
	if (!newName.trim() || categoryId === 0) throw Error('Missing name or category');

	return db
		.update(study)
		.set({ name: String(newName.trim()), category_id: Number(categoryId) })
		.where(eq(study.id, Number(studyId)));
}

export async function deleteStudy(studyId: number) {
	return db.delete(study).where(eq(study.id, Number(studyId)));
}
