<script lang="ts">
	import { enhance } from '$app/forms';
	type Category = { id: number; name: string };
	let {
		id,
		categoryId,
		minQuantity,
		percentage,
		categories,
		onEdited,
		onCancel
	}: {
		id: number;
		categoryId: string;
		minQuantity: string;
		percentage: string;
		categories: Category[];
		onEdited?: () => void | Promise<void>;
		onCancel?: () => void;
	} = $props();
	let error = $state('');

	function handleEnhance() {
		return async ({ result }: { result: any }) => {
			if (result.type === 'success' && onEdited) {
				await onEdited();
			} else if (result.type === 'failure') {
				error = result.data?.error || 'Error desconocido';
			}
		};
	}
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<h3 class="mb-2 text-lg font-bold text-blue-900">Editar descuento</h3>
	{#if error}
		<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{error}</div>
	{/if}
	<form class="space-y-3" method="POST" action="?/discount_edit" use:enhance={handleEnhance}>
		<input type="hidden" name="id" value={id} />
		<div>
			<label for="discount-category" class="mb-1 block text-sm font-semibold">Categoría</label>
			<select
				id="discount-category"
				class="w-full rounded border px-3 py-2"
				name="category_id"
				bind:value={categoryId}
			>
				<option value="">Seleccionar...</option>
				{#each categories as cat}
					<option value={String(cat.id)}>{cat.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="discount-min-quantity" class="mb-1 block text-sm font-semibold"
				>Cantidad mínima</label
			>
			<input
				id="discount-min-quantity"
				type="number"
				class="w-full rounded border px-3 py-2"
				placeholder="Cantidad mínima"
				min="1"
				name="min_quantity"
				bind:value={minQuantity}
			/>
		</div>
		<div>
			<label for="discount-percentage" class="mb-1 block text-sm font-semibold"
				>Porcentaje (%)</label
			>
			<input
				id="discount-percentage"
				type="number"
				class="w-full rounded border px-3 py-2"
				placeholder="Porcentaje"
				min="0"
				max="100"
				step="0.01"
				name="percentage"
				bind:value={percentage}
			/>
		</div>
		<button
			type="submit"
			class="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
		>
			Actualizar
		</button>
		<button type="button" class="ml-2 text-slate-500 hover:underline" onclick={onCancel}>
			Cancelar
		</button>
	</form>
</div>
