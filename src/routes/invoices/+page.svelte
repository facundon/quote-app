<script lang="ts">
	import ActionButton from '$lib/components/ActionButton.svelte';
	import InvoiceCreateModal from './components/InvoiceCreateModal.svelte';
	import InvoiceEditForm from './components/InvoiceEditForm.svelte';
	import InvoiceList from './components/InvoiceList.svelte';
	import { invalidateAll } from '$app/navigation';

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

	type Provider = {
		id: number;
		name: string;
		address: string;
		phone: string;
		email: string;
		cbu_alias: string;
		contact_name: string;
	};

	let { data } = $props();

	let invoices = $derived(data.invoices);
	let providers = $derived(data.providers);
	let filterStatus = $derived(data.filterStatus);
	let filterUser = $derived(data.filterUser);
	let filterProvider = $derived(data.filterProvider);
	let employees = $derived(data.employees);
	let sort = $derived(data.sort as 'created' | 'payment' | 'reception');
	let dir = $derived(data.dir as 'asc' | 'desc');
	let editInvoice = $state<Invoice | null>(null);
	let showCreateModal = $state(false);

	function startEdit(invoice: Invoice) {
		editInvoice = invoice;
	}

	function cancelEdit() {
		editInvoice = null;
	}

	async function fetchInvoices() {
		await invalidateAll();
		// If we're editing an invoice, update it with fresh data
		if (editInvoice) {
			const updatedInvoice = invoices.find((inv) => inv.id === editInvoice!.id);
			if (updatedInvoice) {
				editInvoice = updatedInvoice;
			}
		}
	}
</script>

<div class="max-w-8xl mx-auto">
	<div class="rounded-xl bg-white p-8 shadow-lg">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-extrabold text-blue-900">Gestión de Facturas</h1>
			<ActionButton variant="primary" onclick={() => (showCreateModal = true)}>
				<span class="mr-2">➕</span>
				Nueva Factura
			</ActionButton>
		</div>

		{#if editInvoice}
			<InvoiceEditForm
				invoice={editInvoice}
				{employees}
				onEdited={() => {
					fetchInvoices();
					cancelEdit();
				}}
				onCancel={cancelEdit}
			/>
		{:else}
			<InvoiceList
				{invoices}
				{filterStatus}
				{filterUser}
				{employees}
				{providers}
				{filterProvider}
				{sort}
				{dir}
				onEdit={startEdit}
				onDeleted={fetchInvoices}
				onUpdated={fetchInvoices}
			/>
		{/if}
	</div>
</div>

{#if showCreateModal}
	<InvoiceCreateModal
		bind:show={showCreateModal}
		onClose={() => (showCreateModal = false)}
		{providers}
		{employees}
		onSuccess={fetchInvoices}
	/>
{/if}
