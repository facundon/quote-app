<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import EmployeeSelect from '$lib/components/EmployeeSelect.svelte';
	import { enhance } from '$app/forms';
	import type { Ticket } from '../utils';

	let {
		show = $bindable(false),
		onClose,
		ticket,
		employees = [] as string[],
		prioridadOptions = [] as { value: string; icon: string; label: string }[],
		statusOptions = [] as { value: string; icon: string; label: string }[],
		onSuccess
	}: {
		show?: boolean;
		onClose: () => void;
		ticket: Ticket;
		employees: string[];
		prioridadOptions: { value: string; icon: string; label: string }[];
		statusOptions: { value: string; icon: string; label: string }[];
		onSuccess: () => void;
	} = $props();

	let isSubmitting = $state(false);
</script>

<Modal title={`✏️ Editar Ticket #${ticket.id}`} {show} {onClose} size="medium">
	<form
		method="POST"
		action="?/edit"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ result }) => {
				isSubmitting = false;
				if (result.type === 'success') {
					onSuccess();
					onClose();
				}
			};
		}}
	>
		<input type="hidden" name="id" value={ticket.id} />

		<div class="space-y-6">
			<div>
				<label for="edit-title" class="mb-2 block text-sm font-medium text-gray-700"
					>📝 Título *</label
				>
				<input
					type="text"
					id="edit-title"
					name="title"
					value={ticket.title}
					required
					class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="edit-assignee" class="mb-2 block text-sm font-medium text-gray-700"
					>👤 Asignar a *</label
				>
				<EmployeeSelect
					id="edit-assignee"
					name="assignee"
					required={true}
					{employees}
					value={ticket.assignee || ''}
					placeholder="Seleccionar empleado"
				/>
			</div>

			<div>
				<label for="edit-description" class="mb-2 block text-sm font-medium text-gray-700"
					>📄 Descripción</label
				>
				<textarea
					id="edit-description"
					name="description"
					value={ticket.description}
					rows="4"
					class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				></textarea>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="edit-priority" class="mb-2 block text-sm font-medium text-gray-700"
						>⚡ Prioridad</label
					>
					<select
						id="edit-priority"
						name="priority"
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						{#each prioridadOptions as option}
							<option value={option.value} selected={option.value === ticket.priority}
								>{option.icon} {option.label}</option
							>
						{/each}
					</select>
				</div>

				<div>
					<label for="edit-status" class="mb-2 block text-sm font-medium text-gray-700"
						>🔄 Estado</label
					>
					<select
						id="edit-status"
						name="status"
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						{#each statusOptions as option}
							<option value={option.value} selected={option.value === ticket.status}
								>{option.icon} {option.label}</option
							>
						{/each}
					</select>
				</div>
			</div>

			{#if ticket.completed_at}
				<div class="rounded-lg border border-green-200 bg-green-50 p-4">
					<div class="flex items-center">
						<span class="mr-2 text-green-500">✅</span>
						<span class="text-sm font-medium text-green-800"
							>Completado el {ticket.completed_at}</span
						>
					</div>
				</div>
			{/if}
		</div>

		<div class="mt-8 flex justify-end space-x-3">
			<ActionButton onclick={onClose} variant="secondary">Cancelar</ActionButton>
			<ActionButton type="submit" variant="primary" disabled={isSubmitting}>
				{isSubmitting ? '⏳ Guardando...' : '💾 Guardar Cambios'}
			</ActionButton>
		</div>
	</form>
</Modal>
