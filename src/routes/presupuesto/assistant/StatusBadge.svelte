<script lang="ts">
	interface Props {
		statusText: string;
	}

	let { statusText }: Props = $props();

	let textElement = $state<HTMLElement>();

	// Animación del texto al cambiar de estado
	$effect(() => {
		if (statusText && textElement) {
			textElement.animate(
				[
					{ opacity: 0, transform: 'translateY(3px)' },
					{ opacity: 1, transform: 'translateY(0)' }
				],
				{
					duration: 250,
					easing: 'ease-out',
					fill: 'forwards'
				}
			);
		}
	});
</script>

{#if statusText}
	<div
		class="animate-in fade-in slide-in-from-top-1 inline-flex items-center gap-2.5 rounded-full border border-indigo-900/60 bg-[#1e1b4b] px-3.5 py-1.5 text-xs font-medium text-white shadow-md duration-200"
	>
		<span class="relative flex h-2 w-2 shrink-0 items-center justify-center">
			<span class="absolute inline-flex h-3 w-3 animate-pulse rounded-full bg-indigo-400 opacity-75"
			></span>
			<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-300"></span>
		</span>

		<span class="max-w-[280px] truncate sm:max-w-md">
			<span bind:this={textElement} class="inline-block font-normal text-white">
				{statusText}
			</span>
		</span>
	</div>
{/if}
