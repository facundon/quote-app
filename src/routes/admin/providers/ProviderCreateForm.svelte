<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastHelpers } from '$lib/utils/toast.js';

	let {
		name,
		address,
		phone,
		email,
		cbuAlias,
		contactName,
		onCreated
	}: {
		name: string;
		address: string;
		phone: string;
		email: string;
		cbuAlias: string;
		contactName: string;
		onCreated: () => void;
	} = $props();

	let isSubmitting = $state(false);

	function handleSubmit() {
		isSubmitting = true;
		onCreated();
	}
</script>

<div class="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-blue-900">Crear Proveedor</h3>
	<form
		method="POST"
		action="?/provider_create"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					toastHelpers.itemCreated('Proveedor');
					name = '';
					address = '';
					phone = '';
					email = '';
					cbuAlias = '';
					contactName = '';
					onCreated();
				} else if (result.type === 'failure') {
					toastHelpers.createError('Proveedor', typeof result.data?.message === 'string' ? result.data.message : 'Error al crear proveedor');
				}
				isSubmitting = false;
			};
		}}
		class="space-y-4"
	>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label for="name" class="mb-1 block text-sm font-semibold">Nombre</label>
				<input
					type="text"
					id="name"
					name="name"
					bind:value={name}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Nombre del proveedor"
				/>
			</div>

			<div>
				<label for="contact_name" class="mb-1 block text-sm font-semibold">Nombre de Contacto</label
				>
				<input
					type="text"
					id="contact_name"
					name="contact_name"
					bind:value={contactName}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Nombre del contacto"
				/>
			</div>

			<div>
				<label for="phone" class="mb-1 block text-sm font-semibold">Teléfono</label>
				<input
					type="tel"
					id="phone"
					name="phone"
					bind:value={phone}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Número de teléfono"
				/>
			</div>

			<div>
				<label for="email" class="mb-1 block text-sm font-semibold">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					bind:value={email}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Dirección de email"
				/>
			</div>

			<div>
				<label for="cbu_alias" class="mb-1 block text-sm font-semibold">Alias CBU</label>
				<input
					type="text"
					id="cbu_alias"
					name="cbu_alias"
					bind:value={cbuAlias}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Alias CBU"
				/>
			</div>
		</div>

		<div>
			<label for="address" class="mb-1 block text-sm font-semibold">Dirección</label>
			<textarea
				id="address"
				name="address"
				bind:value={address}
				required
				rows="3"
				class="w-full rounded border px-3 py-2"
				placeholder="Dirección completa"
			></textarea>
		</div>

		<div class="flex justify-end">
			<button
				type="submit"
				disabled={isSubmitting}
				class="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isSubmitting ? 'Creando...' : 'Guardar'}
			</button>
		</div>
	</form>
</div>
