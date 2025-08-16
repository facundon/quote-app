<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';

	type Provider = {
		name: string | null;
		email: string | null;
		contact_name: string | null;
		phone: string | null;
		cbu_alias: string | null;
		address: string | null;
	};

	let { show, provider, onClose }: { show: boolean, provider: Provider, onClose: () => void } = $props();
</script>

<Modal show={show} title={`Información del Proveedor ${provider?.name}`} onClose={onClose}>
	<div class="space-y-4">
		<div class="flex flex-col gap-2">
			<p class="text-sm text-gray-500">
				<span class="font-medium">Email:</span> {provider?.email || 'N/A'}
			</p>
			<p class="text-sm text-gray-500">
				<span class="font-medium">Contacto:</span> {provider?.contact_name || 'N/A'}
			</p>
			<p class="text-sm text-gray-500">
				<span class="font-medium">Teléfono:</span> {provider?.phone || 'N/A'}
			</p>
			<p class="text-sm text-gray-500">
				<span class="font-medium">Alias/CBU:</span> {provider?.cbu_alias || 'N/A'}
			</p>
			<p class="text-sm text-gray-500">
				<span class="font-medium">Dirección:</span> {provider?.address || 'N/A'}
			</p>
		</div>

		<div class="flex justify-end space-x-3">
			<button
				type="button"
				onclick={onClose}
				class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Cancelar
			</button>
		</div>
	</div>
</Modal>
