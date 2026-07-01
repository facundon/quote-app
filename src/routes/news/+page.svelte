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

	let bulletins = $state(data.bulletins);

	// Update bulletins when data changes
	$effect(() => {
		bulletins = data.bulletins;
	});

	let filtered = $derived(() => {
		return applyFilters(bulletins, periodFilter, searchTerm, employeeFilter);
	});

	let pinnedBulletins = $derived(filtered().filter((b) => b.isPinned === 'true'));
	let unpinnedBulletins = $derived(filtered().filter((b) => b.isPinned !== 'true'));

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
		onDelete={handleDeleteBulletin}
		onTogglePin={handleTogglePinBulletin}
	/>

	<!-- Main Grid -->
	{#if filtered().length === 0}
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
			onDelete={handleDeleteBulletin}
			onTogglePin={handleTogglePinBulletin}
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
