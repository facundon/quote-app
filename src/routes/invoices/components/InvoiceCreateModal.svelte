<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import FilePicker from '$lib/components/FilePicker.svelte';
	import EmployeeSelect from '$lib/components/EmployeeSelect.svelte';
	import { enhance } from '$app/forms';
	import { toastHelpers } from '$lib/utils/toast.js';

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
		show = $bindable(false),
		onClose,
		providers,
		employees = [] as string[],
		onSuccess
	}: {
		show?: boolean;
		onClose: () => void;
		providers: Provider[];
		employees?: string[];
		onSuccess: () => void;
	} = $props();

	let value = $state('');
	let providerId = $state('');
	let uploadedBy = $state('');
	let notes = $state('');
	let pdfFile = $state<File | null>(null);
	let paymentReceiptFile = $state<File | null>(null);
	let isSubmitting = $state(false);

	function resetForm() {
		value = '';
		providerId = '';
		uploadedBy = '';
		notes = '';
		pdfFile = null;
		paymentReceiptFile = null;
		const pdfInput = document.getElementById('pdf') as HTMLInputElement;
		const receiptInput = document.getElementById('payment_receipt') as HTMLInputElement;
		if (pdfInput) pdfInput.value = '';
		if (receiptInput) receiptInput.value = '';
	}

	function handleFileSelected(file: File, id: string) {
		if (id === 'pdf') {
			pdfFile = file;
		} else if (id === 'payment_receipt') {
			paymentReceiptFile = file;
		}
	}
</script>

<Modal title="✨ Subir Nueva Factura" {show} {onClose} size="large">
	<form
		method="POST"
		action="?/invoice_create"
		enctype="multipart/form-data"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ result }) => {
				isSubmitting = false;
				if (result.type === 'success') {
					toastHelpers.itemCreated('Factura');
					resetForm();
					onSuccess();
					onClose();
				} else if (result.type === 'failure') {
					toastHelpers.createError(
						'Factura',
						typeof result.data?.message === 'string'
							? result.data.message
							: 'Error al crear factura'
					);
				}
			};
		}}
		class="space-y-6"
	>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<div>
				<label for="value" class="mb-2 block text-sm font-medium text-gray-700">Valor ($)</label>
				<input
					type="number"
					id="value"
					name="value"
					bind:value
					required
					step="0.01"
					min="0"
					class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					placeholder="0.00"
				/>
			</div>

			<div>
				<label for="provider_id" class="mb-2 block text-sm font-medium text-gray-700"
					>Proveedor</label
				>
				<select
					id="provider_id"
					name="provider_id"
					bind:value={providerId}
					required
					class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				>
					<option value="">Seleccionar proveedor</option>
					{#each providers as provider}
						<option value={provider.id}>{provider.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="uploaded_by" class="mb-2 block text-sm font-medium text-gray-700"
					>Subido por</label
				>
				<EmployeeSelect
					id="uploaded_by"
					name="uploaded_by"
					{employees}
					bind:value={uploadedBy}
					required={true}
					class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					useDefaultStyles={false}
					placeholder="Seleccionar usuario"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label for="pdf" class="mb-2 block text-sm font-medium text-gray-700">Factura</label>
				<FilePicker
					id="pdf"
					name="pdf"
					accept=".pdf,image/*"
					required={true}
					selectedFileName={pdfFile?.name}
					onFileSelected={handleFileSelected}
				/>
			</div>

			<div>
				<label for="payment_receipt" class="mb-2 block text-sm font-medium text-gray-700"
					>Recibo de Pago - Opcional</label
				>
				<FilePicker
					id="payment_receipt"
					name="payment_receipt"
					accept=".pdf,image/*"
					required={false}
					selectedFileName={paymentReceiptFile?.name}
					onFileSelected={handleFileSelected}
				/>
			</div>
		</div>

		<div>
			<label for="notes" class="mb-2 block text-sm font-medium text-gray-700"
				>Notas - Opcional</label
			>
			<textarea
				id="notes"
				name="notes"
				bind:value={notes}
				rows="3"
				class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Información adicional sobre la factura..."
			></textarea>
		</div>

		<div class="mt-8 flex justify-end space-x-3">
			<ActionButton onclick={onClose} variant="secondary">Cancelar</ActionButton>
			<ActionButton type="submit" variant="primary" disabled={isSubmitting}>
				{isSubmitting ? '⏳ Subiendo...' : '🚀 Subir Factura'}
			</ActionButton>
		</div>
	</form>
</Modal>
