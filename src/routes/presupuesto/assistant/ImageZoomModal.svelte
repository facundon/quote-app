<script lang="ts">
	import type { PendingMedia } from '$lib/chat/events';

	interface Props {
		image: PendingMedia | null;
		onClose: () => void;
	}

	let { image, onClose }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

{#if image}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		onclick={onClose}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<button
			type="button"
			onclick={onClose}
			class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
			aria-label="Cerrar"
		>
			<span class="text-2xl">×</span>
		</button>
		<button type="button" class="cursor-default" onclick={(e) => e.stopPropagation()}>
			<img
				src="data:{image.type};base64,{image.data}"
				alt="Imagen ampliada"
				class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
			/>
		</button>
	</div>
{/if}
