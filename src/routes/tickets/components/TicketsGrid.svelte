<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import TicketCard from './TicketCard.svelte';
	import type { Ticket } from '../utils';

	type MenuOption = {
		label: string;
		icon?: string;
		color?: string;
		callback: () => void;
	};

	let {
		pendingTickets = [] as Ticket[],
		inProgressTickets = [] as Ticket[],
		onUpdateStatus,
		getTicketMenuOptions
	}: {
		pendingTickets?: Ticket[];
		inProgressTickets?: Ticket[];
		onUpdateStatus: (id: number, status: 'open' | 'in_progress') => Promise<void> | void;
		getTicketMenuOptions: (ticket: Ticket) => MenuOption[];
	} = $props();

	// DnD internal state
	let draggedTicketId = $state<number | null>(null);
	let draggedFromStatus = $state<'open' | 'in_progress' | 'resolved' | null>(null);
	let openDropActive = $state(false);
	let inProgressDropActive = $state(false);

	function onTicketDragStart(ticket: Ticket, event: DragEvent) {
		draggedTicketId = ticket.id;
		draggedFromStatus = ticket.status as 'open' | 'in_progress' | 'resolved';
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(ticket.id));
			event.dataTransfer.setData('application/x-ticket-status', ticket.status);
		}
	}

	function onTicketDragEnd() {
		draggedTicketId = null;
		draggedFromStatus = null;
		openDropActive = false;
		inProgressDropActive = false;
	}

	function onOpenDragOver(event: DragEvent) {
		if (draggedTicketId !== null) {
			event.preventDefault();
			openDropActive = true;
			inProgressDropActive = false;
		}
	}

	function onInProgressDragOver(event: DragEvent) {
		if (draggedTicketId !== null) {
			event.preventDefault();
			inProgressDropActive = true;
			openDropActive = false;
		}
	}

	function onOpenDragLeave() {
		openDropActive = false;
	}

	function onInProgressDragLeave() {
		inProgressDropActive = false;
	}

	async function onColumnDrop(destinationStatus: 'open' | 'in_progress', event: DragEvent) {
		event.preventDefault();
		// Fallback to dataTransfer if needed
		if (draggedTicketId == null && event.dataTransfer) {
			const idText = event.dataTransfer.getData('text/plain');
			if (idText) draggedTicketId = Number(idText) || null;
			const src = event.dataTransfer.getData('application/x-ticket-status') as
				| 'open'
				| 'in_progress'
				| 'resolved';
			draggedFromStatus = src || draggedFromStatus;
		}

		if (!draggedFromStatus || draggedFromStatus === destinationStatus || draggedTicketId == null) {
			inProgressDropActive = false;
			openDropActive = false;
			return;
		}

		try {
			await onUpdateStatus(draggedTicketId, destinationStatus);
		} finally {
			onTicketDragEnd();
		}
	}
</script>

<div class="grid gap-4 md:grid-cols-2">
	<!-- Columna Pendientes -->
	<div
		class="space-y-3"
		ondragover={onOpenDragOver}
		ondragleave={onOpenDragLeave}
		ondrop={(e) => onColumnDrop('open', e)}
		role="list"
		aria-label="Columna Pendientes"
		class:ring-2={openDropActive}
		class:ring-blue-300={openDropActive}
		class:ring-offset-2={openDropActive}
	>
		<div
			class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2"
		>
			<div class="text-sm font-semibold text-blue-800">Pendientes</div>
			<div class="text-sm font-bold text-blue-900">{pendingTickets.length}</div>
		</div>
		{#if openDropActive}{/if}

		{#each pendingTickets as ticket (ticket.id)}
			<TicketCard
				{ticket}
				menuOptions={getTicketMenuOptions(ticket)}
				draggable={true}
				onDragStart={(e) => onTicketDragStart(ticket, e)}
				onDragEnd={onTicketDragEnd}
				scaleInOptions={{ duration: 300, delay: Math.random() * 100, easing: quintOut }}
			/>
		{:else}
			<div
				class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-600"
			>
				No hay tickets pendientes
			</div>
		{/each}
	</div>

	<!-- Columna En Progreso -->
	<div
		class="space-y-3"
		ondragover={onInProgressDragOver}
		ondragleave={onInProgressDragLeave}
		ondrop={(e) => onColumnDrop('in_progress', e)}
		role="list"
		aria-label="Columna En Progreso"
		class:ring-2={inProgressDropActive}
		class:ring-yellow-300={inProgressDropActive}
		class:ring-offset-2={inProgressDropActive}
	>
		<div
			class="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2"
		>
			<div class="text-sm font-semibold text-yellow-800">En Progreso</div>
			<div class="text-sm font-bold text-yellow-900">{inProgressTickets.length}</div>
		</div>
		{#each inProgressTickets as ticket (ticket.id)}
			<TicketCard
				{ticket}
				menuOptions={getTicketMenuOptions(ticket)}
				draggable={true}
				onDragStart={(e) => onTicketDragStart(ticket, e)}
				onDragEnd={onTicketDragEnd}
				scaleInOptions={{ duration: 300, delay: Math.random() * 100, easing: quintOut }}
			/>
		{:else}
			<div
				class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-600"
			>
				No hay tickets en progreso
			</div>
		{/each}
	</div>
</div>
