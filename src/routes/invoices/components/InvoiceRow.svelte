<script lang="ts">
	import Menu from '$lib/components/Menu.svelte';
	import { enhance } from '$app/forms';

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
		invoice,
		sendingEmail,
		onEdit,
		onDeleted,
		onUpdated,
		openReceiptModal,
		onEmailSent,
		onEmailLoading,
		onEmailLoadingEnd
	}: {
		invoice: Invoice;
		sendingEmail: number | null;
		onEdit: (invoice: Invoice) => void;
		onDeleted: () => void;
		onUpdated: () => void;
		openReceiptModal: (invoice: Invoice) => void;
		onEmailSent: (message: { type: 'success' | 'error'; text: string }) => void;
		onEmailLoading: (invoiceId: number) => void;
		onEmailLoadingEnd: () => void;
	} = $props();

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS'
		}).format(value);
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '-';
		// Parse as local date (YYYY-MM-DD)
		const [year, month, day] = dateString.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		if (isNaN(date.getTime())) return '-';
		return date.toLocaleDateString('es-AR');
	}

	function getCreationDate(createdAt: string | null): string {
		if (!createdAt) return '-';
		// Parse as local date (YYYY-MM-DD)
		const [year, month, day] = createdAt.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		if (isNaN(date.getTime())) return '-';
		return date.toLocaleDateString('es-AR');
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
				return 'Recibido';
			case 'pending':
				return 'Pendiente';
			default:
				return status;
		}
	}

	async function sendEmail() {
		try {
			const formData = new FormData();
			formData.append('id', invoice.id.toString());

			const response = await fetch('?/invoice_send_email', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'failure') {
				const errorMessage =
					result.data.error || JSON.parse(result.data)[1] || 'Error al enviar email';
				onEmailSent({ type: 'error', text: errorMessage });
			} else {
				console.log('Sending success message');
				onEmailSent({ type: 'success', text: 'Email enviado correctamente' });
			}
		} catch (error) {
			// Handle network/connection errors
			console.error('Email send error:', error);
			onEmailSent({ type: 'error', text: 'Error de conexión' });
		}
	}

	async function markAsReceived() {
		try {
			const formData = new FormData();
			formData.append('id', invoice.id.toString());

			const response = await fetch('?/invoice_quick_received', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.success || response.ok) {
				onUpdated();
			} else {
				console.error('Error marking as received:', result.error || 'Unknown error');
			}
		} catch (error) {
			console.error('Error marking as received:', error);
		}
	}

	async function deleteInvoice() {
		if (confirm('¿Estás seguro de que quieres eliminar esta factura?')) {
			try {
				const formData = new FormData();
				formData.append('id', invoice.id.toString());

				const response = await fetch('?/invoice_delete', {
					method: 'POST',
					body: formData
				});

				const result = await response.json();

				if (result.success || response.ok) {
					onDeleted();
				} else {
					console.error('Error deleting invoice:', result.error || 'Unknown error');
				}
			} catch (error) {
				console.error('Error deleting invoice:', error);
			}
		}
	}

	function getMenuOptions() {
		const options = [
			{
				label: 'Ver Factura',
				icon: '<svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>',
				color: 'text-gray-700',
				callback: () => {
					window.open(`/${invoice.pdf_path}`, '_blank');
				}
			}
		];

		// Add payment receipt option if exists
		if (invoice.payment_receipt_path) {
			options.push({
				label: 'Ver Comprobante',
				icon: '<svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
				color: 'text-gray-700',
				callback: () => {
					window.open(`/${invoice.payment_receipt_path}`, '_blank');
				}
			});
		}

		// Add mark as paid option if not paid
		if (invoice.payment_status !== 'paid') {
			options.push({
				label: 'Marcar como Pagado',
				icon: '<svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
				color: 'text-green-600',
				callback: () => {
					openReceiptModal(invoice);
				}
			});
		}

		// Add mark as delivered option if not delivered
		if (invoice.shipping_status !== 'delivered') {
			options.push({
				label: 'Marcar como Recibido',
				icon: '<svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
				color: 'text-blue-600',
				callback: () => {
					markAsReceived();
				}
			});
		}

		// Add email option if provider has email
		if (invoice.payment_receipt_path && invoice.provider_email) {
			options.push({
				label: sendingEmail === invoice.id ? 'Enviando...' : 'Enviar Comprobante por Email',
				icon:
					sendingEmail === invoice.id
						? '<svg class="h-4 w-4 text-purple-600 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m11.34 11.34l2.83-2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m11.34-11.34l-2.83 2.83"/></svg>'
						: '<svg class="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>',
				color: 'text-purple-600',
				callback: async () => {
					// Dispatch loading event
					onEmailLoading(invoice.id);

					await sendEmail();

					// Dispatch loading end event
					onEmailLoadingEnd();
				}
			});
		}

		// Add edit option
		options.push({
			label: 'Editar',
			icon: '<svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
			color: 'text-blue-600',
			callback: () => onEdit(invoice)
		});

		// Add delete option
		options.push({
			label: 'Eliminar',
			icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
			color: 'text-red-600',
			callback: () => {
				deleteInvoice();
			}
		});

		return options;
	}
</script>

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
		<Menu options={getMenuOptions()} />
	</td>
</tr>
