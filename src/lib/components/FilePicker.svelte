<script lang="ts">
	let {
		id,
		name,
		accept = '.pdf',
		required = false,
		placeholder = 'Seleccionar archivo',
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

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			onFileSelected?.(target.files[0], id);
		}
	}

	// Determine what text to show
	let displayText = $derived(selectedFileName || existingFileName || placeholder);
</script>

<div class="relative">
	<input
		type="file"
		{id}
		{name}
		{accept}
		{required}
		onchange={handleFileChange}
		class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
	/>
	<div
		class="flex items-center justify-between rounded border bg-white px-3 py-2 transition-colors hover:border-gray-400"
	>
		<span class="truncate text-sm text-gray-600">
			{displayText}
		</span>
		<svg
			class="ml-2 h-5 w-5 flex-shrink-0 text-gray-400"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
			></path>
		</svg>
	</div>
</div>
