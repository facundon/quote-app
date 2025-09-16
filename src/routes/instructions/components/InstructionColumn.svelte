<script lang="ts">
	import InstructionCard from './InstructionCard.svelte';
	import type { Instruction } from '$lib/server/db/schema';

	let {
		category,
		instructions,
		selectedInstructions,
		onToggleSelection,
		onEdit,
		onFormResult,
		onCreateNew
	}: {
		category: string;
		instructions: Instruction[];
		selectedInstructions: Set<number>;
		onToggleSelection: (id: number) => void;
		onEdit: (instruction: Instruction) => void;
		onFormResult: (result: any) => void;
		onCreateNew: () => void;
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

<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
	<!-- Header de categoría -->
	<div class="border-b border-gray-200 px-6 py-4">
		<h2 class="text-lg font-semibold text-gray-900">
			{formatCategoryName(category)}
			<span class="ml-2 text-sm font-normal text-gray-500">
				({instructions.length})
			</span>
		</h2>
	</div>

	<!-- Lista de instrucciones -->
	<div class="divide-y divide-gray-200">
		{#if instructions.length > 0}
			{#each instructions as instruction (instruction.id)}
				<InstructionCard
					{instruction}
					isSelected={selectedInstructions.has(instruction.id)}
					{onToggleSelection}
					{onEdit}
					{onFormResult}
				/>
			{/each}
		{:else}
			<div class="p-8 text-center text-gray-500">
				<div class="mb-4 text-4xl">📝</div>
				<p class="text-sm">No hay instrucciones en {formatCategoryName(category)}</p>
				<button
					onclick={onCreateNew}
					class="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
				>
					Crear la primera instrucción
				</button>
			</div>
		{/if}
	</div>
</div>
