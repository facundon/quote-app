<script lang="ts">
	import QuoteSearch from './QuoteSearch.svelte';
	import QuoteCategories from './QuoteCategories.svelte';
	import QuoteSummary from './QuoteSummary.svelte';
	import QuoteTotals from './QuoteTotals.svelte';

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
</script>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-100 to-blue-50 px-2 py-8"
>
	<div class="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-2xl">
		<h2 class="mb-6 text-center text-3xl font-extrabold tracking-tight text-blue-900">
			Presupuesto
		</h2>
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
		<QuoteCategories
			{data}
			{categoryQuantities}
			{categoryDiscounts}
			{handleInputChange}
			{selectAll}
		/>
		<QuoteSummary
			{data}
			{categoryQuantities}
			{categoryDiscounts}
			{formatInt}
			{formatNumber}
			{showSummary}
			toggleSummary={() => (showSummary = !showSummary)}
		/>
		<QuoteTotals {total} {categoryDiscounts} {formatNumber} {finalTotal} />
	</div>
</div>

<style>
</style>
