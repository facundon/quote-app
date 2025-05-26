<script lang="ts">
	import DiscountCreateForm from './DiscountCreateForm.svelte';
	import DiscountEditForm from './DiscountEditForm.svelte';
	import DiscountList from './DiscountList.svelte';
	import { invalidateAll } from '$app/navigation';

	type Category = { id: number; name: string };
	type Discount = { id: number; category_id: number; min_quantity: number; percentage: number };

	let {
		discounts: initialDiscounts,
		categories
	}: {
		discounts: Discount[];
		categories: Category[];
	} = $props();

	let discounts = $state<Discount[]>([...initialDiscounts]);
	let categoryId = $state('');
	let minQuantity = $state('');
	let percentage = $state('');
	let editId = $state<number | null>(null);
	let editCategoryId = $state('');
	let editMinQuantity = $state('');
	let editPercentage = $state('');

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
	}

	async function fetchDiscounts() {
		await invalidateAll();
	}
</script>

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
		onCreated={fetchDiscounts}
	/>
	<DiscountList {discounts} {categories} onEdit={startEdit} onDeleted={fetchDiscounts} />
{/if}
