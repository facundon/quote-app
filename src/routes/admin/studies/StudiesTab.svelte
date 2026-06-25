<script lang="ts">
	import StudyCreateForm from './StudyCreateForm.svelte';
	import StudyEditForm from './StudyEditForm.svelte';
	import StudyList from './StudyList.svelte';
	import { invalidateAll } from '$app/navigation';
	import { matchesSearch } from '$lib/utils/search';

	type Category = { id: number; name: string };
	type Study = { id: number; name: string; category_id: number };

	let {
		studies: initialStudies,
		categories
	}: {
		studies: Study[];
		categories: Category[];
	} = $props();

	let searchQuery = $state('');
	let studies = $derived(initialStudies.filter((s) => matchesSearch(s.name, searchQuery)));
	let name = $state('');
	let categoryId = $state('');
	let editId = $state<number | null>(null);
	let editName = $state('');
	let editCategoryId = $state('');

	function startEdit(study: Study) {
		editId = study.id;
		editName = study.name;
		editCategoryId = String(study.category_id);
	}

	function cancelEdit() {
		editId = null;
		editName = '';
		editCategoryId = '';
	}

	async function fetchStudies() {
		await invalidateAll();
	}
</script>

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
	<div class="mb-4">
		<input
			type="text"
			placeholder="Buscar estudios..."
			class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
			bind:value={searchQuery}
		/>
	</div>
	<StudyCreateForm {name} {categoryId} {categories} onCreated={fetchStudies} />
	<StudyList {studies} {categories} onEdit={startEdit} onDeleted={fetchStudies} />
{/if}
