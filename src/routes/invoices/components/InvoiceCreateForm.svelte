<script lang="ts">
	import { enhance } from '$app/forms';

	type Provider = {
		id: number;
		name: string;
		address: string;
		phone: string;
		email: string;
		cbu_alias: string;
		contact_name: string;
	};

	let {
		providers,
		onCreated
	}: {
		providers: Provider[];
		onCreated: () => void;
	} = $props();

	let value = $state('');
	let providerId = $state('');
	let uploadedBy = $state('');
	let pdfFile = $state<File | null>(null);
	let isSubmitting = $state(false);

	function resetForm() {
		value = '';
		providerId = '';
		uploadedBy = '';
		pdfFile = null;
		// Reset the file input
		const fileInput = document.getElementById('pdf') as HTMLInputElement;
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			pdfFile = target.files[0];
		}
	}
</script>

<div class="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-blue-900">Subir Nueva Factura</h3>
	<form
		method="POST"
		action="?/invoice_create"
		enctype="multipart/form-data"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					resetForm();
					onCreated();
				}
				isSubmitting = false;
			};
		}}
		class="space-y-4"
	>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label for="value" class="mb-1 block text-sm font-semibold">Valor ($)</label>
				<input
					type="number"
					id="value"
					name="value"
					bind:value
					required
					step="0.01"
					min="0"
					class="w-full rounded border px-3 py-2"
					placeholder="0.00"
				/>
			</div>

			<div>
				<label for="provider_id" class="mb-1 block text-sm font-semibold">Proveedor</label>
				<select
					id="provider_id"
					name="provider_id"
					bind:value={providerId}
					required
					class="w-full rounded border px-3 py-2"
				>
					<option value="">Seleccionar proveedor</option>
					{#each providers as provider}
						<option value={provider.id}>{provider.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="uploaded_by" class="mb-1 block text-sm font-semibold">Subido por</label>
				<input
					type="text"
					id="uploaded_by"
					name="uploaded_by"
					bind:value={uploadedBy}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Nombre de la persona"
				/>
			</div>

			<div>
				<label for="pdf" class="mb-1 block text-sm font-semibold">Archivo PDF</label>
				<input
					type="file"
					id="pdf"
					name="pdf"
					accept=".pdf"
					required
					onchange={handleFileChange}
					class="w-full rounded border px-3 py-2"
				/>
				{#if pdfFile}
					<p class="mt-1 text-sm text-gray-600">Archivo seleccionado: {pdfFile.name}</p>
				{/if}
			</div>
		</div>

		<div class="flex justify-end">
			<button
				type="submit"
				disabled={isSubmitting}
				class="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSubmitting}
					<svg
						class="h-4 w-4 animate-spin text-white"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Subiendo...
				{:else}
					Subir Factura
				{/if}
			</button>
		</div>
	</form>
</div>
