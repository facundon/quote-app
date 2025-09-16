<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fly, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import Modal from '$lib/components/Modal.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import type { Ticket } from '$lib/server/db/schema';

	interface PageData {
		tickets: Ticket[];
	}

	let { data }: { data: PageData } = $props();

	// Estados para los modales
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingTicket = $state<Ticket | null>(null);

	// Estados para filtros
	let statusFilter = $state('all');
	let prioridadFilter = $state('all');
	let searchTerm = $state('');
	let selectedView = $state<'grid' | 'list'>('grid');

	// Estados para el formulario
	let isSubmitting = $state(false);
	let toastMessage = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let showToast = $state(false);

	// Opciones para los selects
	const statusOptions = [
		{
			value: 'open',
			label: 'Abierto',
			color: 'bg-blue-100 text-blue-800 border-blue-200',
			icon: '🔵'
		},
		{
			value: 'in_progress',
			label: 'En Progreso',
			color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
			icon: '🟡'
		},
		{
			value: 'resolved',
			label: 'Resuelto',
			color: 'bg-green-100 text-green-800 border-green-200',
			icon: '✅'
		}
	];

	const prioridadOptions = [
		{
			value: 'low',
			label: 'Baja',
			color: 'bg-green-100 text-green-800 border-green-200',
			icon: '🟢'
		},
		{
			value: 'medium',
			label: 'Media',
			color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
			icon: '🟠'
		},
		{
			value: 'high',
			label: 'Alta',
			color: 'bg-orange-100 text-orange-800 border-orange-200',
			icon: '🔴'
		},
		{
			value: 'urgent',
			label: 'Urgente',
			color: 'bg-red-100 text-red-800 border-red-200',
			icon: '🚨'
		}
	];

	// Filtrar tickets
	let filteredTickets = $derived(() => {
		let filtered: Ticket[] = data.tickets;

		if (statusFilter !== 'all') {
			filtered = filtered.filter((ticket) => ticket.status === statusFilter);
		}

		if (prioridadFilter !== 'all') {
			filtered = filtered.filter((ticket) => ticket.priority === prioridadFilter);
		}

		if (searchTerm) {
			const search = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(ticket) =>
					ticket.title.toLowerCase().includes(search) ||
					ticket.description.toLowerCase().includes(search) ||
					(ticket.assignee && ticket.assignee.toLowerCase().includes(search))
			);
		}

		return filtered;
	});

	// Estadísticas
	let ticketStats = $derived(() => {
		const total = data.tickets.length;
		const open = data.tickets.filter((t) => t.status === 'open').length;
		const inProgress = data.tickets.filter((t) => t.status === 'in_progress').length;
		const resolved = data.tickets.filter((t) => t.status === 'resolved').length;

		return { total, open, inProgress, resolved };
	});

	function getStatusInfo(status: string) {
		return statusOptions.find((s) => s.value === status) || statusOptions[0];
	}

	function getPrioridadInfo(prioridad: string) {
		return prioridadOptions.find((p) => p.value === prioridad) || prioridadOptions[1];
	}

	function openCreateModal() {
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	function openEditModal(ticket: Ticket) {
		editingTicket = ticket;
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editingTicket = null;
	}

	function formatDate(dateString: string | null) {
		if (!dateString) return '-';
		// SQLite guarda en UTC, así que agregamos 'Z' para indicar que es UTC
		const utcDate = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
		return utcDate.toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getTimeAgo(dateString: string) {
		const now = new Date();
		// SQLite guarda en UTC, así que agregamos 'Z' para indicar que es UTC
		const date = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
		if (diffHours > 0) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
		if (diffMinutes > 0) return `hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
		return 'hace un momento';
	}

	function showToastMessage(message: string, type: 'success' | 'error') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	function hideToast() {
		showToast = false;
		toastMessage = '';
	}

	function clearFilters() {
		statusFilter = 'all';
		prioridadFilter = 'all';
		searchTerm = '';
	}

	// Función para confirmar eliminación
	function confirmDelete(ticketId: number, ticketTitle: string) {
		if (confirm(`¿Estás seguro de que quieres eliminar el ticket "${ticketTitle}"?`)) {
			deleteTicket(ticketId);
		}
	}

	// Función para obtener el siguiente estado en el ciclo
	function getNextStatus(currentStatus: string) {
		const statusFlow: Record<string, string> = { open: 'in_progress', in_progress: 'resolved' };
		const nextStatus = statusFlow[currentStatus];
		if (!nextStatus) return null;
		const statusInfo = getStatusInfo(nextStatus);
		return statusInfo.label;
	}

	// Función para ciclar el estado de un ticket
	async function cycleTicketStatus(ticketId: number, currentStatus: string) {
		const statusFlow: Record<string, string> = { open: 'in_progress', in_progress: 'resolved' };
		const nextStatus = statusFlow[currentStatus];
		if (!nextStatus) return;

		try {
			isSubmitting = true;
			const formData = new FormData();
			formData.append('id', ticketId.toString());
			formData.append('status', nextStatus);

			const response = await fetch('?/updateStatus', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success' || response.ok) {
				showToastMessage('Estado actualizado exitosamente', 'success');
				invalidateAll();
			} else {
				showToastMessage('Error al actualizar el estado', 'error');
			}
		} catch (error) {
			showToastMessage('Error al actualizar el estado', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	async function deleteTicket(ticketId: number) {
		try {
			isSubmitting = true;
			const formData = new FormData();
			formData.append('id', ticketId.toString());

			const response = await fetch('?/delete', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success' || response.ok) {
				showToastMessage('Ticket eliminado exitosamente', 'success');
				invalidateAll();
			} else {
				showToastMessage('Error al eliminar el ticket', 'error');
			}
		} catch (error) {
			showToastMessage('Error al eliminar el ticket', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	// Función para generar opciones del menú para cada ticket
	function getTicketMenuOptions(ticket: Ticket) {
		const options = [];

		// Solo agregar "Cambiar Estado" si hay un siguiente estado
		const nextStatus = getNextStatus(ticket.status);
		if (nextStatus) {
			options.push({
				label: `Cambiar Estado (→ ${nextStatus})`,
				icon: '<svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>',
				color: 'text-green-600',
				callback: () => cycleTicketStatus(ticket.id, ticket.status)
			});
		}

		options.push(
			{
				label: 'Editar',
				icon: '<svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
				color: 'text-blue-600',
				callback: () => openEditModal(ticket)
			},
			{
				label: 'Eliminar',
				icon: '<svg class="h-4 w-4 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
				color: 'text-red-600',
				callback: () => confirmDelete(ticket.id, ticket.title)
			}
		);

		return options;
	}
</script>

<div class="mx-auto max-w-7xl">
	<div class="rounded-xl bg-white p-8 shadow-lg">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-extrabold text-blue-900">Gestión de Tareas</h1>
				</div>
				<div class="flex items-center gap-3">
					<!-- Vista selector -->
					<div class="flex items-center rounded-lg bg-gray-100 p-1">
						<button
							onclick={() => (selectedView = 'grid')}
							class="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors"
							class:bg-white={selectedView === 'grid'}
							class:shadow-sm={selectedView === 'grid'}
							class:text-blue-900={selectedView === 'grid'}
							class:text-gray-600={selectedView !== 'grid'}
						>
							<span>⊞</span> Vista Grilla
						</button>
						<button
							onclick={() => (selectedView = 'list')}
							class="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors"
							class:bg-white={selectedView === 'list'}
							class:shadow-sm={selectedView === 'list'}
							class:text-blue-900={selectedView === 'list'}
							class:text-gray-600={selectedView !== 'list'}
						>
							<span>☰</span> Vista Lista
						</button>
					</div>
					<ActionButton onclick={openCreateModal} variant="primary">
						<span class="mr-2">➕</span>
						Nuevo Ticket
					</ActionButton>
				</div>
			</div>

			<!-- Estadísticas -->
			<div class="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
				<div class="rounded-lg bg-gray-50 p-4 text-center">
					<div class="text-2xl font-bold text-gray-900">{ticketStats().total}</div>
					<div class="text-sm text-gray-600">Total</div>
				</div>
				<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
					<div class="text-2xl font-bold text-blue-900">{ticketStats().open}</div>
					<div class="text-sm text-blue-700">Abiertos</div>
				</div>
				<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
					<div class="text-2xl font-bold text-yellow-900">{ticketStats().inProgress}</div>
					<div class="text-sm text-yellow-700">En Progreso</div>
				</div>
				<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
					<div class="text-2xl font-bold text-green-900">{ticketStats().resolved}</div>
					<div class="text-sm text-green-700">Resueltos</div>
				</div>
			</div>
		</div>

		<!-- Filtros y búsqueda -->
		<div class="mb-6 rounded-lg bg-gray-50 p-6">
			<div class="flex flex-wrap items-center gap-4">
				<div class="min-w-64 flex-1">
					<label for="search" class="mb-1 block text-sm font-medium text-gray-700">
						🔍 Buscar tickets
					</label>
					<input
						id="search"
						type="text"
						bind:value={searchTerm}
						placeholder="Título, descripción o asignado..."
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="status-filter" class="mb-1 block text-sm font-medium text-gray-700">
						Estado
					</label>
					<select
						id="status-filter"
						bind:value={statusFilter}
						class="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						<option value="all">Todos los estados</option>
						{#each statusOptions as option}
							<option value={option.value}>{option.icon} {option.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="prioridad-filter" class="mb-1 block text-sm font-medium text-gray-700">
						Prioridad
					</label>
					<select
						id="prioridad-filter"
						bind:value={prioridadFilter}
						class="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						<option value="all">Todas las prioridades</option>
						{#each prioridadOptions as option}
							<option value={option.value}>{option.icon} {option.label}</option>
						{/each}
					</select>
				</div>

				{#if statusFilter !== 'all' || prioridadFilter !== 'all' || searchTerm}
					<div class="self-end">
						<button
							onclick={clearFilters}
							class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300"
						>
							🗑️ Limpiar filtros
						</button>
					</div>
				{/if}
			</div>

			<div class="mt-4 text-sm text-gray-600">
				Mostrando {filteredTickets().length} de {data.tickets.length} tickets
			</div>
		</div>

		<!-- Lista/Grid de tickets -->
		{#if filteredTickets().length === 0}
			<div
				class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center"
				in:scale={{ duration: 300, easing: quintOut }}
			>
				<div class="mb-4 text-6xl">🎫</div>
				{#if data.tickets.length === 0}
					<h3 class="mb-2 text-lg font-medium text-gray-900">No hay tickets creados</h3>
					<p class="mb-4 text-gray-600">Crea tu primer ticket para comenzar a gestionar tareas</p>
					<ActionButton onclick={openCreateModal} variant="primary">
						Crear primer ticket
					</ActionButton>
				{:else}
					<h3 class="mb-2 text-lg font-medium text-gray-900">No se encontraron tickets</h3>
					<p class="mb-4 text-gray-600">Intenta ajustar los filtros de búsqueda</p>
					<button
						onclick={clearFilters}
						class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
					>
						Limpiar filtros
					</button>
				{/if}
			</div>
		{:else if selectedView === 'grid'}
			<!-- Vista Grid -->
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredTickets() as ticket (ticket.id)}
					<div
						class="rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
						in:scale={{ duration: 300, delay: Math.random() * 100, easing: quintOut }}
					>
						<!-- Header compacto con ID, prioridad, estado y menú -->
						<div class="flex items-center justify-between border-b border-gray-100 px-4 py-2">
							<div class="flex items-center gap-2">
								<span class="font-mono text-xs text-gray-500">#{ticket.id}</span>
								<span
									class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium {getPrioridadInfo(
										ticket.priority
									).color}"
								>
									{getPrioridadInfo(ticket.priority).icon}
									{getPrioridadInfo(ticket.priority).label}
								</span>
								<span
									class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium {getStatusInfo(
										ticket.status
									).color}"
								>
									{getStatusInfo(ticket.status).icon}
									{getStatusInfo(ticket.status).label}
								</span>
							</div>
							<Menu options={getTicketMenuOptions(ticket)} />
						</div>

						<!-- Contenido principal -->
						<div class="px-6 py-4">
							<!-- Título -->
							<h3 class="mb-2 line-clamp-2 text-lg font-semibold text-gray-900">{ticket.title}</h3>

							<!-- Descripción -->
							<p class="text-sm text-gray-600">{ticket.description}</p>
						</div>

						<!-- Footer: Asignado, fecha y botón de estado -->
						<div class="border-t border-gray-100 px-6 py-3">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
										<span class="text-xs font-medium text-blue-600">
											{ticket.assignee ? ticket.assignee.charAt(0).toUpperCase() : '?'}
										</span>
									</div>
									<span class="text-sm font-medium text-gray-700">
										{ticket.assignee || 'Sin asignar'}
									</span>
								</div>
								<div class="text-right">
									<div class="text-xs text-gray-500">{formatDate(ticket.created_at)}</div>
									<div class="text-xs text-gray-400">{getTimeAgo(ticket.created_at)}</div>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- Vista Lista -->
			<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Ticket
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Descripción
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Estado
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Prioridad
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Asignado
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								Creado
							</th>
							<th class="w-12 px-2 py-3"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#each filteredTickets() as ticket (ticket.id)}
							<tr
								class="transition-colors hover:bg-gray-50"
								in:fly={{ x: -20, duration: 300, delay: Math.random() * 50 }}
							>
								<td class="px-6 py-4">
									<div class="flex items-start">
										<span class="mr-2 font-mono text-xs text-gray-500">#{ticket.id}</span>
										<div>
											<div class="text-sm font-medium text-gray-900">{ticket.title}</div>
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									<div class="line-clamp-2 max-w-xs text-sm text-gray-600">
										{ticket.description}
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium {getStatusInfo(
											ticket.status
										).color}"
									>
										{getStatusInfo(ticket.status).icon}
										{getStatusInfo(ticket.status).label}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium {getPrioridadInfo(
											ticket.priority
										).color}"
									>
										{getPrioridadInfo(ticket.priority).icon}
										{getPrioridadInfo(ticket.priority).label}
									</span>
								</td>
								<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
									{ticket.assignee || 'Sin asignar'}
								</td>
								<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
									<div>{formatDate(ticket.created_at)}</div>
									<div class="text-xs">{getTimeAgo(ticket.created_at)}</div>
								</td>
								<td class="px-2 py-4 text-center whitespace-nowrap">
									<Menu options={getTicketMenuOptions(ticket)} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Modal Crear Ticket -->
{#if showCreateModal}
	<Modal
		title="✨ Crear Nuevo Ticket"
		show={showCreateModal}
		onClose={closeCreateModal}
		size="medium"
	>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ result }) => {
					isSubmitting = false;
					if (result.type === 'success') {
						showToastMessage('¡Ticket creado exitosamente! 🎉', 'success');
						closeCreateModal();
						invalidateAll();
					} else {
						showToastMessage('Error al crear el ticket 😞', 'error');
					}
				};
			}}
		>
			<div class="space-y-6">
				<div>
					<label for="title" class="mb-2 block text-sm font-medium text-gray-700">
						📝 Título *
					</label>
					<input
						type="text"
						id="title"
						name="title"
						required
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						placeholder="Describe el problema o tarea en pocas palabras"
					/>
				</div>

				<div>
					<label for="assignee" class="mb-2 block text-sm font-medium text-gray-700">
						👤 Asignar a *
					</label>
					<input
						type="text"
						id="assignee"
						name="assignee"
						required
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						placeholder="Nombre de la persona responsable"
					/>
				</div>

				<div>
					<label for="description" class="mb-2 block text-sm font-medium text-gray-700">
						📄 Descripción
					</label>
					<textarea
						id="description"
						name="description"
						rows="4"
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						placeholder="Proporciona detalles adicionales (opcional)..."
					></textarea>
				</div>

				<div>
					<label for="priority" class="mb-2 block text-sm font-medium text-gray-700">
						⚡ Prioridad
					</label>
					<select
						id="priority"
						name="priority"
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						{#each prioridadOptions as option}
							<option value={option.value} selected={option.value === 'medium'}>
								{option.icon}
								{option.label}
							</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="mt-8 flex justify-end space-x-3">
				<ActionButton onclick={closeCreateModal} variant="secondary">Cancelar</ActionButton>
				<ActionButton type="submit" variant="primary" disabled={isSubmitting}>
					{isSubmitting ? '⏳ Creando...' : '🚀 Crear Ticket'}
				</ActionButton>
			</div>
		</form>
	</Modal>
{/if}

<!-- Modal Editar Ticket -->
{#if showEditModal && editingTicket}
	<Modal
		title="✏️ Editar Ticket #{editingTicket.id}"
		show={showEditModal}
		onClose={closeEditModal}
		size="medium"
	>
		<form
			method="POST"
			action="?/edit"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ result }) => {
					isSubmitting = false;
					if (result.type === 'success') {
						showToastMessage('¡Ticket actualizado exitosamente! 🎉', 'success');
						closeEditModal();
						invalidateAll();
					} else {
						showToastMessage('Error al actualizar el ticket 😞', 'error');
					}
				};
			}}
		>
			<input type="hidden" name="id" value={editingTicket.id} />

			<div class="space-y-6">
				<div>
					<label for="edit-title" class="mb-2 block text-sm font-medium text-gray-700">
						📝 Título *
					</label>
					<input
						type="text"
						id="edit-title"
						name="title"
						value={editingTicket.title}
						required
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="edit-assignee" class="mb-2 block text-sm font-medium text-gray-700">
						👤 Asignar a *
					</label>
					<input
						type="text"
						id="edit-assignee"
						name="assignee"
						value={editingTicket.assignee || ''}
						required
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="edit-description" class="mb-2 block text-sm font-medium text-gray-700">
						📄 Descripción
					</label>
					<textarea
						id="edit-description"
						name="description"
						value={editingTicket.description}
						rows="4"
						class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					></textarea>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label for="edit-priority" class="mb-2 block text-sm font-medium text-gray-700">
							⚡ Prioridad
						</label>
						<select
							id="edit-priority"
							name="priority"
							class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each prioridadOptions as option}
								<option value={option.value} selected={option.value === editingTicket.priority}>
									{option.icon}
									{option.label}
								</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="edit-status" class="mb-2 block text-sm font-medium text-gray-700">
							🔄 Estado
						</label>
						<select
							id="edit-status"
							name="status"
							class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each statusOptions as option}
								<option value={option.value} selected={option.value === editingTicket.status}>
									{option.icon}
									{option.label}
								</option>
							{/each}
						</select>
					</div>
				</div>

				{#if editingTicket.completed_at}
					<div class="rounded-lg border border-green-200 bg-green-50 p-4">
						<div class="flex items-center">
							<span class="mr-2 text-green-500">✅</span>
							<span class="text-sm font-medium text-green-800">
								Completado el {formatDate(editingTicket.completed_at)}
							</span>
						</div>
					</div>
				{/if}
			</div>

			<div class="mt-8 flex justify-end space-x-3">
				<ActionButton onclick={closeEditModal} variant="secondary">Cancelar</ActionButton>
				<ActionButton type="submit" variant="primary" disabled={isSubmitting}>
					{isSubmitting ? '⏳ Guardando...' : '💾 Guardar Cambios'}
				</ActionButton>
			</div>
		</form>
	</Modal>
{/if}

<!-- Toast -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} onClose={hideToast} />
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
