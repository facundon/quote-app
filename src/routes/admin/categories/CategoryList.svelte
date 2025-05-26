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
		onDeleted
	}: {
		categories: Category[];
		onEdit: (cat: Category) => void;
		onDeleted?: () => void | Promise<void>;
	} = $props();
</script>

<ul class="divide-y">
	{#each categories as cat}
		<li class="flex items-center justify-between py-2">
			<span>
				{cat.name}
				<span class="text-xs text-slate-500">
					(${cat.unit_price.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
				</span>
			</span>
			<div>
				<button class="mr-2 text-blue-600 hover:underline" onclick={() => onEdit(cat)}>
					Editar
				</button>
				<form
					method="POST"
					action="?/category_delete"
					style="display:inline"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success' && onDeleted) await onDeleted();
						};
					}}
				>
					<input type="hidden" name="id" value={cat.id} />
					<button
						class="text-red-600 hover:underline"
						type="submit"
						onclick={(event) => {
							if (!confirm('¿Eliminar esta categoría?')) event.preventDefault();
						}}
					>
						Eliminar
					</button>
				</form>
			</div>
		</li>
	{/each}
</ul>
