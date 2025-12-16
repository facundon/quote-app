<script lang="ts">
	import InstructionColumn from '../../instructions/components/InstructionColumn.svelte';
	import InstructionCreateForm from '../../instructions/components/InstructionCreateForm.svelte';
	import InstructionEditForm from '../../instructions/components/InstructionEditForm.svelte';
	// No modal/button here to match admin UX
	import type { Instruction } from '$lib/server/db/schema';
	import { invalidateAll } from '$app/navigation';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import {
		ALL_INSTRUCTION_CATEGORIES,
		buildAvailableCategories,
		DEFAULT_COLUMN_CATEGORIES,
		formatInstructionCategoryName
	} from '../../instructions/categories';

	let { instructions: initialInstructions }: { instructions: Instruction[] } = $props();

	let instructions = $state<Instruction[]>([...initialInstructions]);
	$effect(() => {
		instructions = [...initialInstructions];
	});

	const COLUMN_INDEXES = [0, 1] as const;
	let columnCategories = $state<string[]>([...DEFAULT_COLUMN_CATEGORIES]);
	let availableCategories = $derived.by(() =>
		buildAvailableCategories(instructions.map((i) => i.category))
	);

	function optionsForColumn(index: 0 | 1): string[] {
		const otherIndex = index === 0 ? 1 : 0;
		const current = columnCategories[index] || DEFAULT_COLUMN_CATEGORIES[index];
		const other = columnCategories[otherIndex] || DEFAULT_COLUMN_CATEGORIES[otherIndex];
		return availableCategories.filter((c) => c === current || c !== other);
	}

	let editingInstruction = $state<Instruction | null>(null);
	let isSubmitting = $state(false);

	let selectedInstructions = $state<Set<number>>(new Set());

	function startEdit(instruction: Instruction) {
		editingInstruction = instruction;
	}

	function cancelEdit() {
		editingInstruction = null;
		isSubmitting = false;
	}

	async function handleFormResult(result: ActionResult) {
		// Children handle toasts; parent only refreshes and exits edit mode
		if (result.type === 'success') {
			await invalidateAll();
			cancelEdit();
		}
		isSubmitting = false;
	}

	function toggleSelection(id: number) {
		if (selectedInstructions.has(id)) selectedInstructions.delete(id);
		else selectedInstructions.add(id);
		selectedInstructions = new Set(selectedInstructions);
	}

	function resetColumnsToDefault() {
		columnCategories = [...DEFAULT_COLUMN_CATEGORIES];
	}

	function setColumnCategory(index: number, next: string) {
		const otherIndex = index === 0 ? 1 : 0;
		const nextCategories = columnCategories.map((c, i) => (i === index ? next : c));

		// Keep columns unique
		if (nextCategories[otherIndex] === next) {
			nextCategories[otherIndex] = availableCategories.find((c) => c !== next) ?? next;
		}

		columnCategories = nextCategories;
	}

	let instructionsByCategory = $derived.by(() => {
		const grouped: Record<string, Instruction[]> = {};
		for (const cat of availableCategories) grouped[cat] = [];
		for (const i of instructions) (grouped[i.category] ||= []).push(i);
		return grouped;
	});
</script>

<div class="space-y-4">
	<h3 class="text-xl font-bold text-blue-900">Instrucciones</h3>

	{#if editingInstruction}
		<InstructionEditForm
			instruction={editingInstruction}
			{isSubmitting}
			defaultCategories={[...ALL_INSTRUCTION_CATEGORIES]}
			onCancel={cancelEdit}
			onFormResult={handleFormResult}
			onSubmitStart={() => (isSubmitting = true)}
		/>
	{:else}
		<InstructionCreateForm
			{isSubmitting}
			defaultCategories={[...ALL_INSTRUCTION_CATEGORIES]}
			onCancel={() => {}}
			onFormResult={handleFormResult}
			onSubmitStart={() => (isSubmitting = true)}
		/>
	{/if}

	<!-- Controles de columnas -->
	{#if !editingInstruction}
		<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="flex flex-wrap items-center gap-4">
					{#each COLUMN_INDEXES as columnIndex (columnIndex)}
						{@const current =
							columnCategories[columnIndex] || DEFAULT_COLUMN_CATEGORIES[columnIndex]}
						<label class="flex items-center gap-2 text-sm text-gray-700">
							<span class="font-medium">Columna {columnIndex + 1}</span>
							<select
								class="w-44 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
								value={current}
								onchange={(e) =>
									setColumnCategory(columnIndex, (e.currentTarget as HTMLSelectElement).value)}
							>
								{#each optionsForColumn(columnIndex) as opt (opt)}
									<option value={opt}>{formatInstructionCategoryName(opt)}</option>
								{/each}
							</select>
						</label>
					{/each}
				</div>

				<ActionButton variant="secondary" onclick={resetColumnsToDefault}>
					Restablecer por defecto
				</ActionButton>
			</div>
		</div>
	{/if}

	{#if !editingInstruction}
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			{#each COLUMN_INDEXES as columnIndex (columnIndex)}
				{@const category = columnCategories[columnIndex] || DEFAULT_COLUMN_CATEGORIES[columnIndex]}
				<InstructionColumn
					{category}
					instructions={instructionsByCategory[category] || []}
					{selectedInstructions}
					onToggleSelection={toggleSelection}
					onEdit={startEdit}
					onFormResult={handleFormResult}
					onCreateNew={undefined}
					enableReorder={true}
					showActions={true}
					showSelection={false}
					showSearch={category === 'obras_sociales'}
				/>
			{/each}
		</div>
	{/if}
</div>
