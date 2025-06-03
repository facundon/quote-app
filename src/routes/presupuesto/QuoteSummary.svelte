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
		formatInt,
		formatNumber,
		showSummary,
		toggleSummary
	}: {
		data: { categories: Category[] };
		categoryQuantities: Record<number, number>;
		categoryDiscounts: CategoryDiscount[];
		formatInt: (n: number) => string;
		formatNumber: (n: number) => string;
		showSummary: boolean;
		toggleSummary: () => void;
	} = $props();
</script>

{#if Object.values(categoryQuantities).some((q: number) => q > 0)}
	<div class="mt-6 mb-2">
		<div class="mb-2 flex items-center gap-1">
			<h3 class="text-lg font-bold text-blue-900">Resumen</h3>
			<button
				type="button"
				class="ml-1 flex items-center p-0 text-blue-700 transition hover:text-blue-900"
				onclick={toggleSummary}
				aria-expanded={showSummary}
				aria-controls="summary-panel"
				aria-label="Mostrar/ocultar resumen"
			>
				<svg
					class="h-5 w-5 transition-transform duration-200"
					style:transform={showSummary ? 'rotate(90deg)' : 'rotate(0deg)'}
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
					><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg
				>
			</button>
		</div>
		<div
			id="summary-panel"
			class="overflow-hidden transition-all duration-300"
			style={`height: ${showSummary ? 'auto' : '0'}; padding-top: ${showSummary ? '0.5rem' : '0'}; padding-bottom: ${showSummary ? '0.5rem' : '0'}; margin-bottom: ${showSummary ? '0.5rem' : '0'};`}
		>
			{#if showSummary}
				<ul class="divide-y divide-slate-200">
					{#each data.categories as cat: Category (cat.id)}
						{#if categoryQuantities[cat.id] > 0}
							{@const d = categoryDiscounts.find((x: CategoryDiscount) => x.category_id === cat.id)}
							{@const unitDiscount =
								d && d.applied && categoryQuantities[cat.id] > 0
									? d.amount / categoryQuantities[cat.id]
									: 0}
							{@const unitFinal = cat.unit_price - unitDiscount}
							<li class="flex min-h-8 items-center gap-2 py-1 text-sm text-slate-700">
								<span class="min-w-0 flex-1 truncate font-medium">{cat.name}</span>
								<span class="ml-2 text-xs whitespace-nowrap text-slate-500">
									{formatInt(categoryQuantities[cat.id])} x ${formatNumber(unitFinal)} =
									<span class="font-semibold">
										${formatNumber(unitFinal * categoryQuantities[cat.id])}
									</span>
								</span>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}
