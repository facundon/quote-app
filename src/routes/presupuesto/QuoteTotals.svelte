<script lang="ts">
	type CategoryDiscount = {
		category_id: number;
		min_quantity: number | null;
		percentage: number;
		applied: boolean;
		amount: number;
		category_name: string;
	};

	let {
		total,
		categoryDiscounts,
		formatNumber,
		finalTotal
	}: {
		total: number;
		categoryDiscounts: CategoryDiscount[];
		formatNumber: (n: number) => string;
		finalTotal: number;
	} = $props();
</script>

<div
	class="mt-8 flex flex-col gap-2 rounded-lg border-t-4 border-blue-400 bg-slate-50 px-4 pt-8 shadow-inner"
>
	<div class="mb-2 flex flex-col items-end gap-2">
		<div class="mb-1 w-full">
			<div class="flex w-full items-center gap-2">
				<span class="text-base text-slate-700">Subtotal</span>
				<span class="flex-grow"></span>
				<span class="rounded-full bg-slate-100 px-2 py-0.5 text-base font-bold text-blue-900"
					>${formatNumber(total)}</span
				>
			</div>
			<div class="mt-1 w-full border-b border-dotted border-gray-300"></div>
		</div>
		{#if categoryDiscounts.some((d: CategoryDiscount) => d.applied)}
			{#each categoryDiscounts as d: CategoryDiscount (d.category_id)}
				{#if d.applied}
					<div class="mb-1 w-full">
						<div class="flex w-full items-center gap-2">
							<span class="text-base font-semibold whitespace-nowrap text-green-700"
								>Descuento {d.category_name}</span
							>
							<span class="flex-grow"></span>
							<span class="font-semibold whitespace-nowrap text-red-500"
								>- ${formatNumber(d.amount)}</span
							>
						</div>
						<div class="mt-1 w-full border-b border-dotted border-gray-300"></div>
					</div>
				{/if}
			{/each}
		{/if}
	</div>
	<div class="mt-2 mb-2 flex flex-col items-center justify-center">
		<span class="text-xl font-extrabold text-blue-900">Total</span>
		<span class="text-4xl font-extrabold tracking-tight text-blue-900"
			>${formatNumber(finalTotal)}</span
		>
	</div>
</div>
