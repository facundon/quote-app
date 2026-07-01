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

	function increment(categoryId: number) {
		categoryQuantities[categoryId] = (categoryQuantities[categoryId] || 0) + 1;
	}

	function decrement(categoryId: number) {
		categoryQuantities[categoryId] = Math.max(0, (categoryQuantities[categoryId] || 0) - 1);
	}
</script>

<div class="mt-2 mb-4 rounded-xl bg-blue-50/60 p-4">
	<h3 class="mb-6 border-b-4 border-blue-400 pb-2 text-2xl font-extrabold text-blue-900">
		Categorías
	</h3>
	<ul class="divide-y divide-slate-200">
		{#each data.categories as cat: Category (cat.id)}
			{@const d = categoryDiscounts.find((x: CategoryDiscount) => x.category_id === cat.id)}
			{@const unitDiscount = d && d.applied ? d.amount / (categoryQuantities[cat.id] || 1) : 0}
			{@const unitFinal = cat.unit_price - unitDiscount}
			<li class="flex items-center gap-2 py-2">
				<span class="flex-1 font-medium text-slate-700">{cat.name}</span>
				{#if d && d.applied && unitDiscount > 0}
					<span class="text-xs text-red-400 line-through">${cat.unit_price.toFixed(2)}</span>
					<span class="ml-1 text-xs font-bold text-green-700">${unitFinal.toFixed(2)} c/u</span>
				{:else}
					<span class="text-xs text-slate-500">${cat.unit_price.toFixed(2)} c/u</span>
				{/if}
				<div class="flex items-center gap-1">
					<input
						type="text"
						inputmode="numeric"
						bind:value={categoryQuantities[cat.id]}
						oninput={(e: Event) => handleInputChange(e, cat.id)}
						onfocus={selectAll}
						onclick={selectAll}
						onkeydown={(e: KeyboardEvent) => {
							if (e.key === 'ArrowUp') {
								increment(cat.id);
							}
							if (e.key === 'ArrowDown') {
								decrement(cat.id);
							}
						}}
						class="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
					/>
					<div class="flex flex-col gap-0">
						<button
							type="button"
							tabIndex={-1}
							onclick={() => increment(cat.id)}
							class="flex h-4 w-5 items-center justify-center rounded-t border border-b-0 border-slate-300 bg-slate-100 text-xs leading-none text-slate-600 transition hover:bg-slate-200"
						>
							▲
						</button>
						<button
							type="button"
							tabIndex={-1}
							onclick={() => decrement(cat.id)}
							class="flex h-4 w-5 items-center justify-center rounded-b border border-slate-300 bg-slate-100 text-xs leading-none text-slate-600 transition hover:bg-slate-200"
						>
							▼
						</button>
					</div>
				</div>
			</li>
		{/each}
	</ul>
</div>
