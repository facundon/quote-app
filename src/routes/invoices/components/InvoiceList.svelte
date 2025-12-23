<script lang="ts">
	import { goto } from '$app/navigation';
	import EmployeeSelect from '$lib/components/EmployeeSelect.svelte';
	import MarkAsPaidModal from '$lib/components/MarkAsPaidModal.svelte';
	import InvoiceRow from './InvoiceRow.svelte';
	import EmailMessage from './EmailMessage.svelte';

	type Invoice = {
		id: number;
		pdf_path: string;
		payment_receipt_path: string | null;
		receipt_email_sent_at: string | null;
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
		provider_email: string | null;
		provider_address: string | null;
		provider_cbu_alias: string | null;
		provider_contact_name: string | null;
		provider_phone: string | null;
	};

	type Provider = {
		id: number;
		name: string;
		address: string | null;
		phone: string | null;
		email: string | null;
		cbu_alias: string | null;
		contact_name: string | null;
	};

	let {
		invoices,
		filterStatus,
		filterUser = '',
		employees = [] as string[],
		providers = [] as Provider[],
		filterProvider = '',
		sort = 'created' as 'created' | 'payment' | 'reception',
		dir = 'desc' as 'asc' | 'desc',
		onEdit,
		onDeleted,
		onUpdated
	}: {
		invoices: Invoice[];
		filterStatus: string;
		filterUser?: string;
		employees?: string[];
		providers?: Provider[];
		filterProvider?: string;
		sort?: 'created' | 'payment' | 'reception';
		dir?: 'asc' | 'desc';
		onEdit: (invoice: Invoice) => void;
		onDeleted: () => void;
		onUpdated: () => void;
	} = $props();

	let showReceiptModal = $state(false);
	let selectedInvoice = $state<Invoice | null>(null);
	let sendingEmail = $state<number | null>(null);
	let emailMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	let sendingEmailInvoice = $derived.by((): Invoice | null => {
		if (sendingEmail === null) return null;
		return invoices.find((inv) => inv.id === sendingEmail) ?? null;
	});

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
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function handleUserChange(newUser: string) {
		const url = new URL(window.location.href);
		if (newUser) {
			url.searchParams.set('user', newUser);
		} else {
			url.searchParams.delete('user');
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function handleProviderChange(newProviderId: string) {
		const url = new URL(window.location.href);
		if (newProviderId) {
			url.searchParams.set('provider', newProviderId);
		} else {
			url.searchParams.delete('provider');
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Local UI state to ensure immediate reflection of selection
	let statusValue = $state(filterStatus);
	let userValue = $state(filterUser || '');
	let providerValue = $state(filterProvider || '');

	// Keep local UI state in sync when props change after navigation
	$effect(() => {
		statusValue = filterStatus;
	});
	$effect(() => {
		userValue = filterUser || '';
	});
	$effect(() => {
		providerValue = filterProvider || '';
	});

	// Sorting UI state
	let currentSort = $state(sort);
	let currentDir = $state(dir);

	$effect(() => {
		currentSort = sort;
	});
	$effect(() => {
		currentDir = dir;
	});

	function getSortLabel(s: 'created' | 'payment' | 'reception') {
		switch (s) {
			case 'payment':
				return 'Pago';
			case 'reception':
				return 'Recepción';
			default:
				return 'Creado';
		}
	}

	function updateUrl(param: 'sort' | 'dir', value: string) {
		const url = new URL(window.location.href);
		url.searchParams.set(param, value);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function changeSort(newSort: 'created' | 'payment' | 'reception') {
		currentSort = newSort;
		updateUrl('sort', newSort);
	}

	function changeDir(newDir: 'asc' | 'desc') {
		currentDir = newDir;
		updateUrl('dir', newDir);
	}

	function clearFilters() {
		const url = new URL(window.location.href);
		url.searchParams.set('filter', 'pending');
		url.searchParams.delete('user');
		url.searchParams.delete('provider');
		url.searchParams.set('sort', 'created');
		url.searchParams.set('dir', 'desc');
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function setStatus(newFilter: string) {
		statusValue = newFilter;
		const url = new URL(window.location.href);
		url.searchParams.set('filter', newFilter);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white" role="presentation">
	<EmailMessage message={emailMessage} />
	{#if sendingEmailInvoice}
		<div class="border-b border-gray-200 bg-blue-50 px-6 py-3">
			<div class="flex items-center gap-2">
				<svg
					class="h-5 w-5 animate-spin text-blue-600"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m11.34 11.34l2.83-2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m11.34-11.34l-2.83 2.83"
					/>
				</svg>
				<span class="text-sm font-medium text-blue-800">
					Enviando comprobante por email…
					<span class="font-normal">
						({sendingEmailInvoice.provider_name || 'Proveedor'} · {sendingEmailInvoice.provider_email ||
							'sin email'})
					</span>
				</span>
			</div>
		</div>
	{/if}
	<div class="border-b border-gray-200 px-6 py-4">
		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-semibold text-gray-900">Facturas ({invoices.length})</h3>
			<div class="rounded-lg bg-gray-50 p-4">
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
					<div class="lg:col-span-6">
						<div class="mb-2 block text-sm font-medium text-gray-700">Estado</div>
						<div class="flex flex-wrap gap-2">
							<button
								onclick={() => setStatus('pending')}
								class="rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
								class:bg-blue-600={statusValue === 'pending'}
								class:text-white={statusValue === 'pending'}
								class:border-blue-600={statusValue === 'pending'}
								class:bg-white={statusValue !== 'pending'}
								class:text-blue-700={statusValue !== 'pending'}
								class:border-blue-300={statusValue !== 'pending'}
								aria-pressed={statusValue === 'pending'}
							>
								Pendientes
							</button>

							<button
								onclick={() => setStatus('pending-payment')}
								class="rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
								class:bg-amber-600={statusValue === 'pending-payment'}
								class:text-white={statusValue === 'pending-payment'}
								class:border-amber-600={statusValue === 'pending-payment'}
								class:bg-white={statusValue !== 'pending-payment'}
								class:text-amber-700={statusValue !== 'pending-payment'}
								class:border-amber-300={statusValue !== 'pending-payment'}
								aria-pressed={statusValue === 'pending-payment'}
							>
								Pend. pago
							</button>

							<button
								onclick={() => setStatus('paid')}
								class="rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
								class:bg-green-600={statusValue === 'paid'}
								class:text-white={statusValue === 'paid'}
								class:border-green-600={statusValue === 'paid'}
								class:bg-white={statusValue !== 'paid'}
								class:text-green-700={statusValue !== 'paid'}
								class:border-green-300={statusValue !== 'paid'}
								aria-pressed={statusValue === 'paid'}
							>
								Pagadas
							</button>

							<button
								onclick={() => setStatus('all')}
								class="rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
								class:bg-gray-800={statusValue === 'all'}
								class:text-white={statusValue === 'all'}
								class:border-gray-800={statusValue === 'all'}
								class:bg-white={statusValue !== 'all'}
								class:text-gray-800={statusValue !== 'all'}
								class:border-gray-300={statusValue !== 'all'}
								aria-pressed={statusValue === 'all'}
							>
								Todas
							</button>
						</div>
					</div>

					<div class="lg:col-span-3">
						<label for="user-filter" class="mb-1 block text-sm font-medium text-gray-700"
							>Usuario</label
						>
						<EmployeeSelect
							id="user-filter"
							name="user"
							{employees}
							value={userValue}
							includeAll={true}
							allLabel="Todos"
							allValue=""
							useDefaultStyles={false}
							class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							onchange={(e: Event) => {
								const target = e.target as HTMLSelectElement;
								userValue = target.value;
								handleUserChange(target.value);
							}}
						/>
					</div>
					<div class="lg:col-span-3">
						<label for="provider-filter" class="mb-1 block text-sm font-medium text-gray-700"
							>Proveedor</label
						>
						<select
							id="provider-filter"
							bind:value={providerValue}
							onchange={(e: Event) => {
								const target = e.target as HTMLSelectElement;
								providerValue = target.value;
								handleProviderChange(target.value);
							}}
							class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							<option value="">Todos</option>
							{#each providers as p}
								<option value={String(p.id)}>{p.name}</option>
							{/each}
						</select>
					</div>
					<div class="lg:col-span-4 xl:col-span-3">
						<label for="sort-select" class="mb-1 block text-sm font-medium text-gray-700"
							>Ordenar</label
						>
						<div class="flex w-full items-center gap-2">
							<div class="flex flex-1 flex-wrap items-center gap-2 md:flex-nowrap">
								<select
									id="sort-select"
									bind:value={currentSort}
									onchange={(e: Event) => {
										const target = e.target as HTMLSelectElement;
										changeSort(target.value as 'created' | 'payment' | 'reception');
									}}
									class="h-10 min-w-[180px] rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
								>
									<option value="created">Creado</option>
									<option value="payment">Pago</option>
									<option value="reception">Recepción</option>
								</select>
								<select
									id="dir-select"
									bind:value={currentDir}
									onchange={(e: Event) => {
										const target = e.target as HTMLSelectElement;
										changeDir(target.value as 'asc' | 'desc');
									}}
									class="h-10 min-w-[180px] rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
								>
									<option value="asc">Ascendente ↑</option>
									<option value="desc">Descendente ↓</option>
								</select>
							</div>
							{#if filterStatus !== 'pending' || userValue || providerValue || currentSort !== 'created' || currentDir !== 'desc'}
								<button
									onclick={clearFilters}
									class="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium whitespace-nowrap text-gray-600 hover:bg-gray-100"
								>
									<span class="mr-1">🗑️</span> Limpiar filtros
								</button>
							{/if}
						</div>
					</div>
				</div>
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
							class="w-1/8 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
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
							class="w-1/9 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Subido por</th
						>
						<th
							class="w-1/3 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Notas</th
						>
						<th class="w-12 px-2 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each invoices as invoice (invoice.id)}
						<InvoiceRow
							{invoice}
							{sendingEmail}
							sort={currentSort}
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
