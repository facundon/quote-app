<script lang="ts">
	import InstructionColumn from '../../instructions/components/InstructionColumn.svelte';
	import InstructionCreateForm from '../../instructions/components/InstructionCreateForm.svelte';
	import InstructionEditForm from '../../instructions/components/InstructionEditForm.svelte';
	// No modal/button here to match admin UX
	import type { Instruction } from '$lib/server/db/schema';
	import { invalidateAll } from '$app/navigation';

	let { instructions: initialInstructions }: { instructions: Instruction[] } = $props();

	const defaultCategories = ['estudios', 'obras_sociales'];

	let instructions = $state<Instruction[]>([...initialInstructions]);
	$effect(() => {
		instructions = [...initialInstructions];
	});

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

	async function handleFormResult(result: any) {
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

	function instructionsByCategory() {
		const grouped: Record<string, Instruction[]> = { estudios: [], obras_sociales: [] };
		for (const i of instructions) {
			(grouped[i.category] ||= []).push(i);
		}
		return grouped;
	}
</script>

<div class="space-y-4">
	<h3 class="text-xl font-bold text-blue-900">Instrucciones</h3>

	{#if editingInstruction}
		<InstructionEditForm
			instruction={editingInstruction}
			{isSubmitting}
			defaultCategories={['estudios', 'obras_sociales']}
			onCancel={cancelEdit}
			onFormResult={handleFormResult}
			onSubmitStart={() => (isSubmitting = true)}
		/>
	{:else}
		<InstructionCreateForm
			{isSubmitting}
			defaultCategories={['estudios', 'obras_sociales']}
			onCancel={() => {}}
			onFormResult={handleFormResult}
			onSubmitStart={() => (isSubmitting = true)}
		/>
	{/if}

	{#if !editingInstruction}
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			{#each defaultCategories as category}
				<InstructionColumn
					{category}
					instructions={instructionsByCategory()[category] || []}
					{selectedInstructions}
					onToggleSelection={toggleSelection}
					onEdit={startEdit}
					onFormResult={handleFormResult}
					onCreateNew={undefined}
					enableReorder={true}
					showActions={true}
					showSelection={false}
				/>
			{/each}
		</div>
	{/if}
</div>
