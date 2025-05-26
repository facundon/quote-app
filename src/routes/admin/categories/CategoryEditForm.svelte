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
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<h3 class="mb-2 text-lg font-bold text-blue-900">Editar {name}</h3>
	<form
		class="space-y-3"
		method="POST"
		action="?/category_edit"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success' && onEdited) await onEdited();
			};
		}}
	>
		<input type="hidden" name="id" value={id} />
		<div>
			<label class="mb-1 block text-sm font-semibold">Nombre</label>
			<input
				type="text"
				class="w-full rounded border px-3 py-2"
				placeholder="Nombre de la categoría"
				name="name"
				bind:value={name}
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-semibold">Precio unitario</label>
			<input
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
			class="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
		>
			Actualizar
		</button>
		<button type="button" class="ml-2 text-slate-500 hover:underline" onclick={onCancel}>
			Cancelar
		</button>
	</form>
</div>
