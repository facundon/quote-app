<script lang="ts">
	import ProviderCreateForm from './ProviderCreateForm.svelte';
	import ProviderEditForm from './ProviderEditForm.svelte';
	import ProviderList from './ProviderList.svelte';
	import { invalidateAll } from '$app/navigation';

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
		providers: initialProviders,
		invoices = []
	}: {
		providers: Provider[];
		invoices?: { provider_id: number }[];
	} = $props();

	let providers = $derived(initialProviders);
	let name = $state('');
	let address = $state('');
	let phone = $state('');
	let email = $state('');
	let cbuAlias = $state('');
	let contactName = $state('');
	let editId = $state<number | null>(null);
	let editName = $state('');
	let editAddress = $state('');
	let editPhone = $state('');
	let editEmail = $state('');
	let editCbuAlias = $state('');
	let editContactName = $state('');

	function startEdit(provider: Provider) {
		editId = provider.id;
		editName = provider.name;
		editAddress = provider.address;
		editPhone = provider.phone;
		editEmail = provider.email;
		editCbuAlias = provider.cbu_alias;
		editContactName = provider.contact_name;
	}

	function cancelEdit() {
		editId = null;
		editName = '';
		editAddress = '';
		editPhone = '';
		editEmail = '';
		editCbuAlias = '';
		editContactName = '';
	}

	async function fetchProviders() {
		await invalidateAll();
	}
</script>

{#if editId}
	<ProviderEditForm
		id={editId}
		name={editName}
		address={editAddress}
		phone={editPhone}
		email={editEmail}
		cbuAlias={editCbuAlias}
		contactName={editContactName}
		onEdited={() => {
			fetchProviders();
			cancelEdit();
		}}
		onCancel={cancelEdit}
	/>
{:else}
	<ProviderCreateForm
		{name}
		{address}
		{phone}
		{email}
		{cbuAlias}
		{contactName}
		onCreated={fetchProviders}
	/>
	<ProviderList {providers} {invoices} onEdit={startEdit} onDeleted={fetchProviders} />
{/if}
