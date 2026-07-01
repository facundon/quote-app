<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import BulletinForm from './BulletinForm.svelte';
	import type { Bulletin } from '$lib/server/db/schema';

	interface Props {
		bulletin?: Bulletin | null;
		isOpen?: boolean;
		isSubmitting?: boolean;
		employees?: string[];
		onClose: () => void;
		onSuccess?: () => void;
	}

	let {
		bulletin = null,
		isOpen = false,
		isSubmitting = false,
		employees = [],
		onClose,
		onSuccess
	}: Props = $props();
</script>

{#if isOpen && bulletin}
	<Modal show={isOpen} title="✏️ Editar Noticia" size="medium" {onClose}>
		<BulletinForm
			action="edit"
			submitLabel="✅ Guardar Cambios"
			{bulletin}
			{isSubmitting}
			{employees}
			{onClose}
			{onSuccess}
		/>
	</Modal>
{/if}
