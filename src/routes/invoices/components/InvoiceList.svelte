<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Menu from '$lib/components/Menu.svelte';
	import MarkAsPaidModal from '$lib/components/MarkAsPaidModal.svelte';

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

	function getStatusColor(status: string): string {
		switch (status) {
			case 'paid':
				return 'bg-green-100 text-green-800';
			case 'pending':
				return 'bg-yellow-100 text-yellow-800';
			case 'cancelled':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getShippingColor(status: string): string {
		switch (status) {
			case 'delivered':
				return 'bg-green-100 text-green-800';
			case 'pending':
				return 'bg-yellow-100 text-yellow-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS'
		}).format(value);
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '-';
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return '-';
		return date.toLocaleDateString('es-AR');
	}

	function getCreationDate(createdAt: string | null): string {
		if (!createdAt) return '-';
		const date = new Date(createdAt);
		if (isNaN(date.getTime())) return '-';
		return date.toLocaleDateString('es-AR');
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'paid':
				return 'Pagado';
			case 'pending':
				return 'Pendiente';
			case 'cancelled':
				return 'Cancelado';
			default:
				return status;
		}
	}

	function getShippingLabel(status: string): string {
		switch (status) {
			case 'delivered':
				return 'Entregado';
			case 'pending':
				return 'Pendiente';
			default:
				return status;
		}
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white" role="presentation">
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
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900">{formatCurrency(invoice.value)}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900">{invoice.provider_name || 'N/A'}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span
									class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {getStatusColor(
										invoice.payment_status
									)}">{getStatusLabel(invoice.payment_status)}</span
								>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span
									class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {getShippingColor(
										invoice.shipping_status
									)}">{getShippingLabel(invoice.shipping_status)}</span
								>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="space-y-1 text-xs text-gray-600">
									<div>
										<span class="font-medium">Creado:</span>
										{getCreationDate(invoice.created_at)}
									</div>
									<div>
										<span class="font-medium">Pago:</span>
										{formatDate(invoice.payment_date)}
									</div>
									<div>
										<span class="font-medium">Recepción:</span>
										{formatDate(invoice.reception_date)}
									</div>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900">{invoice.uploaded_by}</div>
							</td>
							<td class="px-6 py-4 text-center text-sm font-medium whitespace-nowrap">
								<Menu
									options={[
										{
											label: 'Ver Factura',
											icon: '<svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>',
											color: 'text-gray-700',
											callback: () => {
												window.open(`/${invoice.pdf_path}`, '_blank');
											}
										},
										...(invoice.payment_receipt_path
											? [
													{
														label: 'Ver Comprobante',
														icon: '<svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
														color: 'text-gray-700',
														callback: () => {
															window.open(`/${invoice.payment_receipt_path}`, '_blank');
														}
													}
												]
											: []),
										...(invoice.payment_status !== 'paid'
											? [
													{
														label: 'Marcar como Pagado',
														icon: '<svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
														color: 'text-green-600',
														callback: () => {
															openReceiptModal(invoice);
														}
													}
												]
											: []),
										...(invoice.shipping_status !== 'delivered'
											? [
													{
														label: 'Marcar como Entregado',
														icon: '<svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
														color: 'text-blue-600',
														callback: () => {
															const form = document.createElement('form');
															form.method = 'POST';
															form.action = '?/invoice_quick_received';

															const input = document.createElement('input');
															input.type = 'hidden';
															input.name = 'id';
															input.value = invoice.id.toString();

															form.appendChild(input);
															document.body.appendChild(form);
															form.submit();
															document.body.removeChild(form);

															onUpdated();
														}
													}
												]
											: []),
										{
											label: 'Editar',
											icon: '<svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
											color: 'text-blue-600',
											callback: () => onEdit(invoice)
										},
										{
											label: 'Eliminar',
											icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
											color: 'text-red-600',
											callback: () => {
												if (confirm('¿Estás seguro de que quieres eliminar esta factura?')) {
													const form = document.createElement('form');
													form.method = 'POST';
													form.action = '?/invoice_delete';

													const input = document.createElement('input');
													input.type = 'hidden';
													input.name = 'id';
													input.value = invoice.id.toString();

													form.appendChild(input);
													document.body.appendChild(form);
													form.submit();
													document.body.removeChild(form);

													onDeleted();
												}
											}
										}
									]}
								/>
							</td>
						</tr>
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
