<script lang="ts">
	import { enhance } from '$app/forms';

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
		providers,
		invoices,
		onEdit,
		onDeleted
	}: {
		providers: Provider[];
		invoices: { provider_id: number }[];
		onEdit: (provider: Provider) => void;
		onDeleted: () => void;
	} = $props();

	function hasInvoices(providerId: number): boolean {
		return invoices.some((invoice) => invoice.provider_id === providerId);
	}

	function getInvoiceCount(providerId: number): number {
		return invoices.filter((invoice) => invoice.provider_id === providerId).length;
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white">
	<div class="border-b border-gray-200 px-6 py-4">
		<h3 class="text-lg font-semibold text-gray-900">Proveedores ({providers.length})</h3>
	</div>

	{#if providers.length === 0}
		<div class="px-6 py-8 text-center text-gray-500">
			<p>No hay proveedores registrados.</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>
							Proveedor
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>
							Contacto
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>
							CBU/Alias
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
						>
							Facturas
						</th>
						<th
							class="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase"
						>
							Acciones
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each providers as provider}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 whitespace-nowrap">
								<div>
									<div class="text-sm font-medium text-gray-900">{provider.name}</div>
									<div class="text-sm text-gray-500">{provider.address}</div>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div>
									<div class="text-sm font-medium text-gray-900">{provider.contact_name}</div>
									<div class="text-sm text-gray-500">{provider.phone}</div>
									<div class="text-sm text-gray-500">{provider.email}</div>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900">{provider.cbu_alias}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900">
									{getInvoiceCount(provider.id)} factura{getInvoiceCount(provider.id) !== 1
										? 's'
										: ''}
								</div>
							</td>
							<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
								<div class="flex justify-end space-x-2">
									<button
										onclick={() => onEdit(provider)}
										class="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
										title="Editar"
									>
										<svg
											class="h-4 w-4"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z"
											/>
										</svg>
										Editar
									</button>
									{#if !hasInvoices(provider.id)}
										<form
											method="POST"
											action="?/provider_delete"
											use:enhance={() => {
												return async ({ result }) => {
													if (result.type === 'success') {
														onDeleted();
													}
												};
											}}
											class="inline"
										>
											<input type="hidden" name="id" value={provider.id} />
											<button
												type="submit"
												class="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
												onclick={(e) => {
													if (!confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
														e.preventDefault();
													}
												}}
											>
												<svg
													class="h-4 w-4"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
												Eliminar
											</button>
										</form>
									{:else}
										<span
											class="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-400"
											title="No se puede eliminar porque tiene facturas asociadas"
										>
											<svg
												class="h-4 w-4"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
											Eliminar
										</span>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
