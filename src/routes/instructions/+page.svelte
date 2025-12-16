<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import SelectionControls from './components/SelectionControls.svelte';
	import InstructionColumn from './components/InstructionColumn.svelte';
	import type { Instruction } from '$lib/server/db/schema';
	import {
		buildAvailableCategories,
		DEFAULT_COLUMN_CATEGORIES,
		formatInstructionCategoryName
	} from './categories';

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

	const COLUMN_INDEXES = [0, 1] as const;
	let columnCategories = $state<string[]>([...DEFAULT_COLUMN_CATEGORIES]);
	let availableCategories = $derived(buildAvailableCategories(data.categories));

	function optionsForColumn(index: 0 | 1): string[] {
		const otherIndex = index === 0 ? 1 : 0;
		const current = columnCategories[index] || DEFAULT_COLUMN_CATEGORIES[index];
		const other = columnCategories[otherIndex] || DEFAULT_COLUMN_CATEGORIES[otherIndex];
		return availableCategories.filter((c) => c === current || c !== other);
	}

	function setColumnCategory(index: number, next: string) {
		const otherIndex = index === 0 ? 1 : 0;
		const nextCategories = columnCategories.map((c, i) => (i === index ? next : c));

		// Keep columns unique: picking a category on one side filters it out on the other.
		if (nextCategories[otherIndex] === next) {
			nextCategories[otherIndex] = availableCategories.find((c) => c !== next) ?? next;
		}

		columnCategories = nextCategories;
	}

	function resetColumnsToDefault() {
		columnCategories = [...DEFAULT_COLUMN_CATEGORIES];
	}

	// Agrupar instrucciones por categoría
	let instructionsByCategory = $derived(() => {
		const grouped: Record<string, Instruction[]> = {};

		// Inicializar con categorías disponibles (incluye vacías)
		for (const cat of availableCategories) grouped[cat] = [];

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

		<!-- Controles de columnas -->
		<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="flex flex-wrap items-center gap-4">
					{#each COLUMN_INDEXES as columnIndex (columnIndex)}
						{@const current =
							columnCategories[columnIndex] || DEFAULT_COLUMN_CATEGORIES[columnIndex]}
						<label class="flex items-center gap-2 text-sm text-gray-700">
							<span class="font-medium">Columna {columnIndex + 1}</span>
							<select
								class="w-44 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
								value={current}
								onchange={(e) =>
									setColumnCategory(columnIndex, (e.currentTarget as HTMLSelectElement).value)}
							>
								{#each optionsForColumn(columnIndex) as opt (opt)}
									<option value={opt}>{formatInstructionCategoryName(opt)}</option>
								{/each}
							</select>
						</label>
					{/each}
				</div>

				<ActionButton variant="secondary" onclick={resetColumnsToDefault}>
					Restablecer por defecto
				</ActionButton>
			</div>
		</div>

		<!-- Layout de 2 columnas -->
		<div class="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
			{#each COLUMN_INDEXES as columnIndex (columnIndex)}
				{@const category = columnCategories[columnIndex] || DEFAULT_COLUMN_CATEGORIES[columnIndex]}
				<InstructionColumn
					{category}
					instructions={instructionsByCategory()[category] || []}
					{selectedInstructions}
					onToggleSelection={toggleSelection}
					enableReorder={false}
					showActions={false}
					showSelection={true}
					showSearch={category === 'obras_sociales'}
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
