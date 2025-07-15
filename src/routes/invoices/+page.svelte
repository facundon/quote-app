<script lang="ts">
	import InvoiceCreateForm from './components/InvoiceCreateForm.svelte';
	import InvoiceEditForm from './components/InvoiceEditForm.svelte';
	import InvoiceList from './components/InvoiceList.svelte';
	import { invalidateAll } from '$app/navigation';

	type Invoice = {
		id: number;
		pdf_path: string;
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
	let editInvoice = $state<Invoice | null>(null);

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

<div class="mx-auto max-w-6xl">
	<div class="rounded-xl bg-white p-8 shadow-lg">
		<h1 class="mb-6 text-3xl font-extrabold text-blue-900">Gestión de Facturas</h1>

		{#if editInvoice}
			<InvoiceEditForm
				invoice={editInvoice}
				onEdited={() => {
					fetchInvoices();
					cancelEdit();
				}}
				onCancel={cancelEdit}
			/>
		{:else}
			<InvoiceCreateForm {providers} onCreated={fetchInvoices} />
			<InvoiceList
				{invoices}
				onEdit={startEdit}
				onDeleted={fetchInvoices}
				onUpdated={fetchInvoices}
			/>
		{/if}
	</div>
</div>
