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
			<ul class="divide-y">
				{#each discounts
					.filter((d) => d.category_id === cat.id)
					.sort((a, b) => a.min_quantity - b.min_quantity) as discount}
					<li class="flex items-center justify-between py-2">
						<span>
							Mínimo: {discount.min_quantity}u, {discount.percentage}%
						</span>
						<div>
							<button class="mr-2 text-blue-600 hover:underline" onclick={() => onEdit(discount)}>
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
									class="text-red-600 hover:underline"
									type="submit"
									onclick={(event) => {
										if (!confirm('¿Eliminar este descuento?')) event.preventDefault();
									}}
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
