<script lang="ts">
	import type { Category, Study } from './types';
	let {
		search,
		selectedStudy,
		showSuggestions,
		highlightedIndex,
		data,
		handleSearchInput,
		handleSearchKeydown,
		selectSuggestion
	}: {
		search: string;
		selectedStudy: Study | null;
		showSuggestions: boolean;
		highlightedIndex: number;
		data: { studies: Study[]; categories: Category[] };
		handleSearchInput: (e: Event) => void;
		handleSearchKeydown: (e: KeyboardEvent, suggestions: Study[]) => void;
		selectSuggestion: (study: Study) => void;
	} = $props();
</script>

<div class="mx-auto mb-6 max-w-xl">
	<label for="search-input" class="mb-1 block text-sm font-semibold text-blue-900"
		>Buscar estudio</label
	>
	<div class="relative flex flex-row flex-wrap items-center gap-3">
		<input
			id="search-input"
			type="text"
			placeholder="Buscar estudio..."
			bind:value={search}
			oninput={handleSearchInput}
			onkeydown={(e: KeyboardEvent) =>
				handleSearchKeydown(
					e,
					data.studies.filter((s: Study) => s.name.toLowerCase().includes(search.toLowerCase()))
				)}
			class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-400 focus:outline-none sm:w-64"
			autocomplete="off"
		/>
		{#if selectedStudy}
			<span class="max-w-xs truncate text-sm font-medium text-blue-900">
				{data.categories.find((c: Category) => c.id === selectedStudy?.category_id)?.name}
			</span>
		{/if}
		{#if showSuggestions && search.trim()}
			<ul
				class="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
			>
				{#each data.studies.filter((s: Study) => s.name
						.toLowerCase()
						.includes(search.toLowerCase())) as s: Study, i (s.id)}
					<li>
						<button
							type="button"
							class="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-blue-100 {highlightedIndex ===
							i
								? 'bg-blue-100'
								: ''}"
							onmousedown={() => selectSuggestion(s)}
							onmouseover={() => {
								highlightedIndex = i;
								selectedStudy = s;
							}}
							onfocus={() => {
								highlightedIndex = i;
								selectedStudy = s;
							}}
						>
							{s.name}
						</button>
					</li>
				{/each}
				{#if data.studies.filter((s: Study) => s.name
						.toLowerCase()
						.includes(search.toLowerCase())).length === 0}
					<li class="px-3 py-2 text-sm text-slate-400">Sin resultados</li>
				{/if}
			</ul>
		{/if}
	</div>
</div>
