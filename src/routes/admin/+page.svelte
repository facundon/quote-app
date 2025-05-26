<script lang="ts">
	import CategoriesTab from './categories/CategoriesTab.svelte';
	import StudiesTab from './studies/StudiesTab.svelte';
	import DiscountsTab from './discounts/DiscountsTab.svelte';
	import { fly } from 'svelte/transition';
	let { data } = $props();

	const TABS = {
		CATEGORIES: 'categories',
		STUDIES: 'studies',
		DISCOUNTS: 'discounts'
	} as const;

	type TabKey = (typeof TABS)[keyof typeof TABS];
	const TAB_ORDER: TabKey[] = [TABS.CATEGORIES, TABS.STUDIES, TABS.DISCOUNTS];

	let activeTab = $state<TabKey>(TABS.CATEGORIES);
	// svelte-ignore non_reactive_update
	let prevTab: TabKey | null = null;
	let prevTabIndex = 0;
	// svelte-ignore non_reactive_update
	let direction: 1 | -1 = 1;

	let categories = $derived(data.categories);
	let studies = $derived(data.studies);
	let discounts = $derived(data.discounts);

	function setTab(tab: TabKey) {
		const newIndex = TAB_ORDER.indexOf(tab);
		direction = newIndex > prevTabIndex ? 1 : -1;
		prevTab = activeTab;
		prevTabIndex = newIndex;
		activeTab = tab;
	}
</script>

<div class="mx-auto mt-10 max-w-2xl rounded-xl bg-white p-6 shadow-lg">
	<h1 class="mb-6 text-center text-2xl font-extrabold text-blue-900">Administración</h1>
	<div class="mb-6 flex w-full border-b">
		<button
			class="tab-btn relative flex-1 rounded-t-md px-4 py-2 transition-colors duration-200 focus:outline-none"
			class:bg-white={activeTab === TABS.CATEGORIES}
			class:shadow-md={activeTab === TABS.CATEGORIES}
			class:!border-b-4={activeTab === TABS.CATEGORIES}
			class:!border-blue-600={activeTab === TABS.CATEGORIES}
			class:text-blue-900={activeTab === TABS.CATEGORIES}
			class:font-semibold={activeTab === TABS.CATEGORIES}
			class:text-slate-400={activeTab !== TABS.CATEGORIES}
			class:font-normal={activeTab !== TABS.CATEGORIES}
			onclick={() => setTab(TABS.CATEGORIES)}
		>
			Categorías
		</button>
		<button
			class="tab-btn relative flex-1 rounded-t-md px-4 py-2 transition-colors duration-200 focus:outline-none"
			class:bg-white={activeTab === TABS.STUDIES}
			class:shadow-md={activeTab === TABS.STUDIES}
			class:!border-b-4={activeTab === TABS.STUDIES}
			class:!border-blue-600={activeTab === TABS.STUDIES}
			class:text-blue-900={activeTab === TABS.STUDIES}
			class:font-semibold={activeTab === TABS.STUDIES}
			class:text-slate-400={activeTab !== TABS.STUDIES}
			class:font-normal={activeTab !== TABS.STUDIES}
			onclick={() => setTab(TABS.STUDIES)}
		>
			Estudios
		</button>
		<button
			class="tab-btn relative flex-1 rounded-t-md px-4 py-2 transition-colors duration-200 focus:outline-none"
			class:bg-white={activeTab === TABS.DISCOUNTS}
			class:shadow-md={activeTab === TABS.DISCOUNTS}
			class:!border-b-4={activeTab === TABS.DISCOUNTS}
			class:!border-blue-600={activeTab === TABS.DISCOUNTS}
			class:text-blue-900={activeTab === TABS.DISCOUNTS}
			class:font-semibold={activeTab === TABS.DISCOUNTS}
			class:text-slate-400={activeTab !== TABS.DISCOUNTS}
			class:font-normal={activeTab !== TABS.DISCOUNTS}
			onclick={() => setTab(TABS.DISCOUNTS)}
		>
			Descuentos
		</button>
	</div>

	<div class="relative">
		{#if prevTab && prevTab !== activeTab}
			<div class="absolute inset-0" style="z-index: {direction === 1 ? 1 : 2};">
				{#if prevTab === TABS.CATEGORIES}
					<div out:fly={{ x: -direction * 300, duration: 250 }}>
						<CategoriesTab {categories} />
					</div>
				{:else if prevTab === TABS.STUDIES}
					<div out:fly={{ x: -direction * 300, duration: 250 }}>
						<StudiesTab {studies} {categories} />
					</div>
				{:else if prevTab === TABS.DISCOUNTS}
					<div out:fly={{ x: -direction * 300, duration: 250 }}>
						<DiscountsTab {discounts} {categories} />
					</div>
				{/if}
			</div>
		{/if}
		{#if activeTab === TABS.CATEGORIES}
			<div in:fly={{ x: direction * 300, duration: 250 }}>
				<CategoriesTab {categories} {studies} {discounts} />
			</div>
		{:else if activeTab === TABS.STUDIES}
			<div in:fly={{ x: direction * 300, duration: 250 }}>
				<StudiesTab {studies} {categories} />
			</div>
		{:else if activeTab === TABS.DISCOUNTS}
			<div in:fly={{ x: direction * 300, duration: 250 }}>
				<DiscountsTab {discounts} {categories} />
			</div>
		{/if}
	</div>
</div>

<style>
	.tab-btn {
		transition:
			background 0.2s,
			color 0.2s;
	}
	.tab-btn:hover {
		cursor: pointer;
	}
</style>
