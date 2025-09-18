<script lang="ts">
	import TicketListRow from './TicketListRow.svelte';
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

<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
	<table class="min-w-full divide-y divide-gray-200">
		<thead class="bg-gray-50">
			<tr>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Ticket</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Descripción</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Estado</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Prioridad</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Asignado</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Creado</th
				>
				<th class="w-12 px-2 py-3"></th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-200 bg-white">
			{#each tickets as ticket (ticket.id)}
				<TicketListRow {ticket} menuOptions={getTicketMenuOptions(ticket)} />
			{/each}
		</tbody>
	</table>
</div>
