<script lang="ts">
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';
	import type { Instruction } from '$lib/server/db/schema';

	let {
		instruction,
		isSelected,
		onToggleSelection,
		onEdit,
		onFormResult
	}: {
		instruction: Instruction;
		isSelected: boolean;
		onToggleSelection: (id: number) => void;
		onEdit: (instruction: Instruction) => void;
		onFormResult: (result: any) => void;
	} = $props();
</script>

<div
	class="p-4 transition-colors duration-200 hover:bg-gray-50"
	in:fly={{ y: 20, duration: 300, delay: 100 }}
>
	<div class="flex items-start space-x-3">
		<!-- Checkbox de selección -->
		<input
			type="checkbox"
			checked={isSelected}
			onchange={() => onToggleSelection(instruction.id)}
			class="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
		/>

		<!-- Contenido de la instrucción -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center justify-between">
				<button
					class="flex-1 text-left text-sm font-medium text-gray-900 transition-colors hover:text-indigo-600"
					onclick={() => onToggleSelection(instruction.id)}
				>
					{instruction.title}
				</button>

				<!-- Menú de acciones -->
				<div class="ml-4 flex-shrink-0">
					<div class="flex items-center space-x-1">
						<button
							onclick={() => onEdit(instruction)}
							class="p-1 text-gray-400 transition-colors hover:text-indigo-600"
							title="Editar"
						>
							✏️
						</button>

						<form
							method="POST"
							action="?/instruction_delete"
							use:enhance={() => {
								return async ({ result }) => {
									onFormResult(result);
								};
							}}
							class="inline"
						>
							<input type="hidden" name="id" value={instruction.id} />
							<button
								type="submit"
								onclick={(e) => {
									if (!confirm('¿Estás seguro de que quieres eliminar esta instrucción?')) {
										e.preventDefault();
									}
								}}
								class="p-1 text-gray-400 transition-colors hover:text-red-600"
								title="Eliminar"
							>
								🗑️
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
