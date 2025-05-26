<script lang="ts">
	import { enhance } from '$app/forms';
	type Category = { id: number; name: string };
	let {
		categoryId,
		minQuantity,
		percentage,
		categories,
		onCreated
	}: {
		categoryId: string;
		minQuantity: string;
		percentage: string;
		categories: Category[];
		onCreated?: () => void | Promise<void>;
	} = $props();

	// Validación simple
	let isValid = $derived(
		categoryId &&
			minQuantity &&
			percentage &&
			Number(minQuantity) > 0 &&
			Number(percentage) >= 0 &&
			Number(percentage) <= 100
	);
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<form
		class="space-y-3"
		method="POST"
		action="?/discount_create"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					categoryId = '';
					minQuantity = '';
					percentage = '';
					if (onCreated) await onCreated();
				}
			};
		}}
	>
		<h3 class="mb-2 text-lg font-bold text-blue-900">Nuevo descuento</h3>
		<div>
			<label for="discount-category" class="mb-1 block text-sm font-semibold">Categoría</label>
			<select
				id="discount-category"
				class="w-full rounded border px-3 py-2"
				name="category_id"
				bind:value={categoryId}
			>
				<option value="">Seleccionar...</option>
				{#each categories as cat (cat.id)}
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
			class="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={!isValid}
		>
			Guardar
		</button>
	</form>
</div>
