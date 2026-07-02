<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { applyFilters, type PeriodFilter } from './utils';
	import HeaderBar from './components/HeaderBar.svelte';
	import FiltersBar from './components/FiltersBar.svelte';
	import FeaturedSection from './components/FeaturedSection.svelte';
	import BulletinGrid from './components/BulletinGrid.svelte';
	import BulletinCreateModal from './components/BulletinCreateModal.svelte';
	import BulletinEditModal from './components/BulletinEditModal.svelte';
	import type { Bulletin } from '$lib/server/db/schema';
	import Modal from '$lib/components/Modal.svelte';

	interface PageData {
		bulletins: Bulletin[];
		employees: string[];
	}

	let { data }: { data: PageData } = $props();

	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingBulletin = $state<Bulletin | null>(null);
	let isSubmitting = $state(false);

	let periodFilter = $state<PeriodFilter>('week');
	let searchTerm = $state('');
	let employeeFilter = $state('');

	let bulletins = $derived(data.bulletins);

	let actionToBeConfirmed = $state('');
	let callbackAfterConfirmation = $state<(() => void) | null>(null);

	let filtered = $derived.by(() => {
		return applyFilters(bulletins, periodFilter, searchTerm, employeeFilter);
	});

	let pinnedBulletins = $derived(filtered.filter((b) => b.isPinned === 'true'));
	let unpinnedBulletins = $derived(filtered.filter((b) => b.isPinned !== 'true'));

	function handleCreateClick() {
		showCreateModal = true;
	}

	function handleCloseCreateModal() {
		showCreateModal = false;
	}

	function handleEditClick(bulletin: Bulletin) {
		editingBulletin = bulletin;
		showEditModal = true;
	}

	function handleCloseEditModal() {
		showEditModal = false;
		editingBulletin = null;
	}

	function onConfirmationEnd() {
		actionToBeConfirmed = '';
		callbackAfterConfirmation = null;
	}

	async function handleDeleteBulletin(id: number) {
		if (!confirm('¿Estás seguro de que quieres eliminar esta noticia?')) return;

		const form = new FormData();
		form.append('id', id.toString());

		const response = await fetch('?/delete', {
			method: 'POST',
			body: form
		});

		if (response.ok) {
			await invalidateAll();
		}
	}

	function onCheckConfirmation(action: string, callback: () => void) {
		actionToBeConfirmed = action;
		callbackAfterConfirmation = () => {
			onConfirmationEnd();
			callback();
		};
	}

	async function handleDeleteImage(id: number) {
		const form = new FormData();
		form.append('id', id.toString());

		const response = await fetch('?/deleteImage', {
			method: 'POST',
			body: form
		});

		if (response.ok) {
			await invalidateAll();
		}
	}

	async function handleTogglePinBulletin(id: number) {
		const form = new FormData();
		form.append('id', id.toString());

		const response = await fetch('?/togglePin', {
			method: 'POST',
			body: form
		});

		if (response.ok) {
			await invalidateAll();
		}
	}

	function handleSuccess() {
		showCreateModal = false;
		showEditModal = false;
		editingBulletin = null;
		invalidateAll();
	}

	function clearFilters() {
		periodFilter = 'week';
		searchTerm = '';
		employeeFilter = '';
	}
</script>

<main class="space-y-6">
	<!-- Header -->
	<HeaderBar onCreate={handleCreateClick} />

	<!-- Filters -->
	<FiltersBar
		period={periodFilter}
		{searchTerm}
		{employeeFilter}
		employees={data.employees}
		onPeriodChange={(value) => {
			periodFilter = value;
		}}
		onSearchChange={(value) => {
			searchTerm = value;
		}}
		onEmployeeChange={(value) => {
			employeeFilter = value;
		}}
		onClear={clearFilters}
	/>

	<!-- Featured Section -->
	<FeaturedSection
		bulletins={pinnedBulletins}
		onEdit={handleEditClick}
		onTogglePin={handleTogglePinBulletin}
		onDelete={(id) => onCheckConfirmation('Borrar noticia', () => handleDeleteBulletin(id))}
		onDeleteImage={(id) => onCheckConfirmation('Borrar imagen', () => handleDeleteImage(id))}
	/>

	<!-- Main Grid -->
	{#if filtered.length === 0}
		<div class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
			<div class="mb-4 text-6xl">🗞️</div>
			{#if bulletins.length === 0}
				<h3 class="mb-2 text-lg font-medium text-gray-900">No hay noticias creadas</h3>
				<p class="mb-4 text-gray-600">Comienza creando tu primer noticia para el equipo</p>
				<button
					onclick={handleCreateClick}
					class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				>
					Crear primer noticia
				</button>
			{:else}
				<h3 class="mb-2 text-lg font-medium text-gray-900">No se encontraron noticias</h3>
				<p class="mb-4 text-gray-600">Intenta ajustar los filtros de búsqueda</p>
				<button
					onclick={clearFilters}
					class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
				>
					Limpiar filtros
				</button>
			{/if}
		</div>
	{:else}
		<BulletinGrid
			bulletins={unpinnedBulletins}
			onEdit={handleEditClick}
			onTogglePin={handleTogglePinBulletin}
			onDelete={(id) => onCheckConfirmation('Borrar noticia', () => handleDeleteBulletin(id))}
			onDeleteImage={(id) => onCheckConfirmation('Borrar imagen', () => handleDeleteImage(id))}
		/>
	{/if}
</main>

<!-- Modals -->
<BulletinCreateModal
	isOpen={showCreateModal}
	{isSubmitting}
	employees={data.employees}
	onClose={handleCloseCreateModal}
	onSuccess={handleSuccess}
/>

<BulletinEditModal
	bulletin={editingBulletin}
	isOpen={showEditModal}
	{isSubmitting}
	employees={data.employees}
	onClose={handleCloseEditModal}
	onSuccess={handleSuccess}
/>

<Modal
	title="Confirmar {actionToBeConfirmed}"
	show={!!actionToBeConfirmed}
	onClose={onConfirmationEnd}
>
	<div class="space-center">
		<p>Estas seguro que deseas {actionToBeConfirmed}?</p>
	</div>
	<div class="flex justify-end space-x-3">
		<button
			type="button"
			onclick={onConfirmationEnd}
			class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		>
			Cancelar
		</button>
		<button
			type="button"
			onclick={callbackAfterConfirmation}
			class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		>
			{actionToBeConfirmed}
		</button>
	</div>
</Modal>
