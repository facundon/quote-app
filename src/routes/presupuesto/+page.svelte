<script lang="ts">
	import QuoteSearch from './QuoteSearch.svelte';
	import QuoteCategories from './QuoteCategories.svelte';
	import QuoteSummary from './QuoteSummary.svelte';
	import QuoteTotals from './QuoteTotals.svelte';
	import ResetButton from './ResetButton.svelte';
	import ChatPanel from './ChatPanel.svelte';

	let { data } = $props();

	type Mode = 'manual' | 'chat';
	let mode = $state<Mode>('manual');

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

	let finalTotal = $derived.by(() => Math.floor((total - totalDiscountAmount) / 1000) * 1000);

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

	function resetBudget() {
		// Reset all category quantities to 0
		categoryQuantities = Object.fromEntries(data.categories.map((cat) => [cat.id, 0]));
		// Clear search
		search = '';
		selectedStudy = null;
		showSuggestions = false;
		highlightedIndex = -1;
	}
</script>

<div class="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col">
	<div class="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
		<h2 class="mb-6 text-center text-3xl font-extrabold tracking-tight text-blue-900">
			Presupuesto
		</h2>

		<div class="mb-6 flex justify-center">
			<div class="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
				<button
					type="button"
					onclick={() => (mode = 'manual')}
					class="rounded-md px-4 py-2 text-sm font-medium transition {mode === 'manual'
						? 'bg-white text-blue-900 shadow-sm'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					📊 Manual
				</button>
				<button
					type="button"
					onclick={() => (mode = 'chat')}
					class="rounded-md px-4 py-2 text-sm font-medium transition {mode === 'chat'
						? 'bg-white text-blue-900 shadow-sm'
						: 'text-slate-600 hover:text-slate-900'}"
				>
					💬 Chat
				</button>
			</div>
		</div>

		{#if mode === 'chat'}
			<ChatPanel />
		{:else}
			<QuoteSearch
				{search}
				{selectedStudy}
				{showSuggestions}
				{highlightedIndex}
				{data}
				{handleSearchInput}
				{handleSearchKeydown}
				{selectSuggestion}
			/>
			<div class="mt-4 flex justify-end">
				<ResetButton onReset={resetBudget} variant="danger" />
			</div>
			<QuoteCategories
				{data}
				{categoryQuantities}
				{categoryDiscounts}
				{handleInputChange}
				{selectAll}
			/>
			<div class="flex justify-end">
				<span class="text-large inline-flex items-center bg-white px-3 py-1">
					Total: {formatInt(totalQuantity)} estudios
				</span>
			</div>
			<QuoteSummary
				{data}
				{categoryQuantities}
				{categoryDiscounts}
				{formatInt}
				{formatNumber}
				{showSummary}
				toggleSummary={() => (showSummary = !showSummary)}
			/>
			<QuoteTotals {total} {categoryDiscounts} {formatNumber} {finalTotal} {totalQuantity} />
			<div class="mt-6 flex justify-end">
				<ResetButton onReset={resetBudget} variant="danger" />
			</div>
		{/if}
	</div>
</div>

<style>
</style>
