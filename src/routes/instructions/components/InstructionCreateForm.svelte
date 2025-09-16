<script lang="ts">
	import { enhance } from '$app/forms';
	import ActionButton from '$lib/components/ActionButton.svelte';

	let {
		isSubmitting,
		defaultCategories,
		onCancel,
		onFormResult,
		onSubmitStart
	}: {
		isSubmitting: boolean;
		defaultCategories: string[];
		onCancel: () => void;
		onFormResult: (result: any) => void;
		onSubmitStart?: () => void;
	} = $props();

	// Función para formatear nombres de categorías
	function formatCategoryName(str: string) {
		const categoryNames: Record<string, string> = {
			estudios: 'Estudios',
			obras_sociales: 'Obras Sociales'
		};
		return categoryNames[str] || str.charAt(0).toUpperCase() + str.slice(1);
	}
</script>

<form
	method="POST"
	action="?/instruction_create"
	use:enhance={() => {
		onSubmitStart?.();
		return async ({ result }) => {
			onFormResult(result);
		};
	}}
	class="space-y-4"
>
	<div>
		<label for="title" class="block text-sm font-medium text-gray-700"> Título </label>
		<input
			type="text"
			id="title"
			name="title"
			required
			class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="Título de la instrucción"
		/>
	</div>

	<div>
		<label for="category" class="block text-sm font-medium text-gray-700"> Categoría </label>
		<select
			id="category"
			name="category"
			required
			class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
		>
			<option value="">Seleccionar categoría</option>
			{#each defaultCategories as category}
				<option value={category}>{formatCategoryName(category)}</option>
			{/each}
		</select>
	</div>

	<div>
		<label for="description" class="block text-sm font-medium text-gray-700"> Descripción </label>
		<textarea
			id="description"
			name="description"
			rows="4"
			required
			class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="Descripción detallada de la instrucción"
		></textarea>
	</div>

	<div class="flex justify-end space-x-3 pt-4">
		<ActionButton type="button" onclick={onCancel} variant="secondary" disabled={isSubmitting}>
			Cancelar
		</ActionButton>
		<ActionButton type="submit" variant="primary" disabled={isSubmitting}>
			{isSubmitting ? 'Creando...' : 'Crear Instrucción'}
		</ActionButton>
	</div>
</form>
