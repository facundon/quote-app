<script lang="ts">
	import StudyCreateForm from './StudyCreateForm.svelte';
	import StudyEditForm from './StudyEditForm.svelte';
	import StudyList from './StudyList.svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import { invalidateAll } from '$app/navigation';

	type Category = { id: number; name: string };
	type Study = { id: number; name: string; category_id: number };

	let {
		studies: initialStudies,
		categories,
		form
	}: {
		studies: Study[];
		categories: Category[];
		form?: ActionResult;
	} = $props();

	let studies = $state<Study[]>([...initialStudies]);
	let name = $state('');
	let categoryId = $state('');
	let editId = $state<number | null>(null);
	let editName = $state('');
	let editCategoryId = $state('');
	let error = $state('');

	$effect(() => {
		studies = [...initialStudies];
	});

	function startEdit(study: Study) {
		editId = study.id;
		editName = study.name;
		editCategoryId = String(study.category_id);
	}

	function cancelEdit() {
		editId = null;
		editName = '';
		editCategoryId = '';
		error = '';
	}

	async function fetchStudies() {
		await invalidateAll();
	}
</script>

{#if form?.type === 'failure'}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{form?.data?.error}</div>
{/if}
{#if form?.type === 'success'}
	<div class="mb-2 rounded bg-green-100 px-3 py-2 text-green-700">Study created.</div>
{/if}
{#if error}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{error}</div>
{/if}
{#if editId}
	<StudyEditForm
		id={editId}
		name={editName}
		categoryId={editCategoryId}
		{categories}
		onEdited={() => {
			fetchStudies();
			cancelEdit();
		}}
		onCancel={cancelEdit}
	/>
{:else}
	<StudyCreateForm {name} {categoryId} {categories} {form} onCreated={fetchStudies} />
	<StudyList {studies} {categories} onEdit={startEdit} onDeleted={fetchStudies} />
{/if}
