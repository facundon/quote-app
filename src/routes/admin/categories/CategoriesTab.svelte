<script lang="ts">
	import CategoryCreateForm from './CategoryCreateForm.svelte';
	import CategoryEditForm from './CategoryEditForm.svelte';
	import CategoryList from './CategoryList.svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import { invalidate, invalidateAll } from '$app/navigation';

	type Category = {
		id: number;
		name: string;
		unit_price: number;
	};

	let {
		categories: initialCategories,
		form
	}: {
		categories: Category[];
		form?: ActionResult;
	} = $props();

	let categories = $state<Category[]>([...initialCategories]);
	let name = $state('');
	let unitPrice = $state('');
	let editId = $state<number | null>(null);
	let editName = $state('');
	let editUnitPrice = $state('');
	let error = $state('');

	$effect(() => {
		categories = [...initialCategories];
	});

	function startEdit(cat: Category) {
		editId = cat.id;
		editName = cat.name;
		editUnitPrice = cat.unit_price.toString();
	}

	function cancelEdit() {
		editId = null;
		editName = '';
		editUnitPrice = '';
		error = '';
	}

	async function fetchCategories() {
		await invalidateAll();
	}
</script>

{#if form?.type === 'failure'}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{form?.data?.error}</div>
{/if}
{#if form?.type === 'success'}
	<div class="mb-2 rounded bg-green-100 px-3 py-2 text-green-700">Category created.</div>
{/if}
{#if error}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{error}</div>
{/if}
{#if editId}
	<CategoryEditForm
		id={editId}
		name={editName}
		unitPrice={editUnitPrice}
		onEdited={() => {
			fetchCategories();
			cancelEdit();
		}}
		onCancel={cancelEdit}
	/>
{:else}
	<CategoryCreateForm {name} {unitPrice} {form} onCreated={fetchCategories} />
	<CategoryList {categories} onEdit={startEdit} onDeleted={fetchCategories} />
{/if}
