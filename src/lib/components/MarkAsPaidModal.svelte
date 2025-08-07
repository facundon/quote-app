<script lang="ts">
	import { enhance } from '$app/forms';
	import Modal from './Modal.svelte';
	import FilePicker from './FilePicker.svelte';
	import ActionButton from './ActionButton.svelte';

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
		created_at: string | null;
		provider_name: string | null;
	};

	let {
		show = false,
		invoice = null,
		onClose,
		onSuccess
	}: {
		show: boolean;
		invoice: Invoice | null;
		onClose: () => void;
		onSuccess: () => void;
	} = $props();

	let receiptFile = $state<File | null>(null);
	let isUploading = $state(false);

	function handleReceiptFileSelected(file: File, id: string) {
		receiptFile = file;
	}

	function resetModal() {
		receiptFile = null;
		isUploading = false;
	}
</script>

<Modal {show} title="Marcar como Pagado" {onClose}>
	<form
		method="POST"
		action="?/invoice_mark_paid_with_receipt"
		enctype="multipart/form-data"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					resetModal();
					onSuccess();
					onClose();
				}
				isUploading = false;
			};
		}}
		class="space-y-4"
	>
		{#if invoice}
			<input type="hidden" name="id" value={invoice.id} />
		{/if}

		<div class="mb-4">
			<p class="text-sm text-gray-600">¿Deseas marcar esta factura como pagada?</p>
		</div>

		<div>
			<label for="receipt_file" class="mb-1 block text-sm font-semibold"
				>Comprobante de Pago (PDF) - Opcional</label
			>
			<FilePicker
				id="receipt_file"
				name="payment_receipt"
				accept=".pdf"
				required={false}
				placeholder="Seleccionar o arrastrar archivo (opcional)"
				selectedFileName={receiptFile?.name}
				onFileSelected={handleReceiptFileSelected}
			/>
		</div>

		<div class="flex justify-end space-x-3">
			<ActionButton type="button" variant="secondary" onclick={onClose}>Cancelar</ActionButton>
			<ActionButton
				type="submit"
				variant="primary"
				disabled={isUploading}
				loading={isUploading}
				loadingText="Procesando..."
			>
				Marcar como Pagado
			</ActionButton>
		</div>
	</form>
</Modal>
