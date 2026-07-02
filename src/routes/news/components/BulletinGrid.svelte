<script lang="ts">
	import BulletinCard from './BulletinCard.svelte';
	import type { Bulletin } from '$lib/server/db/schema';

	interface Props {
		bulletins?: Bulletin[];
		onEdit?: (bulletin: Bulletin) => void;
		onDelete?: (id: number) => void;
		onTogglePin?: (id: number) => void;
		onDeleteImage?: (id: number) => void;
	}

	let { bulletins = [], onEdit, onDelete, onTogglePin, onDeleteImage }: Props = $props();
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
	{#each bulletins as b (b.id)}
		<BulletinCard bulletin={b} {onEdit} {onDelete} {onTogglePin} {onDeleteImage} />
	{/each}
</div>
