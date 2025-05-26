<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	type Category = { id: number; name: string };
	let {
		name,
		categoryId,
		categories,
		form,
		onCreated
	}: {
		name: string;
		categoryId: string;
		categories: Category[];
		form?: ActionResult;
		onCreated?: () => void | Promise<void>;
	} = $props();
</script>

{#if form?.type === 'failure'}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{form.data?.error}</div>
{/if}
{#if form?.type === 'success'}
	<div class="mb-2 rounded bg-green-100 px-3 py-2 text-green-700">{form.data?.message}</div>
{/if}
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
			Guardar
		</button>
	</form>
</div>
