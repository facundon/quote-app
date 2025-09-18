<script lang="ts">
	import { fly } from 'svelte/transition';
	import Menu from '$lib/components/Menu.svelte';
	import {
		getAssigneeStyle,
		getStatusInfo,
		getPrioridadInfo,
		formatDate,
		getTimeAgo
	} from '../utils';
	import type { Ticket } from '../utils';

	type MenuOption = {
		label: string;
		icon?: string;
		color?: string;
		callback: () => void;
	};

	let { ticket, menuOptions = [] as MenuOption[] }: { ticket: Ticket; menuOptions?: MenuOption[] } =
		$props();
</script>

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
		<div class="line-clamp-2 max-w-xs text-sm text-gray-600">{ticket.description}</div>
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
	<td class="px-6 py-4 whitespace-nowrap">
		<div class="flex items-center gap-2">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-full"
				style:background-color={getAssigneeStyle(ticket.assignee).bg}
			>
				<span class="text-sm font-semibold" style:color={getAssigneeStyle(ticket.assignee).text}>
					{ticket.assignee ? ticket.assignee.charAt(0).toUpperCase() : '?'}
				</span>
			</div>
			<span class="text-base font-semibold" style:color={getAssigneeStyle(ticket.assignee).text}>
				{ticket.assignee || 'Sin asignar'}
			</span>
		</div>
	</td>
	<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
		<div>{formatDate(ticket.created_at)}</div>
		<div class="text-xs">{getTimeAgo(ticket.created_at)}</div>
	</td>
	<td class="px-2 py-4 text-center whitespace-nowrap">
		<Menu options={menuOptions} />
	</td>
</tr>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
