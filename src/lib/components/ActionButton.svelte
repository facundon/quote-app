<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		type = 'button',
		variant = 'primary',
		disabled = false,
		loading = false,
		loadingText = 'Procesando...',
		onclick,
		children
	}: {
		type?: 'button' | 'submit';
		variant?: 'primary' | 'secondary' | 'danger';
		disabled?: boolean;
		loading?: boolean;
		loadingText?: string;
		onclick?: () => void;
		children?: Snippet;
	} = $props();
</script>

<button
	{type}
	{disabled}
	class="inline-flex cursor-pointer items-center gap-2 rounded px-4 py-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 {variant ===
	'primary'
		? 'bg-blue-600 text-white hover:bg-blue-700'
		: ''} {variant === 'secondary'
		? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
		: ''} {variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : ''}"
	{onclick}
>
	{#if loading}
		<svg
			class="h-4 w-4 animate-spin text-white"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
		{loadingText}
	{:else if children}
		{@render children()}
	{/if}
</button>
