<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import SelectionControls from './components/SelectionControls.svelte';
	import InstructionColumn from './components/InstructionColumn.svelte';
	import type { Instruction } from '$lib/server/db/schema';

	interface PageData {
		instructions: Instruction[];
		categories: string[];
		searchQuery: string;
		categoryFilter: string;
	}

	let { data }: { data: PageData } = $props();

	// Estados para selección múltiple
	let selectedInstructions = $state<Set<number>>(new Set());
	let selectAll = $state(false);

	// Estados para el formulario (solo para acciones de copia)
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

		// Actualizar estado de "seleccionar todo" (solo para estudios)
		const estudiosInstructions = data.instructions.filter((i) => i.category === 'estudios');
		selectAll =
			estudiosInstructions.length > 0 &&
			estudiosInstructions.every((instruction) => selectedInstructions.has(instruction.id));
	}

	// Función para seleccionar/deseleccionar todo (solo estudios)
	function toggleSelectAll() {
		const estudiosInstructions = data.instructions.filter((i) => i.category === 'estudios');
		if (selectAll) {
			// Deseleccionar todas las de estudios, mantener las de otras categorías
			const otherCategoryIds = Array.from(selectedInstructions).filter((id) => {
				const instruction = data.instructions.find((i) => i.id === id);
				return instruction && instruction.category !== 'estudios';
			});
			selectedInstructions = new Set(otherCategoryIds);
		} else {
			// Seleccionar todas las de estudios, mantener las de otras categorías
			const newSelection = new Set(selectedInstructions);
			estudiosInstructions.forEach((i) => newSelection.add(i.id));
			selectedInstructions = newSelection;
		}
		selectAll = !selectAll;
	}

	// Función para copiar instrucciones seleccionadas al portapapeles
	async function copySelectedToClipboard() {
		// Preservar el orden de selección usando el Set (insertion order)
		const selectedIds = Array.from(selectedInstructions);
		const idToInstruction = new Map(data.instructions.map((i) => [i.id, i]));
		const selected = selectedIds
			.map((id) => idToInstruction.get(id))
			.filter(Boolean) as Instruction[];

		if (selected.length === 0) {
			showToastMessage('No hay instrucciones seleccionadas', 'error');
			return;
		}

		// Copiar solo la descripción, en el orden seleccionado, en múltiples líneas
		const blocks = selected.map((i) => `${i.description}`);
		const textToCopy = blocks.join('\n\n');

		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(textToCopy);
			} else {
				const textArea = document.createElement('textarea');
				textArea.value = textToCopy;
				textArea.style.position = 'fixed';
				textArea.style.left = '-999999px';
				textArea.style.top = '-999999px';
				document.body.appendChild(textArea);
				textArea.focus();
				textArea.select();
				document.execCommand('copy');
				textArea.remove();
			}

			showToastMessage(`✅ Copiadas ${selected.length} instrucciones`, 'success');

			// Limpiar selección después de copiar
			selectedInstructions = new Set();
			selectAll = false;
		} catch (err) {
			showToastMessage('Error al copiar al portapapapeles', 'error');
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
</script>

<svelte:head>
	<title>Instrucciones - Laboratorio</title>
</svelte:head>

<div class="mx-auto max-w-6xl">
	<div class="rounded-xl bg-white p-8 shadow-lg">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-extrabold text-blue-900">Instrucciones</h1>
		</div>

		<!-- Controles de selección y copia - globales (solo afectan 'estudios') -->
		{#if data.instructions.filter((i) => i.category === 'estudios').length > 0}
			<SelectionControls
				totalInstructions={data.instructions.filter((i) => i.category === 'estudios').length}
				selectedCount={selectedInstructions.size}
				{selectAll}
				onToggleSelectAll={toggleSelectAll}
				onCopySelected={copySelectedToClipboard}
				{isSubmitting}
			/>
		{/if}

		<!-- Layout de 2 columnas -->
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			{#each defaultCategories as category}
				<InstructionColumn
					{category}
					instructions={instructionsByCategory()[category] || []}
					{selectedInstructions}
					onToggleSelection={toggleSelection}
					enableReorder={false}
					showActions={false}
					showSelection={true}
				/>
			{/each}
		</div>
	</div>
</div>

<!-- Sin modales en vista pública; solo selección y copia -->

<!-- Toast notifications -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} onClose={closeToast} />
{/if}
