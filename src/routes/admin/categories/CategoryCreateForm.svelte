<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	let {
		name,
		unitPrice,
		form,
		onCreated
	}: {
		name: string;
		unitPrice: string;
		form?: ActionResult | undefined;
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
			class="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
		>
			Guardar
		</button>
	</form>
</div>
