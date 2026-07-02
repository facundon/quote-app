<script lang="ts">
	import ActionButton from '$lib/components/ActionButton.svelte';
	import FilePicker from '$lib/components/FilePicker.svelte';
	import { enhance } from '$app/forms';
	import { parseEmployeesJson } from '../utils';
	import type { Bulletin } from '$lib/server/db/schema';

	interface Props {
		action: 'create' | 'edit';
		submitLabel: string;
		isSubmitting?: boolean;
		bulletin?: Bulletin | null;
		employees?: string[];
		onClose: () => void;
		onSuccess?: () => void;
	}

	let {
		action,
		submitLabel,
		isSubmitting = false,
		bulletin = null,
		employees = [],
		onClose,
		onSuccess
	}: Props = $props();

	let bulletinTitle = $state('');
	let description = $state('');
	let selectedFileName = $state<string | null>(null);
	let selectedEmployees = $state<string[]>([]);
	let isPinned = $state(false);
	let error = $state('');

	$effect(() => {
		if (bulletin && action === 'edit') {
			bulletinTitle = bulletin.title;
			description = bulletin.description || '';
			selectedFileName = null;
			selectedEmployees = parseEmployeesJson(bulletin.employees);
			isPinned = bulletin.isPinned === 'true';
			error = '';
		}
	});
</script>

<form
	method="POST"
	action="?/{action}"
	enctype="multipart/form-data"
	use:enhance={() => {
		return async ({ result }) => {
			if (result.type === 'success') {
				bulletinTitle = '';
				description = '';
				selectedFileName = null;
				selectedEmployees = [];
				isPinned = false;
				onSuccess?.();
				error = '';
			}
			if (result.type === 'failure') {
				error = String(result.data?.error);
			}
		};
	}}
	class="space-y-4"
>
	{#if action === 'edit' && bulletin}
		<input type="hidden" name="id" value={bulletin.id} />
	{/if}

	<!-- Title -->
	<div>
		<label for="title" class="mb-2 block text-sm font-medium text-gray-700">Título *</label>
		<input
			id="title"
			type="text"
			name="title"
			required
			minlength="3"
			maxlength="200"
			placeholder="Título del boletín"
			bind:value={bulletinTitle}
			class="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
		/>
		<p class="mt-1 text-xs text-gray-500">{bulletinTitle.length}/200 caracteres</p>
	</div>

	<!-- Description -->
	<div>
		<label for="description" class="mb-2 block text-sm font-medium text-gray-700">Descripción</label
		>
		<textarea
			id="description"
			name="description"
			placeholder="Descripción del boletín"
			maxlength="1000"
			rows="4"
			bind:value={description}
			class="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
		></textarea>
		<p class="mt-1 text-xs text-gray-500">{description.length}/1000 caracteres</p>
	</div>

	<!-- Image Upload -->
	<div>
		<label class="mb-2 block text-sm font-medium text-gray-700" for="image">Imagen (opcional)</label
		>
		<FilePicker
			id="image"
			name="image"
			accept=".jpg,.jpeg,.png,.gif,.webp"
			placeholder="Seleccionar o arrastrar imagen"
			{selectedFileName}
		/>
		<p class="mt-1 text-xs text-gray-500">Máximo 5 MB. Formatos: JPG, PNG, GIF, WebP</p>
	</div>

	<!-- Employees -->
	<fieldset>
		<legend class="mb-2 block text-sm font-medium text-gray-700"
			>Usuarios involucrados (opcional)</legend
		>
		<div class="space-y-2">
			<div class="grid grid-cols-3 gap-2">
				{#each employees as emp}
					<label class="flex items-center">
						<input
							type="checkbox"
							name="employees"
							value={emp}
							checked={selectedEmployees.includes(emp)}
							onchange={(e) => {
								const target = e.target as HTMLInputElement;
								if (target.checked) {
									selectedEmployees = [...selectedEmployees, emp];
								} else {
									selectedEmployees = selectedEmployees.filter((e) => e !== emp);
								}
							}}
							class="rounded border-gray-300"
						/>
						<span class="ml-2 text-sm text-gray-700">{emp}</span>
					</label>
				{/each}
			</div>
		</div>
	</fieldset>

	{#if error}
		<p class="mt-6 mb-0 text-sm text-red-400">{error}</p>
	{/if}

	<!-- Actions -->
	<div class="flex justify-end gap-2 pt-4">
		<!-- Pin Checkbox -->
		<div class="mr-auto flex items-center">
			<input
				id="isPinned"
				type="checkbox"
				name="isPinned"
				checked={isPinned}
				onchange={(e) => {
					const target = e.target as HTMLInputElement;
					isPinned = target.checked;
				}}
				class="rounded border-gray-300"
			/>
			<label for="isPinned" class="ml-2 flex items-center gap-1 text-sm font-medium text-gray-700"
				>Fijar en destacados 📌</label
			>
		</div>
		<button
			type="button"
			onclick={onClose}
			class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			disabled={isSubmitting}
		>
			Cancelar
		</button>
		<ActionButton type="submit" variant="primary" disabled={isSubmitting || !bulletinTitle.trim()}>
			{isSubmitting ? '⏳ ' : ''}{submitLabel}
		</ActionButton>
	</div>
</form>
