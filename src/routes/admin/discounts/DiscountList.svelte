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
</script>

{#each categories as cat}
	{#if discounts.filter((d) => d.category_id === cat.id).length > 0}
		<div class="mt-6">
			<h4 class="mb-2 border-b border-blue-200 pb-1 text-base font-bold text-blue-800">
				{cat.name}
			</h4>
			<ul class="space-y-2">
				{#each discounts
					.filter((d) => d.category_id === cat.id)
					.sort((a, b) => a.min_quantity - b.min_quantity) as discount}
					<li class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2 shadow-sm">
						<div class="flex items-baseline gap-2">
							<span class="text-sm font-bold text-slate-800">{discount.min_quantity}</span>
							<span class="text-xs font-semibold text-slate-500">unidades o más</span>
							<span
								class="ml-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700"
								>{discount.percentage}%</span
							>
						</div>
						<div class="flex items-center gap-2">
							<button
								class="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
								title="Editar"
								onclick={() => onEdit(discount)}
							>
								<svg
									class="h-4 w-4"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z"
									/></svg
								>
								Editar
							</button>
							<form
								method="POST"
								action="?/discount_delete"
								style="display:inline"
								use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success' && onDeleted) await onDeleted();
									};
								}}
							>
								<input type="hidden" name="id" value={discount.id} />
								<button
									class="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
									type="submit"
									title="Eliminar"
									onclick={(event) => {
										if (!confirm('¿Eliminar este descuento?')) event.preventDefault();
									}}
								>
									<svg
										class="h-4 w-4"
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
									Eliminar
								</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/each}
