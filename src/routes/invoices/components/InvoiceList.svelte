<script lang="ts">
	import { goto } from '$app/navigation';
	import MarkAsPaidModal from '$lib/components/MarkAsPaidModal.svelte';
	import InvoiceRow from './InvoiceRow.svelte';
	import EmailMessage from './EmailMessage.svelte';

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
		invoices,
		filterStatus,
		onEdit,
		onDeleted,
		onUpdated
	}: {
		invoices: Invoice[];
		filterStatus: string;
		onEdit: (invoice: Invoice) => void;
		onDeleted: () => void;
		onUpdated: () => void;
	} = $props();

	let showReceiptModal = $state(false);
	let selectedInvoice = $state<Invoice | null>(null);
	let sendingEmail = $state<number | null>(null);
	let emailMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// Callback functions for email communication
	function handleEmailSent(message: { type: 'success' | 'error'; text: string }) {
		emailMessage = message;
		// Clear message after 10 seconds
		setTimeout(() => {
			emailMessage = null;
		}, 10000);
	}

	function handleEmailLoading(invoiceId: number) {
		sendingEmail = invoiceId;
	}

	function handleEmailLoadingEnd() {
		sendingEmail = null;
	}

	function openReceiptModal(invoice: Invoice) {
		selectedInvoice = invoice;
		showReceiptModal = true;
	}

	function closeReceiptModal() {
		showReceiptModal = false;
		selectedInvoice = null;
	}

	function handleFilterChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newFilter = target.value;

		// Update URL with new filter parameter
		const url = new URL(window.location.href);
		url.searchParams.set('filter', newFilter);
		goto(url.toString(), { replaceState: true });
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white" role="presentation">
	<EmailMessage message={emailMessage} />
	<div class="border-b border-gray-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-gray-900">
				Facturas ({invoices.length})
			</h3>
			<div class="flex items-center space-x-2">
				<label for="status-filter" class="text-sm font-medium text-gray-700">Filtrar por:</label>
				<select
					id="status-filter"
					value={filterStatus}
					onchange={handleFilterChange}
					class="rounded-md border border-gray-300 bg-white py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				>
					<option value="pending">Pendientes</option>
					<option value="pending-payment">Pendientes de pago</option>
					<option value="paid">Pagadas</option>
					<option value="all">Todas</option>
				</select>
			</div>
		</div>
	</div>

	{#if invoices.length === 0}
		<div class="px-6 py-8 text-center text-gray-500">
			<p>
				{filterStatus === 'all'
					? 'No hay facturas registradas.'
					: filterStatus === 'paid'
						? 'No hay facturas pagadas.'
						: 'No hay facturas pendientes.'}
			</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Valor</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Proveedor</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Estado de Pago</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Estado de Envío</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Fechas</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Subido por</th
						>
						<th
							class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Acciones</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each invoices as invoice (invoice.id)}
						<InvoiceRow
							{invoice}
							{sendingEmail}
							{onEdit}
							{onDeleted}
							{onUpdated}
							{openReceiptModal}
							onEmailSent={handleEmailSent}
							onEmailLoading={handleEmailLoading}
							onEmailLoadingEnd={handleEmailLoadingEnd}
						/>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<MarkAsPaidModal
	show={showReceiptModal}
	invoice={selectedInvoice}
	onClose={closeReceiptModal}
	onSuccess={onUpdated}
/>
