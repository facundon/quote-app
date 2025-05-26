<script lang="ts">
	import type { Category } from './types';
	type CategoryDiscount = {
		category_id: number;
		min_quantity: number | null;
		percentage: number;
		applied: boolean;
		amount: number;
		category_name: string;
	};
	let {
		data,
		categoryQuantities,
		categoryDiscounts,
		handleInputChange,
		selectAll
	}: {
		data: { categories: Category[] };
		categoryQuantities: Record<number, number>;
		categoryDiscounts: CategoryDiscount[];
		handleInputChange: (e: Event, categoryId: number) => void;
		selectAll: (e: Event) => void;
	} = $props();
</script>

<div class="mt-2 mb-8 rounded-xl bg-blue-50/60 p-4">
	<h3 class="mb-6 border-b-4 border-blue-400 pb-2 text-2xl font-extrabold text-blue-900">
		Categorías
	</h3>
	<ul class="divide-y divide-slate-200">
		{#each data.categories as cat: Category (cat.id)}
			{@const d = categoryDiscounts.find((x: CategoryDiscount) => x.category_id === cat.id)}
			{@const unitDiscount = d && d.applied ? d.amount / (categoryQuantities[cat.id] || 1) : 0}
			{@const unitFinal = cat.unit_price - unitDiscount}
			<li class="flex items-center gap-2 py-2">
				<span class="flex-1 font-medium">{cat.name}</span>
				{#if d && d.applied && unitDiscount > 0}
					<span class="text-xs text-red-400 line-through">${cat.unit_price.toFixed(2)}</span>
					<span class="ml-1 text-xs font-bold text-green-700">${unitFinal.toFixed(2)} c/u</span>
				{:else}
					<span class="text-xs text-slate-500">${cat.unit_price.toFixed(2)} c/u</span>
				{/if}
				<input
					type="number"
					min="0"
					bind:value={categoryQuantities[cat.id]}
					oninput={(e: Event) => handleInputChange(e, cat.id)}
					onfocus={selectAll}
					onclick={selectAll}
					class="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
				/>
			</li>
		{/each}
	</ul>
</div>
