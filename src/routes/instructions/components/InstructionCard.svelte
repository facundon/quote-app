<script lang="ts">
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';
	import type { Instruction } from '$lib/server/db/schema';
	import { toastHelpers } from '$lib/utils/toast.js';

	let {
		instruction,
		isSelected,
		onToggleSelection,
		onEdit,
		onFormResult,
		onDragStart,
		onDragEnd,
		isDragging = false,
		showSelection = true,
		showActions = true,
		enableDrag = true
	}: {
		instruction: Instruction;
		isSelected: boolean;
		onToggleSelection: (id: number) => void;
		onEdit?: (instruction: Instruction) => void;
		onFormResult?: (result: any) => void;
		onDragStart?: (instruction: Instruction) => void;
		onDragEnd?: () => void;
		isDragging?: boolean;
		showSelection?: boolean;
		showActions?: boolean;
		enableDrag?: boolean;
	} = $props();

	function handleDragStart(event: DragEvent) {
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', instruction.id.toString());
		}
		onDragStart?.(instruction);
		didDrag = true;
	}

	function handleDragEnd() {
		onDragEnd?.();
		// reset drag flag after a tick to avoid click toggling on drop
		setTimeout(() => {
			didDrag = false;
		}, 0);
	}

	let didDrag = $state(false);

	function handleRowClick(event: MouseEvent) {
		if (didDrag) {
			didDrag = false;
			return;
		}
		const target = event.target as HTMLElement;
		if (
			target.closest('button') ||
			target.closest('input') ||
			target.closest('form') ||
			target.closest('a')
		) {
			return;
		}
		onToggleSelection(instruction.id);
	}
</script>

<div
	class="p-2 transition-colors duration-200 hover:bg-gray-50 {isDragging ? 'opacity-50' : ''}"
	in:fly={{ y: 20, duration: 300, delay: 100 }}
	draggable={enableDrag}
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	role="button"
	aria-label="Instrucción: {instruction.title}"
	tabindex="0"
	onclick={handleRowClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleRowClick(e as unknown as MouseEvent);
		}
	}}
>
	<div class="flex items-center space-x-3">
		<!-- Drag handle -->
		{#if enableDrag}
			<div
				class="flex h-5 w-5 flex-shrink-0 cursor-move items-center justify-center text-gray-400 hover:text-gray-600"
				title="Arrastrar para reordenar"
			>
				<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 6 10">
					<circle cx="2" cy="2" r="1" />
					<circle cx="2" cy="5" r="1" />
					<circle cx="2" cy="8" r="1" />
					<circle cx="4" cy="2" r="1" />
					<circle cx="4" cy="5" r="1" />
					<circle cx="4" cy="8" r="1" />
				</svg>
			</div>
		{/if}

		<!-- Checkbox de selección -->
		{#if showSelection}
			<div class="flex h-5 w-5 flex-shrink-0 items-center justify-center">
				<input
					type="checkbox"
					checked={isSelected}
					onchange={() => onToggleSelection(instruction.id)}
					class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
				/>
			</div>
		{/if}

		<!-- Contenido de la instrucción (solo título) -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center justify-between">
				<div class="min-w-0 flex-1">
					<button
						class="block w-full truncate text-left text-sm font-medium text-gray-900 transition-colors hover:text-indigo-600"
						onclick={() => onToggleSelection(instruction.id)}
					>
						{instruction.title}
					</button>
				</div>

				<!-- Menú de acciones -->
				{#if showActions}
					<div class="ml-3 flex-shrink-0">
						<div class="flex items-center justify-center space-x-2">
							<button
								onclick={() => onEdit?.(instruction)}
								class="rounded-md p-2 text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
								title="Editar"
								aria-label="Editar instrucción"
							>
								<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
									/>
								</svg>
							</button>

							<form
								method="POST"
								action="?/instruction_delete"
								use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success') {
											toastHelpers.itemDeleted('Instrucción');
										} else if (result.type === 'failure') {
											toastHelpers.deleteError(
												'Instrucción',
												typeof result.data?.message === 'string'
													? result.data.message
													: 'Error al eliminar instrucción'
											);
										}
										onFormResult?.(result);
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
									class="rounded-md p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
									title="Eliminar"
									aria-label="Eliminar instrucción"
								>
									<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</form>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
