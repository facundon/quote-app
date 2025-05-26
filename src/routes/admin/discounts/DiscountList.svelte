<script lang="ts">
	import { enhance } from '$app/forms';
	type Category = { id: number; name: string };
	type Discount = { id: number; category_id: number; min_quantity: number; percentage: number };
	let {
		discounts,
		categories,
		onEdit,
		onDeleted
	}: {
		discounts: Discount[];
		categories: Category[];
		onEdit: (discount: Discount) => void;
		onDeleted?: () => void | Promise<void>;
	} = $props();

	function getMinMax(discounts: Discount[]) {
		if (discounts.length === 0) return { min: 0, max: 1 };
		const min = Math.min(...discounts.map((d) => d.min_quantity));
		const max = Math.max(...discounts.map((d) => d.min_quantity));
		return { min, max: max === min ? min + 1 : max };
	}

	const categoryDiscounts = $derived(
		categories.map((cat) => {
			const catDiscounts = discounts
				.filter((d) => d.category_id === cat.id)
				.sort((a, b) => a.min_quantity - b.min_quantity);
			const minmax = getMinMax(catDiscounts);
			return { cat, catDiscounts, minmax };
		})
	);

	function getDiscountColor(percentage: number) {
		if (percentage <= 30) {
			return `hsl(50, 90%, 45%)`;
		}
		const t = (Math.min(percentage, 100) - 30) / 70;
		const hue = 50 + (140 - 50) * t;
		return `hsl(${hue}, 90%, 45%)`;
	}
</script>

{#each categoryDiscounts as { cat, catDiscounts } (cat.id)}
	{#if catDiscounts.length > 0}
		<div class="mt-8">
			<h4 class="mb-8 border-b border-blue-200 pb-1 text-base font-bold text-blue-800">
				{cat.name}
			</h4>
			<div class="relative flex h-14 w-full flex-col items-stretch">
				<div
					class="absolute top-10 right-0 left-0 z-0 h-1 -translate-y-1/2 rounded-full bg-blue-200"
				></div>
				<div
					class="relative z-10 flex w-full flex-1 items-center justify-between"
					style="height: 100%"
				>
					{#each catDiscounts as discount (discount.id)}
						<div class="flex w-20 min-w-0 flex-col items-center justify-center">
							<span
								class="mb-1 truncate rounded bg-slate-800 px-1.5 py-0.5 text-center text-xs font-semibold whitespace-nowrap text-white shadow-lg"
							>
								{discount.min_quantity} unidades
							</span>
							<div class="group relative">
								<button
									type="button"
									class="flex flex-col items-center focus:outline-none"
									onclick={() => onEdit(discount)}
									title="Editar descuento"
									aria-label="Editar descuento {discount.percentage}% para {discount.min_quantity} unidades"
								>
									<span
										class="flex h-10 w-18 cursor-pointer items-center justify-center rounded-full border-4 border-white text-sm font-bold text-white shadow-lg transition-colors hover:brightness-110"
										style="background: {getDiscountColor(discount.percentage)}"
									>
										{discount.percentage}%
									</span>
								</button>
								<form
									method="POST"
									action="?/discount_delete"
									use:enhance={() => {
										return async ({ result }) => {
											if (result.type === 'success' && onDeleted) await onDeleted();
										};
									}}
									class="absolute -right-1 -bottom-1 opacity-0 transition-opacity group-hover:opacity-100"
									style="z-index:2"
								>
									<input type="hidden" name="id" value={discount.id} />
									<button
										type="submit"
										class="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs text-red-700 shadow hover:bg-red-200 hover:text-red-900"
										title="Eliminar descuento"
										aria-label="Eliminar descuento {discount.percentage}% para {discount.min_quantity} unidades"
										onclick={(event) => {
											if (!confirm('¿Eliminar este descuento?')) event.preventDefault();
										}}
									>
										<svg
											class="h-3 w-3"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M6 18L18 6M6 6l12 12"
											/></svg
										>
									</button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
{/each}
