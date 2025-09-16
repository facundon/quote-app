<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import SelectionControls from './components/SelectionControls.svelte';
	import InstructionColumn from './components/InstructionColumn.svelte';
	import InstructionCreateForm from './components/InstructionCreateForm.svelte';
	import InstructionEditForm from './components/InstructionEditForm.svelte';
	import type { Instruction } from '$lib/server/db/schema';

	interface PageData {
		instructions: Instruction[];
		categories: string[];
		searchQuery: string;
		categoryFilter: string;
	}

	let { data }: { data: PageData } = $props();

	// Estados para los modales
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingInstruction = $state<Instruction | null>(null);

	// Estados para selección múltiple
	let selectedInstructions = $state<Set<number>>(new Set());
	let selectAll = $state(false);

	// Estados para el formulario
	let isSubmitting = $state(false);
	let toastMessage = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let showToast = $state(false);

	// Categorías por defecto para las dos columnas
	const defaultCategories = ['estudios', 'obras_sociales'];

	// Agrupar instrucciones por categoría
	let instructionsByCategory = $derived(() => {
		const grouped: Record<string, Instruction[]> = {};

		// Inicializar con categorías por defecto
		defaultCategories.forEach((cat) => {
			grouped[cat] = [];
		});

		// Agrupar instrucciones
		data.instructions.forEach((instruction) => {
			if (!grouped[instruction.category]) {
				grouped[instruction.category] = [];
			}
			grouped[instruction.category].push(instruction);
		});

		return grouped;
	});

	// Función para manejar selección individual
	function toggleSelection(id: number) {
		if (selectedInstructions.has(id)) {
			selectedInstructions.delete(id);
		} else {
			selectedInstructions.add(id);
		}
		selectedInstructions = new Set(selectedInstructions);

		// Actualizar estado de "seleccionar todo"
		const allInstructions = data.instructions.map((i) => i.id);
		selectAll = allInstructions.every((id) => selectedInstructions.has(id));
	}

	// Función para seleccionar/deseleccionar todo
	function toggleSelectAll() {
		if (selectAll) {
			selectedInstructions = new Set();
		} else {
			selectedInstructions = new Set(data.instructions.map((i) => i.id));
		}
		selectAll = !selectAll;
	}

	// Función para copiar instrucciones seleccionadas al portapapeles
	async function copySelectedToClipboard() {
		const selected = data.instructions.filter((i) => selectedInstructions.has(i.id));

		if (selected.length === 0) {
			showToastMessage('No hay instrucciones seleccionadas', 'error');
			return;
		}

		const textToCopy = selected
			.map((instruction) => `${instruction.title}\n${instruction.description}`)
			.join('\n\n---\n\n');

		try {
			await navigator.clipboard.writeText(textToCopy);
			showToastMessage(`${selected.length} instrucción(es) copiada(s) al portapapeles`, 'success');

			// Limpiar selección después de copiar
			selectedInstructions = new Set();
			selectAll = false;
		} catch (err) {
			showToastMessage('Error al copiar al portapapeles', 'error');
			console.error('Error copying to clipboard:', err);
		}
	}

	// Función para mostrar toast
	function showToastMessage(message: string, type: 'success' | 'error') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	// Función para cerrar toast
	function closeToast() {
		showToast = false;
	}

	// Función para abrir modal de edición
	function openEditModal(instruction: Instruction) {
		editingInstruction = instruction;
		showEditModal = true;
	}

	// Función para cerrar modales
	function closeModals() {
		showCreateModal = false;
		showEditModal = false;
		editingInstruction = null;
		isSubmitting = false;
	}

	// Función para manejar resultados de formularios
	function handleFormResult(result: any) {
		if (result?.success) {
			showToastMessage(result.message || 'Operación exitosa', 'success');
			closeModals();
			invalidateAll();
		} else if (result?.error) {
			showToastMessage(result.error, 'error');
		}
		isSubmitting = false;
	}
</script>

<svelte:head>
	<title>Instrucciones - Quote App</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<div class="sm:flex sm:items-center sm:justify-between">
				<div>
					<h1 class="text-3xl font-bold tracking-tight text-gray-900">Instrucciones</h1>
					<p class="mt-2 text-sm text-gray-700">
						Gestiona y copia instrucciones organizadas por categorías
					</p>
				</div>
				<div class="mt-4 sm:mt-0">
					<ActionButton
						onclick={() => (showCreateModal = true)}
						variant="primary"
						disabled={isSubmitting}
					>
						📝 Nueva Instrucción
					</ActionButton>
				</div>
			</div>
		</div>

		<!-- Controles de selección y copia -->
		<SelectionControls
			totalInstructions={data.instructions.length}
			selectedCount={selectedInstructions.size}
			{selectAll}
			onToggleSelectAll={toggleSelectAll}
			onCopySelected={copySelectedToClipboard}
			{isSubmitting}
		/>

		<!-- Layout de 2 columnas -->
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			{#each defaultCategories as category}
				<InstructionColumn
					{category}
					instructions={instructionsByCategory()[category] || []}
					{selectedInstructions}
					onToggleSelection={toggleSelection}
					onEdit={openEditModal}
					onFormResult={handleFormResult}
					onCreateNew={() => (showCreateModal = true)}
				/>
			{/each}
		</div>
	</div>
</div>

<!-- Modal de crear instrucción -->
{#if showCreateModal}
	<Modal title="Nueva Instrucción" show={showCreateModal} onClose={closeModals}>
		<InstructionCreateForm
			{isSubmitting}
			{defaultCategories}
			onCancel={closeModals}
			onFormResult={handleFormResult}
			onSubmitStart={() => (isSubmitting = true)}
		/>
	</Modal>
{/if}

<!-- Modal de editar instrucción -->
{#if showEditModal && editingInstruction}
	<Modal title="Editar Instrucción" show={showEditModal} onClose={closeModals}>
		<InstructionEditForm
			instruction={editingInstruction}
			{isSubmitting}
			{defaultCategories}
			onCancel={closeModals}
			onFormResult={handleFormResult}
			onSubmitStart={() => (isSubmitting = true)}
		/>
	</Modal>
{/if}

<!-- Toast notifications -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} onClose={closeToast} />
{/if}
