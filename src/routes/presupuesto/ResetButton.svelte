<script lang="ts">
	let { onReset, disabled = false, variant = 'primary' }: {
		onReset: () => void;
		disabled?: boolean;
		variant?: 'primary' | 'secondary' | 'danger';
	} = $props();

	const baseClasses = 'px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
	
	const variantClasses = {
		primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-md hover:shadow-lg',
		secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500',
		danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-md hover:shadow-lg'
	};

	let classes = $derived(`${baseClasses} ${variantClasses[variant]}`);
</script>

<button class={classes} {disabled} onclick={onReset}>
	<svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
	</svg>
	Reiniciar Presupuesto
</button>
