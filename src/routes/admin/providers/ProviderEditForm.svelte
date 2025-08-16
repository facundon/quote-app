<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastHelpers } from '$lib/utils/toast.js';

	let {
		id,
		name,
		address,
		phone,
		email,
		cbuAlias,
		contactName,
		onEdited,
		onCancel
	}: {
		id: number;
		name: string;
		address: string;
		phone: string;
		email: string;
		cbuAlias: string;
		contactName: string;
		onEdited: () => void;
		onCancel: () => void;
	} = $props();

	let isSubmitting = $state(false);

	function handleSubmit() {
		isSubmitting = true;
		onEdited();
	}
</script>

<div class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 shadow">
	<h3 class="mb-2 text-lg font-bold text-blue-900">Editar {name}</h3>
	<form
		method="POST"
		action="?/provider_edit"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					toastHelpers.itemUpdated('Proveedor');
					onEdited();
				} else if (result.type === 'failure') {
					toastHelpers.updateError('Proveedor', typeof result.data?.message === 'string' ? result.data.message : 'Error al actualizar proveedor');
				}
				isSubmitting = false;
			};
		}}
		class="space-y-3"
	>
		<input type="hidden" name="id" value={id} />

		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<div>
				<label for="edit_name" class="mb-1 block text-sm font-semibold">Nombre</label>
				<input
					type="text"
					id="edit_name"
					name="name"
					bind:value={name}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Nombre del proveedor"
				/>
			</div>

			<div>
				<label for="edit_contact_name" class="mb-1 block text-sm font-semibold"
					>Nombre de Contacto</label
				>
				<input
					type="text"
					id="edit_contact_name"
					name="contact_name"
					bind:value={contactName}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Nombre del contacto"
				/>
			</div>

			<div>
				<label for="edit_phone" class="mb-1 block text-sm font-semibold">Teléfono</label>
				<input
					type="tel"
					id="edit_phone"
					name="phone"
					bind:value={phone}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Número de teléfono"
				/>
			</div>

			<div>
				<label for="edit_email" class="mb-1 block text-sm font-semibold">Email</label>
				<input
					type="email"
					id="edit_email"
					name="email"
					bind:value={email}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Dirección de email"
				/>
			</div>

			<div>
				<label for="edit_cbu_alias" class="mb-1 block text-sm font-semibold">Alias CBU</label>
				<input
					type="text"
					id="edit_cbu_alias"
					name="cbu_alias"
					bind:value={cbuAlias}
					required
					class="w-full rounded border px-3 py-2"
					placeholder="Alias CBU"
				/>
			</div>
		</div>

		<div>
			<label for="edit_address" class="mb-1 block text-sm font-semibold">Dirección</label>
			<textarea
				id="edit_address"
				name="address"
				bind:value={address}
				required
				rows="3"
				class="w-full rounded border px-3 py-2"
				placeholder="Dirección completa"
			></textarea>
		</div>

		<button
			type="submit"
			disabled={isSubmitting}
			class="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{isSubmitting ? 'Guardando...' : 'Actualizar'}
		</button>
		<button type="button" class="ml-2 text-slate-500 hover:underline" onclick={onCancel}>
			Cancelar
		</button>
	</form>
</div>
