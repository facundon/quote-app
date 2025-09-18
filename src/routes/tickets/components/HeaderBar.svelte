<script lang="ts">
	import ActionButton from '$lib/components/ActionButton.svelte';

	let {
		selectedView = $bindable<'grid' | 'list'>('grid'),
		onCreate
	}: {
		selectedView?: 'grid' | 'list';
		onCreate: () => void;
	} = $props();
</script>

<div class="flex items-center justify-between">
	<div>
		<h1 class="text-3xl font-extrabold text-blue-900">Gestión de Tareas</h1>
	</div>
	<div class="flex items-center gap-3">
		<div class="flex items-center rounded-lg bg-gray-100 p-1">
			<button
				onclick={() => (selectedView = 'grid')}
				class="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors"
				class:bg-white={selectedView === 'grid'}
				class:shadow-sm={selectedView === 'grid'}
				class:text-blue-900={selectedView === 'grid'}
				class:text-gray-600={selectedView !== 'grid'}
			>
				<span>⊞</span> Vista Grilla
			</button>
			<button
				onclick={() => (selectedView = 'list')}
				class="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors"
				class:bg-white={selectedView === 'list'}
				class:shadow-sm={selectedView === 'list'}
				class:text-blue-900={selectedView === 'list'}
				class:text-gray-600={selectedView !== 'list'}
			>
				<span>☰</span> Vista Lista
			</button>
		</div>
		<ActionButton onclick={onCreate} variant="primary">
			<span class="mr-2">➕</span>
			Nuevo Ticket
		</ActionButton>
	</div>
</div>
