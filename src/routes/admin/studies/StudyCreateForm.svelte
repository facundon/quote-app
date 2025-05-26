<script lang="ts">
	import { enhance } from '$app/forms';
	type Category = { id: number; name: string };
	let {
		name,
		categoryId,
		categories,
		onCreated
	}: {
		name: string;
		categoryId: string;
		categories: Category[];
		onCreated?: () => void | Promise<void>;
	} = $props();

	let isValid = $derived(name && name.trim().length > 0 && categoryId);
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<form
		class="space-y-3"
		method="POST"
		action="?/study_create"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					name = '';
					categoryId = '';
					if (onCreated) await onCreated();
				}
			};
		}}
	>
		<h3 class="mb-2 text-lg font-bold text-blue-900">Nuevo estudio</h3>
		<div>
			<label for="study-name" class="mb-1 block text-sm font-semibold">Nombre</label>
			<input
				id="study-name"
				type="text"
				class="w-full rounded border px-3 py-2"
				placeholder="Nombre del estudio"
				name="name"
				bind:value={name}
			/>
		</div>
		<div>
			<label for="study-category" class="mb-1 block text-sm font-semibold">Categoría</label>
			<select
				id="study-category"
				class="w-full rounded border px-3 py-2"
				name="category_id"
				bind:value={categoryId}
				required
			>
				<option value="">Seleccionar...</option>
				{#each categories as cat (cat.id)}
					<option value={String(cat.id)}>{cat.name}</option>
				{/each}
			</select>
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
