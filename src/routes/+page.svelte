<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/presupuesto');
	});
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="text-center">
		<div class="mb-4 text-6xl">⏳</div>
		<p class="text-gray-600">Redirigiendo...</p>
	</div>
</div>
