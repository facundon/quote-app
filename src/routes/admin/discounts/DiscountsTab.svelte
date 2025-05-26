<script lang="ts">
	import DiscountCreateForm from './DiscountCreateForm.svelte';
	import DiscountEditForm from './DiscountEditForm.svelte';
	import DiscountList from './DiscountList.svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import { invalidateAll } from '$app/navigation';

	type Category = { id: number; name: string };
	type Discount = { id: number; category_id: number; min_quantity: number; percentage: number };

	let {
		discounts: initialDiscounts,
		categories,
		form
	}: {
		discounts: Discount[];
		categories: Category[];
		form?: ActionResult;
	} = $props();

	let discounts = $state<Discount[]>([...initialDiscounts]);
	let categoryId = $state('');
	let minQuantity = $state('');
	let percentage = $state('');
	let editId = $state<number | null>(null);
	let editCategoryId = $state('');
	let editMinQuantity = $state('');
	let editPercentage = $state('');
	let error = $state('');

	$effect(() => {
		discounts = [...initialDiscounts];
	});

	function startEdit(discount: Discount) {
		editId = discount.id;
		editCategoryId = String(discount.category_id);
		editMinQuantity = String(discount.min_quantity);
		editPercentage = String(discount.percentage);
	}

	function cancelEdit() {
		editId = null;
		editCategoryId = '';
		editMinQuantity = '';
		editPercentage = '';
		error = '';
	}

	async function fetchDiscounts() {
		await invalidateAll();
	}
</script>

{#if form?.type === 'failure'}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{form?.data?.error}</div>
{/if}
{#if form?.type === 'success'}
	<div class="mb-2 rounded bg-green-100 px-3 py-2 text-green-700">Discount created.</div>
{/if}
{#if error}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{error}</div>
{/if}
{#if editId}
	<DiscountEditForm
		id={editId}
		categoryId={editCategoryId}
		minQuantity={editMinQuantity}
		percentage={editPercentage}
		{categories}
		onEdited={() => {
			fetchDiscounts();
			cancelEdit();
		}}
		onCancel={cancelEdit}
	/>
{:else}
	<DiscountCreateForm
		{categoryId}
		{minQuantity}
		{percentage}
		{categories}
		{form}
		onCreated={fetchDiscounts}
	/>
	<DiscountList {discounts} {categories} onEdit={startEdit} onDeleted={fetchDiscounts} />
{/if}
