<script lang="ts">
	import { toastStore } from '$lib/stores/toast.js';
	import Toast from './Toast.svelte';

	let toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number }> = [];

	toastStore.subscribe(value => {
		toasts = value;
	});

	function removeToast(id: string) {
		toastStore.remove(id);
	}
</script>

{#each toasts as toast, index (toast.id)}
	<div style="z-index: {1000 + index};">
		<Toast
			message={toast.message}
			type={toast.type}
			duration={toast.duration}
			onClose={() => removeToast(toast.id)}
		/>
	</div>
{/each}
