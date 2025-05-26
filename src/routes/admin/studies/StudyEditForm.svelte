<script lang="ts">
	import { enhance } from '$app/forms';
	type Category = { id: number; name: string };
	let {
		id,
		name,
		categoryId,
		categories,
		onEdited,
		onCancel
	}: {
		id: number;
		name: string;
		categoryId: string;
		categories: Category[];
		onEdited?: () => void | Promise<void>;
		onCancel?: () => void;
	} = $props();
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<h3 class="mb-2 text-lg font-bold text-blue-900">Editar {name}</h3>
	<form
		class="space-y-3"
		method="POST"
		action="?/study_edit"
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
				placeholder="Nombre del estudio"
				name="name"
				bind:value={name}
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-semibold">Categoría</label>
			<select class="w-full rounded border px-3 py-2" name="category_id" bind:value={categoryId}>
				<option value="">Seleccionar...</option>
				{#each categories as cat}
					<option value={String(cat.id)}>{cat.name}</option>
				{/each}
			</select>
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
