<script lang="ts">
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import Menu from '$lib/components/Menu.svelte';
	import { getAssigneeStyle, getPrioridadInfo, formatDate, getTimeAgo } from '../utils';
	import type { Ticket } from '../utils';

	type MenuOption = {
		label: string;
		icon?: string;
		color?: string;
		callback: () => void;
	};

	let {
		ticket,
		menuOptions = [] as MenuOption[],
		draggable = false,
		onDragStart,
		onDragEnd,
		ariaLabel = `Ticket #${ticket?.id}`,
		title = 'Arrastrar para mover de estado',
		scaleInOptions = { duration: 300, delay: 0, easing: quintOut }
	}: {
		ticket: Ticket;
		menuOptions?: MenuOption[];
		draggable?: boolean;
		onDragStart?: (e: DragEvent) => void;
		onDragEnd?: () => void;
		ariaLabel?: string;
		title?: string;
		scaleInOptions?: { duration?: number; delay?: number; easing?: (t: number) => number };
	} = $props();
</script>

<div
	class="rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
	in:scale={scaleInOptions}
	{draggable}
	ondragstart={onDragStart}
	ondragend={onDragEnd}
	role="listitem"
	aria-label={ariaLabel}
	{title}
	class:cursor-grab={draggable}
	class:active:cursor-grabbing={draggable}
>
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
		</div>
		<Menu options={menuOptions} />
	</div>

	<div class="px-6 py-4">
		<h3 class="mb-2 line-clamp-2 text-lg font-semibold text-gray-900">{ticket.title}</h3>
		<p class="text-sm text-gray-600">{ticket.description}</p>
	</div>

	<div class="border-t border-gray-100 px-6 py-3">
		<div class="flex items-center justify-between">
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
			<div class="text-right">
				<div class="text-xs text-gray-500">{formatDate(ticket.created_at)}</div>
				<div class="text-xs text-gray-400">{getTimeAgo(ticket.created_at)}</div>
			</div>
		</div>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
