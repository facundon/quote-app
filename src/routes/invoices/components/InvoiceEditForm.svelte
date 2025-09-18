<script lang="ts">
	import { enhance } from '$app/forms';
	import FilePicker from '$lib/components/FilePicker.svelte';
	import EmployeeSelect from '$lib/components/EmployeeSelect.svelte';
	import { toastHelpers } from '$lib/utils/toast.js';

	type Invoice = {
		id: number;
		pdf_path: string;
		payment_receipt_path: string | null;
		value: number;
		payment_status: string;
		shipping_status: string;
		payment_date: string | null;
		reception_date: string | null;
		provider_id: number;
		uploaded_by: string;
		notes: string | null;
		created_at: string | null;
		provider_name: string | null;
	};

	let {
		invoice,
		employees = [] as string[],
		onEdited,
		onCancel
	}: {
		invoice: Invoice;
		employees?: string[];
		onEdited: () => void;
		onCancel: () => void;
	} = $props();

	let value = $state(invoice.value.toString());
	let uploadedBy = $state(invoice.uploaded_by);
	let notes = $state(invoice.notes || '');
	let paymentStatus = $state(invoice.payment_status);
	let shippingStatus = $state(invoice.shipping_status);
	let paymentDate = $state(formatDateForInput(invoice.payment_date));
	let receptionDate = $state(formatDateForInput(invoice.reception_date));
	let paymentReceiptFile = $state<File | null>(null);
	let isSubmitting = $state(false);

	// Derived states for date field visibility and disabled state
	let isPaymentDateDisabled = $derived(paymentStatus === 'pending');
	let isReceptionDateDisabled = $derived(shippingStatus === 'pending');

	// Clear date fields when status changes to pending
	$effect(() => {
		if (paymentStatus === 'pending') {
			paymentDate = '';
		}
	});

	$effect(() => {
		if (shippingStatus === 'pending') {
			receptionDate = '';
		}
	});

	// Format date for HTML date input (YYYY-MM-DD)
	function formatDateForInput(dateString: string | null): string {
		if (!dateString) return '';
		// If already in YYYY-MM-DD, return as is
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return '';
		return date.toISOString().split('T')[0];
	}

	// Get creation date from the created_at field
	function getCreationDate(): string {
		if (!invoice.created_at) return 'Fecha desconocida';
		const date = new Date(invoice.created_at);
		if (isNaN(date.getTime())) return 'Fecha desconocida';
		return date.toLocaleDateString('es-AR');
	}

	function handleFileSelected(file: File, id: string) {
		if (id === 'payment_receipt') {
			paymentReceiptFile = file;
		}
	}

	const statusOptions = [
		{ value: 'pending', label: 'Pendiente' },
		{ value: 'paid', label: 'Pagado' }
	];

	const shippingOptions = [
		{ value: 'pending', label: 'Pendiente' },
		{ value: 'delivered', label: 'Entregado' }
	];
</script>

<div class="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-blue-900">
		Editar Factura de {invoice.provider_name || 'Proveedor'} del {getCreationDate()}
	</h3>
	<form
		method="POST"
		action="?/invoice_edit"
		enctype="multipart/form-data"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					toastHelpers.itemUpdated('Factura');
					onEdited();
				} else if (result.type === 'failure') {
					toastHelpers.updateError(
						'Factura',
						typeof result.data?.message === 'string'
							? result.data.message
							: 'Error al actualizar factura'
					);
				}
				isSubmitting = false;
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="id" value={invoice.id} />

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
				/>
			</div>

			<div>
				<label for="uploaded_by" class="mb-1 block text-sm font-semibold">Subido por</label>
				<EmployeeSelect
					id="uploaded_by"
					name="uploaded_by"
					{employees}
					bind:value={uploadedBy}
					required={true}
					class="w-full rounded border px-3 py-2"
					useDefaultStyles={false}
					placeholder="Seleccionar empleado"
				/>
			</div>
		</div>

		<div>
			<label for="notes" class="mb-1 block text-sm font-semibold">Notas - Opcional</label>
			<textarea
				id="notes"
				name="notes"
				bind:value={notes}
				rows="3"
				class="w-full rounded border px-3 py-2"
				placeholder="Información adicional sobre la factura..."
			></textarea>
		</div>

		<!-- Payment Section -->
		<div class="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h4 class="mb-3 text-sm font-semibold tracking-wide text-gray-700 uppercase">
				Estado de Pago
			</h4>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="payment_status" class="mb-1 block text-sm font-semibold">Estado</label>
					<select
						id="payment_status"
						name="payment_status"
						bind:value={paymentStatus}
						required
						class="w-full rounded border px-3 py-2"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label
						for="payment_date"
						class="mb-1 block text-sm font-semibold {isPaymentDateDisabled ? 'text-gray-400' : ''}"
						>Fecha de Pago</label
					>
					<input
						type="date"
						id="payment_date"
						name="payment_date"
						bind:value={paymentDate}
						disabled={isPaymentDateDisabled}
						class="w-full rounded border px-3 py-2 {isPaymentDateDisabled
							? 'cursor-not-allowed bg-gray-100 text-gray-400'
							: ''}"
					/>
				</div>

				<div class="md:col-span-2">
					<label for="payment_receipt" class="mb-1 block text-sm font-semibold"
						>Comprobante de Pago (PDF)</label
					>
					{#if paymentStatus === 'paid'}
						<FilePicker
							id="payment_receipt"
							name="payment_receipt"
							accept=".pdf,image/*"
							required={false}
							selectedFileName={paymentReceiptFile?.name}
							existingFileName={invoice.payment_receipt_path ? 'Comprobante de pago subido' : null}
							onFileSelected={handleFileSelected}
						/>
					{:else}
						<div class="rounded border bg-gray-100 px-3 py-2">
							<span class="text-sm text-gray-500"
								>Cambia el estado de pago a "Pagado" para subir el comprobante</span
							>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Shipping Section -->
		<div class="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h4 class="mb-3 text-sm font-semibold tracking-wide text-gray-700 uppercase">
				Estado de Envío
			</h4>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="shipping_status" class="mb-1 block text-sm font-semibold">Estado</label>
					<select
						id="shipping_status"
						name="shipping_status"
						bind:value={shippingStatus}
						required
						class="w-full rounded border px-3 py-2"
					>
						{#each shippingOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label
						for="reception_date"
						class="mb-1 block text-sm font-semibold {isReceptionDateDisabled
							? 'text-gray-400'
							: ''}">Fecha de Recepción</label
					>
					<input
						type="date"
						id="reception_date"
						name="reception_date"
						bind:value={receptionDate}
						disabled={isReceptionDateDisabled}
						class="w-full rounded border px-3 py-2 {isReceptionDateDisabled
							? 'cursor-not-allowed bg-gray-100 text-gray-400'
							: ''}"
					/>
				</div>
			</div>
		</div>

		<div class="flex justify-end space-x-3">
			<button
				type="button"
				onclick={onCancel}
				class="rounded border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
			>
				Cancelar
			</button>
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
					Guardando...
				{:else}
					Guardar Cambios
				{/if}
			</button>
		</div>
	</form>
</div>
