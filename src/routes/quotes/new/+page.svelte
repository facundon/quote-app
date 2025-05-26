<script lang="ts">
	let { data } = $props();

	let categoryQuantities = $state<{ [categoryId: number]: number }>(
		Object.fromEntries(data.categories.map((cat) => [cat.id, 0]))
	);
	let showSummary = $state(true);
	let search = $state('');
	let selectedStudy = $state<{ id: number; name: string; category_id: number } | null>(null);
	let showSuggestions = $state(false);
	let highlightedIndex = $state(-1);

	function handleInputChange(e: Event, categoryId: number) {
		const target = e.target as HTMLInputElement;
		categoryQuantities = { ...categoryQuantities, [categoryId]: +target.value };
	}

	function formatNumber(n: number) {
		return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
	function formatInt(n: number) {
		return n.toLocaleString('es-AR');
	}

	let totalQuantity = $derived.by(() =>
		Object.values(categoryQuantities).reduce((sum, q) => sum + q, 0)
	);

	let total = $derived.by(() =>
		data.categories.reduce(
			(sum, cat) => sum + (categoryQuantities[cat.id] || 0) * cat.unit_price,
			0
		)
	);

	let categoryDiscounts = $derived.by(() => {
		const result: {
			category_id: number;
			min_quantity: number | null;
			percentage: number;
			applied: boolean;
			amount: number;
			category_name: string;
		}[] = [];
		const totalQty = totalQuantity;
		for (const cat of data.categories) {
			const qty = categoryQuantities[cat.id] || 0;
			const discounts = data.discounts.filter(
				(d) => d.category_id === cat.id && totalQty >= d.min_quantity
			);
			if (discounts.length > 0) {
				const best = discounts.sort((a, b) => b.percentage - a.percentage)[0];
				const subtotal = qty * cat.unit_price;
				result.push({
					category_id: cat.id,
					min_quantity: best.min_quantity,
					percentage: best.percentage,
					applied: true,
					amount: (subtotal * best.percentage) / 100,
					category_name: cat.name
				});
			} else {
				// No discount for this category
				result.push({
					category_id: cat.id,
					min_quantity: null,
					percentage: 0,
					applied: false,
					amount: 0,
					category_name: cat.name
				});
			}
		}
		return result;
	});

	let totalDiscountAmount = $derived.by(() =>
		categoryDiscounts.reduce((sum, d) => sum + d.amount, 0)
	);

	let finalTotal = $derived.by(() => total - totalDiscountAmount);

	function selectAll(e: Event) {
		(e.target as HTMLInputElement).select();
	}

	function handleSearchInput(e: Event) {
		search = (e.target as HTMLInputElement).value;
		showSuggestions = !!search.trim();
		highlightedIndex = -1;
		selectedStudy = null;
	}

	function selectSuggestion(study: { id: number; name: string; category_id: number }) {
		selectedStudy = study;
		search = study.name;
		showSuggestions = false;
		highlightedIndex = -1;
	}

	function handleSearchKeydown(
		e: KeyboardEvent,
		suggestions: { id: number; name: string; category_id: number }[]
	) {
		if (!showSuggestions || suggestions.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = (highlightedIndex + 1) % suggestions.length;
			selectedStudy = suggestions[highlightedIndex];
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = (highlightedIndex - 1 + suggestions.length) % suggestions.length;
			selectedStudy = suggestions[highlightedIndex];
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
				selectSuggestion(suggestions[highlightedIndex]);
			}
		} else if (e.key === 'Escape') {
			showSuggestions = false;
			highlightedIndex = -1;
		}
	}
</script>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-2 py-8"
>
	<div class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-2xl">
		<h2 class="mb-6 text-center text-3xl font-extrabold tracking-tight text-blue-900">
			Presupuesto
		</h2>
		<!-- Buscador de estudios -->
		<div class="mx-auto mb-6 max-w-xl">
			<label class="mb-1 block text-sm font-semibold text-blue-900">Buscar estudio</label>
			<div class="relative flex flex-row flex-wrap items-center gap-3">
				<input
					type="text"
					placeholder="Buscar estudio..."
					bind:value={search}
					oninput={handleSearchInput}
					onkeydown={(e) =>
						handleSearchKeydown(
							e,
							data.studies.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
						)}
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-400 focus:outline-none sm:w-64"
					autocomplete="off"
				/>
				{#if selectedStudy}
					<span class="max-w-xs truncate text-sm font-medium text-blue-900">
						{data.categories.find((c) => c.id === selectedStudy?.category_id)?.name}
					</span>
				{/if}
				{#if showSuggestions && search.trim()}
					<ul
						class="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
					>
						{#each data.studies.filter((s) => s.name
								.toLowerCase()
								.includes(search.toLowerCase())) as s, i}
							<li
								class="cursor-pointer px-3 py-2 text-sm hover:bg-blue-100 {highlightedIndex === i
									? 'bg-blue-100'
									: ''}"
								onmousedown={() => selectSuggestion(s)}
								onmouseover={() => {
									highlightedIndex = i;
									selectedStudy = s;
								}}
							>
								{s.name}
							</li>
						{/each}
						{#if data.studies.filter((s) => s.name
								.toLowerCase()
								.includes(search.toLowerCase())).length === 0}
							<li class="px-3 py-2 text-sm text-slate-400">Sin resultados</li>
						{/if}
					</ul>
				{/if}
			</div>
		</div>
		<div class="mt-2 mb-8 rounded-xl bg-blue-50/60 p-4">
			<h3 class="mb-6 border-b-4 border-blue-400 pb-2 text-2xl font-extrabold text-blue-900">
				Categorías
			</h3>
			<ul class="divide-y divide-slate-200">
				{#each data.categories as cat}
					{@const d = categoryDiscounts.find((x) => x.category_id === cat.id)}
					{@const unitDiscount = d && d.applied ? d.amount / (categoryQuantities[cat.id] || 1) : 0}
					{@const unitFinal = cat.unit_price - unitDiscount}
					<li class="flex items-center gap-2 py-2">
						<span class="flex-1 font-medium">{cat.name}</span>
						{#if d && d.applied && unitDiscount > 0}
							<span class="text-xs text-red-400 line-through">${cat.unit_price.toFixed(2)}</span>
							<span class="ml-1 text-xs font-bold text-green-700">${unitFinal.toFixed(2)} c/u</span>
						{:else}
							<span class="text-xs text-slate-500">${cat.unit_price.toFixed(2)} c/u</span>
						{/if}
						<input
							type="number"
							min="0"
							bind:value={categoryQuantities[cat.id]}
							oninput={(e) => handleInputChange(e, cat.id)}
							onfocus={selectAll}
							onclick={selectAll}
							class="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
						/>
					</li>
				{/each}
			</ul>
		</div>

		{#if Object.values(categoryQuantities).some((q) => q > 0)}
			<div class="mt-6 mb-2">
				<div class="mb-2 flex items-center gap-1">
					<h3 class="text-lg font-bold text-blue-900">Resumen</h3>
					<button
						type="button"
						class="ml-1 flex items-center p-0 text-blue-700 transition hover:text-blue-900"
						onclick={() => (showSummary = !showSummary)}
						aria-expanded={showSummary}
						aria-controls="summary-panel"
					>
						<svg
							class="h-5 w-5 transition-transform duration-200"
							style:transform={showSummary ? 'rotate(90deg)' : 'rotate(0deg)'}
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg
						>
					</button>
				</div>
				<div
					id="summary-panel"
					class="overflow-hidden transition-all duration-300"
					style:height={showSummary ? 'auto' : '0'}
					style:paddingTop={showSummary ? '0.5rem' : '0'}
					style:paddingBottom={showSummary ? '0.5rem' : '0'}
					style:marginBottom={showSummary ? '0.5rem' : '0'}
				>
					{#if showSummary}
						<ul class="divide-y divide-slate-200">
							{#each data.categories as cat}
								{#if categoryQuantities[cat.id] > 0}
									{@const d = categoryDiscounts.find((x) => x.category_id === cat.id)}
									{@const unitDiscount =
										d && d.applied && categoryQuantities[cat.id] > 0
											? d.amount / categoryQuantities[cat.id]
											: 0}
									{@const unitFinal = cat.unit_price - unitDiscount}
									<li class="flex min-h-8 items-center gap-2 py-1 text-sm text-slate-700">
										<span class="min-w-0 flex-1 truncate font-medium">{cat.name}</span>
										<span class="ml-2 text-xs whitespace-nowrap text-slate-500">
											{formatInt(categoryQuantities[cat.id])} x ${formatNumber(unitFinal)} =
											<span class="font-semibold">
												${formatNumber(unitFinal * categoryQuantities[cat.id])}
											</span>
										</span>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/if}

		<div
			class="mt-8 flex flex-col gap-2 rounded-lg border-t-4 border-blue-400 bg-slate-50 px-4 pt-8 shadow-inner"
		>
			<div class="mb-2 flex flex-col items-end gap-2">
				<div class="mb-1 w-full">
					<div class="flex w-full items-center gap-2">
						<span class="text-base text-slate-700">Subtotal</span>
						<span class="flex-grow"></span>
						<span class="rounded-full bg-slate-100 px-2 py-0.5 text-base font-bold text-blue-900"
							>${formatNumber(total)}</span
						>
					</div>
					<div class="mt-1 w-full border-b border-dotted border-gray-300"></div>
				</div>
				{#if categoryDiscounts.some((d) => d.applied)}
					{#each categoryDiscounts as d}
						{#if d.applied}
							<div class="mb-1 w-full">
								<div class="flex w-full items-center gap-2">
									<span class="text-base font-semibold whitespace-nowrap text-green-700"
										>Descuento {d.category_name}</span
									>
									<span class="flex-grow"></span>
									<span class="font-semibold whitespace-nowrap text-red-500"
										>- ${formatNumber(d.amount)}</span
									>
								</div>
								<div class="mt-1 w-full border-b border-dotted border-gray-300"></div>
							</div>
						{/if}
					{/each}
				{/if}
			</div>
			<div class="mt-2 mb-2 flex flex-col items-center justify-center">
				<span class="text-xl font-extrabold text-blue-900">Total</span>
				<span class="text-4xl font-extrabold tracking-tight text-blue-900"
					>${formatNumber(finalTotal)}</span
				>
			</div>
		</div>
	</div>
</div>

<style>
	body {
		background: linear-gradient(120deg, #f8fafc 0%, #e0e7ef 100%);
	}
</style>
