<script lang="ts">
	import type { Category, Study } from './types';
	import { matchesSearch } from '$lib/utils/search';
	import { splitFixedPrice } from '$lib/utils/pricing';

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

	function handleSearch(e: KeyboardEvent) {
		handleSearchKeydown(
			e,
			data.studies.filter((s: Study) => matchesSearch(s.name, search))
		);
	}
</script>

<div class="mb-6 w-full">
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
			onkeydown={handleSearch}
			class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
			autocomplete="off"
		/>
		{#if selectedStudy}
			<span class="w-full truncate text-center text-sm font-bold text-blue-900">
				{data.categories.find((c: Category) => c.id === selectedStudy?.category_id)?.name}
			</span>
		{:else}
			<span class="w-full truncate text-center text-sm font-bold text-blue-900">
				Selecciona un estudio
			</span>
		{/if}
		{#if showSuggestions && search.trim()}
			<ul
				class="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
			>
				{#each data.studies.filter((s: Study) => matchesSearch(s.name, search)) as s: Study, i (s.id)}
					{@const { label, price } = splitFixedPrice(s.name)}
					<li>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-100 {highlightedIndex ===
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
							{label}
							{#if price}
								<span
									class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700"
									>${price}</span
								>
							{/if}
						</button>
					</li>
				{/each}
				{#if data.studies.filter((s: Study) => matchesSearch(s.name, search)).length === 0}
					<li class="px-3 py-2 text-sm text-slate-400">Sin resultados</li>
				{/if}
			</ul>
		{/if}
	</div>
</div>
