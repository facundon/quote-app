<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import BulletinForm from './BulletinForm.svelte';

	interface Props {
		title?: string;
		isOpen?: boolean;
		isSubmitting?: boolean;
		employees?: string[];
		onClose: () => void;
		onSuccess?: () => void;
	}

	let {
		title = '✨ Crear Nueva Noticia',
		isOpen = false,
		isSubmitting = false,
		employees = [],
		onClose,
		onSuccess
	}: Props = $props();
</script>

{#if isOpen}
	<Modal show={isOpen} {title} size="medium" {onClose}>
		<BulletinForm
			action="create"
			submitLabel="🚀 Crear Noticia"
			{isSubmitting}
			{employees}
			{onClose}
			{onSuccess}
		/>
	</Modal>
{/if}
