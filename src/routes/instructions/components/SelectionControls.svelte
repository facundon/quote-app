<script lang="ts">
	import ActionButton from '$lib/components/ActionButton.svelte';

	let {
		totalInstructions,
		selectedCount,
		selectAll,
		onToggleSelectAll,
		onCopySelected,
		isSubmitting
	}: {
		totalInstructions: number;
		selectedCount: number;
		selectAll: boolean;
		onToggleSelectAll: () => void;
		onCopySelected: () => void;
		isSubmitting: boolean;
	} = $props();
</script>

{#if totalInstructions > 0}
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
		<div class="flex items-center justify-between">
			<div class="flex items-center space-x-4">
				<label class="flex cursor-pointer items-center space-x-2">
					<input
						type="checkbox"
						checked={selectAll}
						onchange={onToggleSelectAll}
						class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
					/>
					<span class="text-sm font-medium text-gray-700">
						Seleccionar todo ({selectedCount} de {totalInstructions})
					</span>
				</label>
			</div>

			{#if selectedCount > 0}
				<ActionButton onclick={onCopySelected} variant="primary" disabled={isSubmitting}>
					📋 Copiar Seleccionadas ({selectedCount})
				</ActionButton>
			{/if}
		</div>
	</div>
{/if}
