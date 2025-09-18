<script lang="ts">
	import { enhance } from '$app/forms';
	import InstructionCard from './InstructionCard.svelte';
	import type { Instruction } from '$lib/server/db/schema';
	import { toastHelpers } from '$lib/utils/toast.js';

	let {
		category,
		instructions,
		selectedInstructions,
		onToggleSelection,
		onEdit,
		onFormResult,
		onCreateNew,
		enableReorder = true,
		showActions = true,
		showSelection = true
	}: {
		category: string;
		instructions: Instruction[];
		selectedInstructions: Set<number>;
		onToggleSelection: (id: number) => void;
		onEdit?: (instruction: Instruction) => void;
		onFormResult?: (result: any) => void;
		onCreateNew?: () => void;
		enableReorder?: boolean;
		showActions?: boolean;
		showSelection?: boolean;
	} = $props();

	// State for drag and drop
	let draggedInstruction: Instruction | null = $state(null);
	let dropZoneActive = $state(false);
	let reorderedInstructions = $state([...instructions]);
	let isSubmitting = $state(false);
	let insertIndex = $state(-1);

	// Selection controls are rendered globally above the grid

	// Reactive: update reordered instructions when props change
	$effect(() => {
		reorderedInstructions = [...instructions];
	});

	// Función para formatear nombres de categorías
	function formatCategoryName(str: string) {
		const categoryNames: Record<string, string> = {
			estudios: 'Estudios',
			obras_sociales: 'Obras Sociales'
		};
		return categoryNames[str] || str.charAt(0).toUpperCase() + str.slice(1);
	}

	function handleDragStart(instruction: Instruction) {
		draggedInstruction = instruction;
	}

	function handleDragEnd() {
		draggedInstruction = null;
		dropZoneActive = false;
		insertIndex = -1;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (!draggedInstruction) return;

		dropZoneActive = true;

		// Calculate insertion index for visual feedback
		const dropZone = event.currentTarget as HTMLElement;
		const rect = dropZone.getBoundingClientRect();
		const y = event.clientY - rect.top;

		const cards = Array.from(dropZone.querySelectorAll('[data-instruction-id]')) as HTMLElement[];
		let newInsertIndex = reorderedInstructions.length;

		for (let i = 0; i < cards.length; i++) {
			const cardRect = cards[i].getBoundingClientRect();
			const cardY = cardRect.top - rect.top;
			const cardHeight = cardRect.height;
			const cardCenter = cardY + cardHeight / 2;

			if (y < cardCenter) {
				newInsertIndex = i;
				break;
			}
		}

		insertIndex = newInsertIndex;
	}

	function handleDragLeave(event: DragEvent) {
		// Only hide drop zone if we're actually leaving the container
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;

		if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
			dropZoneActive = false;
			insertIndex = -1;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dropZoneActive = false;

		if (!draggedInstruction || insertIndex === -1) return;

		const draggedId = draggedInstruction.id;
		const draggedIndex = reorderedInstructions.findIndex((i) => i.id === draggedId);
		if (draggedIndex === -1) return;

		let targetIndex = insertIndex;

		// Adjust target index if dragging downward
		if (draggedIndex < targetIndex) {
			targetIndex--;
		}

		if (draggedIndex === targetIndex) {
			insertIndex = -1;
			return;
		}

		// Reorder the instructions
		const newInstructions = [...reorderedInstructions];
		const [draggedItem] = newInstructions.splice(draggedIndex, 1);
		newInstructions.splice(targetIndex, 0, draggedItem);

		reorderedInstructions = newInstructions;
		insertIndex = -1;

		// Save the new order
		saveOrder();
	}

	async function saveOrder() {
		if (isSubmitting) return;

		isSubmitting = true;
		const instructionIds = reorderedInstructions.map((i) => i.id);

		try {
			const response = await fetch('?/instruction_reorder', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams({
					instructionIds: JSON.stringify(instructionIds),
					category: category
				})
			});

			const result = await response.json();
			toastHelpers.itemUpdated('Orden de instrucciones');
			onFormResult?.({ type: 'success', data: result });
		} catch (error) {
			toastHelpers.updateError('Orden de instrucciones', 'Error al reordenar instrucciones');
			onFormResult?.({ type: 'error', data: { error: 'Error al reordenar instrucciones' } });
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
	<!-- Header de categoría -->
	<div class="border-b border-gray-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900">
				{formatCategoryName(category)}
				<span class="ml-2 text-sm font-normal text-gray-500">
					({reorderedInstructions.length})
				</span>
			</h2>
		</div>
	</div>

	<!-- Lista de instrucciones -->
	<div
		class="divide-y divide-gray-200"
		ondragover={enableReorder ? handleDragOver : undefined}
		ondragleave={enableReorder ? handleDragLeave : undefined}
		ondrop={enableReorder ? handleDrop : undefined}
		role="list"
		aria-label="Lista de instrucciones de {formatCategoryName(category)}"
	>
		{#if reorderedInstructions.length > 0}
			{#each reorderedInstructions as instruction, index (instruction.id)}
				<!-- Insert line above if this is the insertion point -->
				{#if enableReorder && insertIndex === index && draggedInstruction && draggedInstruction.id !== instruction.id}
					<div class="relative mx-4 h-0.5 bg-indigo-400/70"></div>
				{/if}

				<div data-instruction-id={instruction.id}>
					<InstructionCard
						{instruction}
						isSelected={selectedInstructions.has(instruction.id)}
						isDragging={draggedInstruction?.id === instruction.id}
						{onToggleSelection}
						{onEdit}
						{onFormResult}
						onDragStart={enableReorder ? handleDragStart : undefined}
						onDragEnd={enableReorder ? handleDragEnd : undefined}
						enableDrag={enableReorder}
						{showActions}
						{showSelection}
					/>
				</div>
			{/each}

			{#if enableReorder && insertIndex === reorderedInstructions.length && draggedInstruction}
				<div class="relative mx-4 h-0.5 bg-indigo-400/70"></div>
			{/if}
		{:else}
			<div class="p-8 text-center text-gray-500">
				<div class="mb-4 text-4xl">📝</div>
				<p class="text-sm">No hay instrucciones en {formatCategoryName(category)}</p>
				{#if onCreateNew}
					<button
						onclick={onCreateNew}
						class="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
					>
						Crear la primera instrucción
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
