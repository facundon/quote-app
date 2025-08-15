<script lang="ts">
	import Modal from './Modal.svelte';

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
		provider_email: string | null;
	};

	let {
		show = false,
		invoice,
		onConfirm,
		onCancel,
		sending = false
	}: {
		show: boolean;
		invoice: Invoice | null;
		onConfirm: () => void;
		onCancel: () => void;
		sending: boolean;
	} = $props();

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS'
		}).format(value);
	}
</script>

<Modal show={show} title="Confirmar envío de email" onClose={onCancel}>
	<div class="space-y-4">
		<div class="text-center">
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
				<svg
					class="h-6 w-6 text-blue-600"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
					/>
				</svg>
			</div>
			<h3 class="mt-2 text-lg font-medium text-gray-900">
				¿Enviar comprobante por email?
			</h3>
			<p class="mt-1 text-sm text-gray-500">
				Se enviará el comprobante de pago a la siguiente dirección:
			</p>
		</div>

		{#if invoice}
			<div class="rounded-lg bg-gray-50 p-4">
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="text-sm font-medium text-gray-700">Proveedor:</span>
						<span class="text-sm text-gray-900">{invoice.provider_name || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-sm font-medium text-gray-700">Email:</span>
						<span class="text-sm text-gray-900">{invoice.provider_email}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-sm font-medium text-gray-700">Valor:</span>
						<span class="text-sm font-semibold text-gray-900">{formatCurrency(invoice.value)}</span>
					</div>
				</div>
			</div>
		{/if}

		<div class="flex justify-end space-x-3">
			<button
				type="button"
				onclick={onCancel}
				disabled={sending}
				class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Cancelar
			</button>
			<button
				type="button"
				onclick={onConfirm}
				disabled={sending}
				class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if sending}
					<svg
						class="mr-2 h-4 w-4 animate-spin"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m11.34 11.34l2.83-2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m11.34-11.34l-2.83 2.83"
						/>
					</svg>
					Enviando...
				{:else}
					Enviar Email
				{/if}
			</button>
		</div>
	</div>
</Modal>
