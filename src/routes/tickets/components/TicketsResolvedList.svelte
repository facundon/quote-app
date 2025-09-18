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
		tickets = [] as Ticket[],
		getTicketMenuOptions
	}: { tickets?: Ticket[]; getTicketMenuOptions: (t: Ticket) => MenuOption[] } = $props();
</script>

<div class="space-y-3">
	<div
		class="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2"
	>
		<div class="text-sm font-semibold text-green-800">Resueltos</div>
		<div class="text-sm font-bold text-green-900">{tickets.length}</div>
	</div>

	{#if tickets.length > 0}
		<div class="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
			{#each tickets as ticket (ticket.id)}
				<TicketCard
					{ticket}
					menuOptions={getTicketMenuOptions(ticket)}
					scaleInOptions={{ duration: 300, delay: Math.random() * 100, easing: quintOut }}
				/>
			{/each}
		</div>
	{:else}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-600"
		>
			No hay tickets resueltos
		</div>
	{/if}
</div>
