<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import EmployeeSelect from '$lib/components/EmployeeSelect.svelte';
	import { enhance } from '$app/forms';

	let {
		show = $bindable(false),
		onClose,
		employees = [] as string[],
		prioridadOptions = [] as { value: string; icon: string; label: string }[],
		onSuccess
	}: {
		show?: boolean;
		onClose: () => void;
		employees: string[];
		prioridadOptions: { value: string; icon: string; label: string }[];
		onSuccess: () => void;
	} = $props();

	let isSubmitting = $state(false);
</script>

<Modal title="✨ Crear Nuevo Ticket" {show} {onClose} size="medium">
	<form
		method="POST"
		action="?/create"
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
		<div class="space-y-6">
			<div>
				<label for="title" class="mb-2 block text-sm font-medium text-gray-700">📝 Título *</label>
				<input
					type="text"
					id="title"
					name="title"
					required
					class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					placeholder="Describe el problema o tarea en pocas palabras"
				/>
			</div>

			<div>
				<label for="assignee" class="mb-2 block text-sm font-medium text-gray-700"
					>👤 Asignar a *</label
				>
				<EmployeeSelect
					id="assignee"
					name="assignee"
					required={true}
					{employees}
					placeholder="Seleccionar empleado"
				/>
			</div>

			<div>
				<label for="description" class="mb-2 block text-sm font-medium text-gray-700"
					>📄 Descripción</label
				>
				<textarea
					id="description"
					name="description"
					rows="4"
					class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					placeholder="Proporciona detalles adicionales (opcional)..."
				></textarea>
			</div>

			<div>
				<label for="priority" class="mb-2 block text-sm font-medium text-gray-700"
					>⚡ Prioridad</label
				>
				<select
					id="priority"
					name="priority"
					class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				>
					{#each prioridadOptions as option}
						<option value={option.value} selected={option.value === 'medium'}
							>{option.icon} {option.label}</option
						>
					{/each}
				</select>
			</div>
		</div>

		<div class="mt-8 flex justify-end space-x-3">
			<ActionButton onclick={onClose} variant="secondary">Cancelar</ActionButton>
			<ActionButton type="submit" variant="primary" disabled={isSubmitting}>
				{isSubmitting ? '⏳ Creando...' : '🚀 Crear Ticket'}
			</ActionButton>
		</div>
	</form>
</Modal>
