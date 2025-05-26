<script lang="ts">
	import { enhance } from '$app/forms';
	let {
		name,
		unitPrice,
		onCreated
	}: {
		name: string;
		unitPrice: string;
		onCreated?: () => void | Promise<void>;
	} = $props();

	let isValid = $derived(name && name.trim().length > 0);
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<form
		class="space-y-3"
		method="POST"
		action="?/category_create"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					name = '';
					unitPrice = '';
					if (onCreated) await onCreated();
				}
			};
		}}
	>
		<h3 class="mb-2 text-lg font-bold text-blue-900">Nueva categoría</h3>
		<div>
			<label for="category-name" class="mb-1 block text-sm font-semibold">Nombre</label>
			<input
				id="category-name"
				type="text"
				class="w-full rounded border px-3 py-2"
				placeholder="Nombre de la categoría"
				name="name"
				bind:value={name}
			/>
		</div>
		<div>
			<label for="category-unit-price" class="mb-1 block text-sm font-semibold"
				>Precio unitario</label
			>
			<input
				id="category-unit-price"
				type="number"
				class="w-full rounded border px-3 py-2"
				placeholder="Precio unitario"
				min="0"
				step="0.01"
				name="unit_price"
				bind:value={unitPrice}
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
