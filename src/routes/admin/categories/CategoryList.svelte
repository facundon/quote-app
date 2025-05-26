<script lang="ts">
	import { enhance } from '$app/forms';

	type Category = {
		id: number;
		name: string;
		unit_price: number;
	};

	let {
		categories,
		onEdit,
		onDeleted,
		studies = [],
		discounts = []
	}: {
		categories: Category[];
		onEdit: (cat: Category) => void;
		onDeleted?: () => void | Promise<void>;
		studies?: { category_id: number }[];
		discounts?: { category_id: number }[];
	} = $props();

	let error = $state('');
</script>

{#if error}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{error}</div>
{/if}
<ul class="space-y-2">
	{#each categories as cat (cat.id)}
		<li class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2 shadow-sm">
			<div class="flex items-baseline gap-2">
				<span class="text-sm font-semibold text-slate-800">{cat.name}</span>
				<span class="text-xs font-semibold text-slate-500"
					>(${cat.unit_price.toLocaleString('es-AR', { minimumFractionDigits: 2 })})</span
				>
			</div>
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
					title="Editar"
					onclick={() => onEdit(cat)}
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
				{#if !studies.some((s) => s.category_id === cat.id) && !discounts.some((d) => d.category_id === cat.id)}
					<form
						method="POST"
						action="?/category_delete"
						style="display:inline"
						use:enhance={() => {
							return async ({
								result
							}: {
								result: { type: string; data?: { error?: string } };
							}) => {
								if (result.type === 'success' && onDeleted) await onDeleted();
								else if (result.type === 'failure')
									error = result.data?.error || 'Error desconocido';
							};
						}}
					>
						<input type="hidden" name="id" value={cat.id} />
						<button
							class="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
							type="submit"
							onclick={(event) => {
								if (!confirm('¿Eliminar esta categoría?')) event.preventDefault();
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
				{/if}
			</div>
		</li>
	{/each}
</ul>
