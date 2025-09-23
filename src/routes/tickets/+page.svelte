<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import Toast from '$lib/components/Toast.svelte';
	import type { Ticket } from '$lib/server/db/schema';

	import HeaderBar from './components/HeaderBar.svelte';
	import FiltersBar from './components/FiltersBar.svelte';
	import TicketsGrid from './components/TicketsGrid.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import TicketsResolvedList from './components/TicketsResolvedList.svelte';
	import TicketsTable from './components/TicketsTable.svelte';
	import TicketCreateModal from './components/TicketCreateModal.svelte';
	import TicketEditModal from './components/TicketEditModal.svelte';
	import { updateTicketStatus, cycleStatus, deleteTicketById } from './services';
	import { getStatusInfo, statusOptions, prioridadOptions } from './utils';

	interface PageData {
		tickets: Ticket[];
		employees: string[];
	}

	let { data }: { data: PageData } = $props();

	// Estados para los modales
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingTicket = $state<Ticket | null>(null);

	// Estados para filtros
	let statusFilter = $state<'all' | 'resolved'>('all');
	let prioridadFilter = $state('all');
	let searchTerm = $state('');
	let selectedView = $state<'grid' | 'list'>('grid');
	let empleadoFilter = $state('');

	// Estados para el formulario
	let isSubmitting = $state(false);
	let toastMessage = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let showToast = $state(false);

	// Opciones para selects importadas desde utils

	// Filtrar tickets
	let filteredTickets = $derived(() => {
		let filtered: Ticket[] = data.tickets;

		if (statusFilter === 'all') {
			// Por defecto no mostrar resueltos a menos que se filtre explícitamente
			filtered = filtered.filter((ticket) => ticket.status !== 'resolved');
		} else {
			filtered = filtered.filter((ticket) => ticket.status === statusFilter);
		}

		if (prioridadFilter !== 'all') {
			filtered = filtered.filter((ticket) => ticket.priority === prioridadFilter);
		}

		if (empleadoFilter) {
			filtered = filtered.filter((ticket) => (ticket.assignee || '') === empleadoFilter);
		}

		if (empleadoFilter) {
			filtered = filtered.filter((ticket) => (ticket.assignee || '') === empleadoFilter);
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

	// Base filtrado sin aplicar estado (para contadores del quick filter)
	let baseFilteredTickets = $derived(() => {
		let filtered: Ticket[] = data.tickets;

		if (prioridadFilter !== 'all') {
			filtered = filtered.filter((ticket) => ticket.priority === prioridadFilter);
		}

		if (empleadoFilter) {
			filtered = filtered.filter((ticket) => (ticket.assignee || '') === empleadoFilter);
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

	let quickCounts = $derived(() => {
		const base = baseFilteredTickets();
		const nonResolved = base.filter((t) => t.status !== 'resolved').length;
		const resolved = base.filter((t) => t.status === 'resolved').length;
		return { nonResolved, resolved };
	});

	// Agrupaciones por estado para la vista de columnas
	let pendingTickets = $derived(() => filteredTickets().filter((t) => t.status === 'open'));
	let inProgressTickets = $derived(() =>
		filteredTickets().filter((t) => t.status === 'in_progress')
	);
	let resolvedTickets = $derived(() => filteredTickets().filter((t) => t.status === 'resolved'));

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

	// DnD moved into TicketsGrid component

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
		empleadoFilter = '';
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
		const nextStatus = await cycleStatus(currentStatus);
		if (!nextStatus) return;
		try {
			isSubmitting = true;
			const { ok } = await updateTicketStatus(ticketId, nextStatus);
			if (ok) {
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
			const { ok } = await deleteTicketById(ticketId);
			if (ok) {
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
			<HeaderBar bind:selectedView onCreate={openCreateModal} />
		</div>

		<!-- Filtros y búsqueda -->
		<FiltersBar
			bind:searchTerm
			bind:empleadoFilter
			bind:prioridadFilter
			bind:statusFilter
			employees={data.employees}
			quickCounts={quickCounts()}
			onClear={clearFilters}
		/>

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
			<!-- Vista agrupada por estado -->
			{#if statusFilter === 'resolved'}
				<TicketsResolvedList tickets={resolvedTickets()} {getTicketMenuOptions} />
			{:else}
				<TicketsGrid
					pendingTickets={pendingTickets()}
					inProgressTickets={inProgressTickets()}
					{getTicketMenuOptions}
					onUpdateStatus={async (id, status) => {
						const formData = new FormData();
						formData.append('id', String(id));
						formData.append('status', status);
						const response = await fetch('?/updateStatus', { method: 'POST', body: formData });
						const result = await response.json().catch(() => ({}));
						if (response.ok || (result && result.type === 'success')) {
							showToastMessage('Estado actualizado exitosamente', 'success');
							invalidateAll();
						} else {
							showToastMessage('Error al actualizar el estado', 'error');
						}
					}}
				/>
			{/if}
		{:else}
			<TicketsTable tickets={filteredTickets()} {getTicketMenuOptions} />
		{/if}
	</div>
</div>

<!-- Modal Crear Ticket -->
{#if showCreateModal}
	<TicketCreateModal
		bind:show={showCreateModal}
		onClose={closeCreateModal}
		employees={data.employees}
		{prioridadOptions}
		onSuccess={() => {
			showToastMessage('¡Ticket creado exitosamente! 🎉', 'success');
			invalidateAll();
		}}
	/>
{/if}

<!-- Modal Editar Ticket -->
{#if showEditModal && editingTicket}
	<TicketEditModal
		bind:show={showEditModal}
		onClose={closeEditModal}
		ticket={editingTicket}
		employees={data.employees}
		{prioridadOptions}
		{statusOptions}
		onSuccess={() => {
			showToastMessage('¡Ticket actualizado exitosamente! 🎉', 'success');
			invalidateAll();
		}}
	/>
{/if}

<!-- Toast -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} onClose={hideToast} />
{/if}

<style>
</style>
