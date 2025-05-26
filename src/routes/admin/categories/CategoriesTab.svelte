<script lang="ts">
	import CategoryCreateForm from './CategoryCreateForm.svelte';
	import CategoryEditForm from './CategoryEditForm.svelte';
	import CategoryList from './CategoryList.svelte';
	import { invalidateAll } from '$app/navigation';

	type Category = {
		id: number;
		name: string;
		unit_price: number;
	};

	let {
		categories: initialCategories,
		studies = [],
		discounts = []
	}: {
		categories: Category[];
		studies?: { category_id: number }[];
		discounts?: { category_id: number }[];
	} = $props();

	let categories = $derived(initialCategories);
	let name = $state('');
	let unitPrice = $state('');
	let editId = $state<number | null>(null);
	let editName = $state('');
	let editUnitPrice = $state('');

	function startEdit(cat: Category) {
		editId = cat.id;
		editName = cat.name;
		editUnitPrice = cat.unit_price.toString();
	}

	function cancelEdit() {
		editId = null;
		editName = '';
		editUnitPrice = '';
	}

	async function fetchCategories() {
		await invalidateAll();
	}
</script>

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
	<CategoryCreateForm {name} {unitPrice} onCreated={fetchCategories} />
	<CategoryList {categories} {studies} {discounts} onEdit={startEdit} onDeleted={fetchCategories} />
{/if}
