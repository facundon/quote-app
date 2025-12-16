<script lang="ts">
	import { enhance } from '$app/forms';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import type { Instruction } from '$lib/server/db/schema';
	import { toastHelpers } from '$lib/utils/toast.js';
	import type { ActionResult } from '@sveltejs/kit';
	import { formatInstructionCategoryName } from '../categories';

	let {
		instruction,
		isSubmitting,
		defaultCategories,
		onCancel,
		onFormResult,
		onSubmitStart
	}: {
		instruction: Instruction;
		isSubmitting: boolean;
		defaultCategories: readonly string[];
		onCancel: () => void;
		onFormResult: (result: ActionResult) => void;
		onSubmitStart?: () => void;
	} = $props();
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<form
		method="POST"
		action="?/instruction_edit"
		use:enhance={() => {
			onSubmitStart?.();
			return async ({ result }) => {
				if (result.type === 'success') {
					toastHelpers.itemUpdated('Instrucción');
				} else if (result.type === 'failure') {
					toastHelpers.updateError(
						'Instrucción',
						typeof result.data?.message === 'string'
							? result.data.message
							: 'Error al actualizar instrucción'
					);
				}
				onFormResult(result);
			};
		}}
		class="space-y-4"
	>
		<h3 class="mb-2 text-lg font-bold text-blue-900">Editar: {instruction.title}</h3>
		<input type="hidden" name="id" value={instruction.id} />

		<div>
			<label for="edit-title" class="block text-sm font-medium text-gray-700"> Título </label>
			<input
				type="text"
				id="edit-title"
				name="title"
				value={instruction.title}
				required
				class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			/>
		</div>

		<div>
			<label for="edit-category" class="block text-sm font-medium text-gray-700"> Categoría </label>
			<select
				id="edit-category"
				name="category"
				value={instruction.category}
				required
				class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			>
				{#each defaultCategories as category}
					<option value={category} selected={category === instruction.category}>
						{formatInstructionCategoryName(category)}
					</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="edit-description" class="block text-sm font-medium text-gray-700">
				Descripción
			</label>
			<textarea
				id="edit-description"
				name="description"
				rows="4"
				required
				class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				value={instruction.description}
			></textarea>
		</div>

		<div class="flex justify-end space-x-3 pt-4">
			<ActionButton type="button" onclick={onCancel} variant="secondary" disabled={isSubmitting}>
				Cancelar
			</ActionButton>
			<ActionButton type="submit" variant="primary" disabled={isSubmitting}>
				{isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
			</ActionButton>
		</div>
	</form>
</div>
