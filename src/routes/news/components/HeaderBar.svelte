<script lang="ts">
	import ActionButton from '$lib/components/ActionButton.svelte';

	interface Props {
		onCreate?: () => void;
	}

	let { onCreate }: Props = $props();
</script>

<div class="flex items-center justify-between">
	<h1 class="text-3xl font-extrabold text-blue-900">📰 Noticias</h1>
	<ActionButton variant="primary" onclick={onCreate}>➕ Agregar Noticia</ActionButton>
</div>
