<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		show = false,
		title = '',
		onClose,
		children
	}: {
		show: boolean;
		title: string;
		onClose: () => void;
		children: Snippet;
	} = $props();
</script>

{#if show}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900">{title}</h3>
				<button
					type="button"
					onclick={onClose}
					class="text-gray-400 hover:text-gray-600"
					aria-label="Cerrar"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			</div>

			<div class="space-y-4">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
