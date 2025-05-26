<script lang="ts">
	import { enhance } from '$app/forms';

	let {
		id,
		name,
		unitPrice,
		onEdited,
		onCancel
	}: {
		id: number;
		name: string;
		unitPrice: string;
		onEdited?: () => void | Promise<void>;
		onCancel?: () => void;
	} = $props();
	let error = $state('');

	let isValid = $derived(name && name.trim().length > 0 && unitPrice && Number(unitPrice) >= 0);

	function handleEnhance() {
		return async ({ result }: { result: { type: string; data?: { error?: string } } }) => {
			if (result.type === 'success' && onEdited) {
				await onEdited();
			} else if (result.type === 'failure') {
				error = result.data?.error || 'Error desconocido';
			}
		};
	}
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<h3 class="mb-2 text-lg font-bold text-blue-900">Editar {name}</h3>
	{#if error}
		<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{error}</div>
	{/if}
	<form class="space-y-3" method="POST" action="?/category_edit" use:enhance={handleEnhance}>
		script
		<input type="hidden" name="id" value={id} />
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
			Actualizar
		</button>
		<button type="button" class="ml-2 text-slate-500 hover:underline" onclick={onCancel}>
			Cancelar
		</button>
	</form>
</div>
