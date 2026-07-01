<script lang="ts">
	import BulletinCard from './BulletinCard.svelte';
	import type { Bulletin } from '$lib/server/db/schema';

	interface Props {
		bulletins?: Bulletin[];
		onEdit?: (bulletin: Bulletin) => void;
		onDelete?: (id: number) => void;
		onTogglePin?: (id: number) => void;
	}

	let { bulletins = [], onEdit, onDelete, onTogglePin }: Props = $props();
</script>

{#if bulletins.length > 0}
	<div class="mb-8">
		<h3 class="mb-4 text-sm font-semibold text-gray-600">📌 Destacados</h3>
		<div class="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-md">
			<div class="grid gap-4 md:grid-cols-2">
				{#each bulletins as b (b.id)}
					<BulletinCard bulletin={b} {onEdit} {onDelete} {onTogglePin} />
				{/each}
			</div>
		</div>
	</div>
{/if}
