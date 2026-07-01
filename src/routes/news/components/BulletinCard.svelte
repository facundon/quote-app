<script lang="ts">
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import Menu from '$lib/components/Menu.svelte';
	import { formatDate, getTimeAgo, parseEmployeesJson } from '../utils';
	import type { Bulletin } from '$lib/server/db/schema';

	function getEmployeeAvatar(name: string): { bg: string; text: string } {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
		}
		const hue = hash % 360;
		return {
			bg: `hsl(${hue}, 85%, 88%)`,
			text: `hsl(${hue}, 60%, 35%)`
		};
	}

	interface Props {
		bulletin: Bulletin;
		noOptions?: boolean;
		onEdit?: (bulletin: Bulletin) => void;
		onDelete?: (id: number) => void;
		onTogglePin?: (id: number) => void;
	}

	let { bulletin, onEdit, onDelete, onTogglePin, noOptions }: Props = $props();

	const employees = $derived(parseEmployeesJson(bulletin.employees));
	const isPinned = $derived(bulletin.isPinned === 'true');
</script>

<div
	class="rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
	in:scale={{ duration: 300, easing: quintOut }}
>
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-100 px-4 py-2">
		<div class="flex items-center gap-2">
			<span class="font-mono text-xs text-gray-500">#{bulletin.id}</span>
			{#if isPinned}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
				>
					📌 Destacado
				</span>
			{/if}
		</div>
		{#if !noOptions}
			<Menu
				options={[
					{
						label: 'Editar',
						icon: '✏️',
						color: 'text-blue-600',
						callback: () => onEdit?.(bulletin)
					},
					{
						label: isPinned ? 'Desfijar' : 'Fijar',
						icon: isPinned ? '☆' : '⭐',
						color: 'text-yellow-600',
						callback: () => onTogglePin?.(bulletin.id)
					},
					{
						label: 'Eliminar',
						icon: '🗑️',
						color: 'text-red-600',
						callback: () => onDelete?.(bulletin.id)
					}
				]}
			/>
		{/if}
	</div>

	<!-- Image if present -->
	{#if bulletin.image_url}
		<img src={bulletin.image_url} alt={bulletin.title} class="h-32 w-full object-cover" />
	{/if}

	<!-- Content -->
	<div class="px-6 py-4">
		<h3 class="mb-2 line-clamp-2 text-lg font-semibold text-gray-900">{bulletin.title}</h3>
		{#if bulletin.description}
			<p class="text-sm text-gray-600">{bulletin.description}</p>
		{/if}
	</div>

	<!-- Footer -->
	<div class="border-t border-gray-100 px-6 py-3">
		<!-- Employees -->
		{#if employees.length > 0}
			<div class="mb-3 flex flex-wrap gap-2">
				{#each employees as emp}
					<div class="flex items-center gap-2">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
							style:background-color={getEmployeeAvatar(emp).bg}
							style:color={getEmployeeAvatar(emp).text}
						>
							{emp.charAt(0).toUpperCase()}
						</div>
						<span class="text-xs font-medium" style:color={getEmployeeAvatar(emp).text}>
							{emp}
						</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Date/Time -->
		<div class="text-right">
			<div class="text-xs text-gray-500">{formatDate(bulletin.created_at)}</div>
			<div class="text-xs text-gray-400">{getTimeAgo(bulletin.created_at)}</div>
		</div>
	</div>
</div>
