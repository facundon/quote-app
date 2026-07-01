<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import { enhance } from '$app/forms';

	interface Props {
		title?: string;
		isOpen?: boolean;
		isSubmitting?: boolean;
		employees?: string[];
		onClose: () => void;
		onSuccess?: () => void;
	}

	let {
		title = '✨ Crear Nueva Noticia',
		isOpen = false,
		isSubmitting = false,
		employees = [],
		onClose,
		onSuccess
	}: Props = $props();

	let bulletinTitle = $state('');
	let description = $state('');
	let imageUrl = $state('');
	let selectedEmployees = $state<string[]>([]);
	let isPinned = $state(false);
</script>

{#if isOpen}
	<Modal show={isOpen} {title} size="medium" {onClose}>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						bulletinTitle = '';
						description = '';
						imageUrl = '';
						selectedEmployees = [];
						isPinned = false;
						onSuccess?.();
					}
				};
			}}
			class="space-y-4"
		>
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
					placeholder="Título de la noticia"
					bind:value={bulletinTitle}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
				<p class="mt-1 text-xs text-gray-500">{bulletinTitle.length}/200 caracteres</p>
			</div>

			<!-- Description -->
			<div>
				<label for="description" class="mb-2 block text-sm font-medium text-gray-700"
					>Descripción</label
				>
				<textarea
					id="description"
					name="description"
					placeholder="Descripción de la noticia"
					maxlength="500"
					rows="4"
					bind:value={description}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				></textarea>
				<p class="mt-1 text-xs text-gray-500">{description.length}/500 caracteres</p>
			</div>

			<!-- Image URL -->
			<div>
				<label for="image_url" class="mb-2 block text-sm font-medium text-gray-700"
					>URL de imagen (opcional)</label
				>
				<input
					id="image_url"
					type="url"
					name="image_url"
					placeholder="https://ejemplo.com/imagen.jpg"
					bind:value={imageUrl}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<!-- Employees -->
			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">Usuarios involucrados</legend>
				<div class="space-y-2">
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
			</fieldset>

			<!-- Pin Checkbox -->
			<div class="flex items-center">
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
				<label for="isPinned" class="ml-2 text-sm font-medium text-gray-700"
					>Fijar en destacados</label
				>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 pt-4">
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					disabled={isSubmitting}
				>
					Cancelar
				</button>
				<ActionButton
					type="submit"
					variant="primary"
					disabled={isSubmitting || !bulletinTitle.trim()}
				>
					{isSubmitting ? '⏳ Creando...' : '🚀 Crear Noticia'}
				</ActionButton>
			</div>
		</form>
	</Modal>
{/if}
