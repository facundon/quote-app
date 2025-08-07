<script lang="ts">
	let {
		id,
		name,
		accept = '.pdf',
		required = false,
		placeholder = 'Seleccionar o arrastrar archivo',
		selectedFileName = null,
		existingFileName = null,
		onFileSelected
	}: {
		id: string;
		name: string;
		accept?: string;
		required?: boolean;
		placeholder?: string;
		selectedFileName?: string | null;
		existingFileName?: string | null;
		onFileSelected?: (file: File, id: string) => void;
	} = $props();

	let displayText = $state(placeholder);
	let hasExistingFile = $state(false);
	let hasSelectedFile = $state(false);
	let showGreenBackground = $state(false);

	$effect(() => {
		displayText = selectedFileName || existingFileName || placeholder;
		hasExistingFile = !!existingFileName;
		hasSelectedFile = !!selectedFileName;
		showGreenBackground = hasExistingFile && !hasSelectedFile;
	});

	let isDragging = $state(false);
	let wasDropped = $state(false);
	let fileInput: HTMLInputElement | null = null;

	function triggerFileDialog() {
		fileInput?.click();
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			onFileSelected?.(target.files[0], id);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
			onFileSelected?.(event.dataTransfer.files[0], id);
			wasDropped = true;
			setTimeout(() => { wasDropped = false; }, 1200); // efecto visual breve
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}
</script>

<div class="relative">
	<input
		type="file"
		bind:this={fileInput}
		id={id}
		name={name}
		accept={accept}
		required={required}
		onchange={handleFileChange}
		class="hidden"
	/>
	<button
		type="button"
		class="w-full rounded border px-3 py-2.5 transition-all duration-200 hover:border-gray-400"
		class:border-green-300={showGreenBackground}
		class:bg-green-50={showGreenBackground || wasDropped}
		class:text-green-700={showGreenBackground}
		class:border-gray-500={!showGreenBackground}
		class:bg-white={!showGreenBackground && !wasDropped && !isDragging}
		class:border-2={isDragging || wasDropped}
		class:border-blue-500={isDragging}
		class:bg-blue-50={isDragging}
		class:shadow-lg={isDragging || wasDropped}
		class:animate-pulse={isDragging}
		class:border-green-500={wasDropped}
		class:animate-bounce={wasDropped}
		style="height: 200%; min-height: 5rem; display: flex; align-items: center; cursor: pointer;"
		onclick={triggerFileDialog}
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
	>
		<div class="flex items-center justify-between w-full">
			<span class="truncate text-sm flex items-center gap-2">
				{#if isDragging}
					<svg class="h-5 w-5 text-blue-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
					<span class="font-semibold text-blue-700">¡Suelta el archivo aquí!</span>
				{:else if wasDropped}
					<svg class="h-5 w-5 text-green-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
					<span class="font-semibold text-green-700">¡Archivo cargado!</span>
				{:else}
					{displayText}
				{/if}
			</span>
			<svg
				class="ml-2 h-5 w-5 flex-shrink-0 {showGreenBackground
					? 'text-green-500'
					: 'text-gray-400'}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
				></path>
			</svg>
		</div>
	</button>
</div>
