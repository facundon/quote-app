<script lang="ts">
	import CategoriesTab from './categories/CategoriesTab.svelte';
	import StudiesTab from './studies/StudiesTab.svelte';
	import DiscountsTab from './discounts/DiscountsTab.svelte';
	import ProvidersTab from './providers/ProvidersTab.svelte';
	import { fly } from 'svelte/transition';
	import { isAuthenticated, logout } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import LoginForm from '$lib/components/LoginForm.svelte';

	let { data } = $props();

	const TABS = {
		CATEGORIES: 'categories',
		STUDIES: 'studies',
		DISCOUNTS: 'discounts',
		PROVIDERS: 'providers'
	} as const;

	type TabKey = (typeof TABS)[keyof typeof TABS];
	const TAB_ORDER: TabKey[] = [TABS.CATEGORIES, TABS.STUDIES, TABS.DISCOUNTS, TABS.PROVIDERS];

	let activeTab = $state<TabKey>(TABS.CATEGORIES);
	// svelte-ignore non_reactive_update
	let prevTab: TabKey | null = null;
	let prevTabIndex = 0;
	// svelte-ignore non_reactive_update
	let direction: 1 | -1 = 1;

	let categories = $derived(data.categories);
	let studies = $derived(data.studies);
	let discounts = $derived(data.discounts);
	let providers = $derived(data.providers);
	let invoices = $derived(data.invoices);

	function setTab(tab: TabKey) {
		const newIndex = TAB_ORDER.indexOf(tab);
		direction = newIndex > prevTabIndex ? 1 : -1;
		prevTab = activeTab;
		prevTabIndex = newIndex;
		activeTab = tab;
	}

	function handleLogout() {
		logout();
		goto('/presupuesto');
	}
</script>

{#if !$isAuthenticated}
	<LoginForm />
{:else}
	<div class="mx-auto max-w-4xl">
		<div class="rounded-xl bg-white p-6 shadow-lg">
			<div class="mb-6 flex items-center justify-between">
				<h1 class="text-2xl font-extrabold text-blue-900">Administración</h1>
				<button
					onclick={handleLogout}
					class="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none"
				>
					Cerrar Sesión
				</button>
			</div>

			<div class="mb-6 flex w-full border-b">
				<button
					class="tab-btn relative flex-1 rounded-t-md px-4 py-2 transition-colors duration-200 focus:outline-none"
					class:bg-white={activeTab === TABS.CATEGORIES}
					class:shadow-md={activeTab === TABS.CATEGORIES}
					class:!border-b-4={activeTab === TABS.CATEGORIES}
					class:!border-blue-600={activeTab === TABS.CATEGORIES}
					class:text-blue-900={activeTab === TABS.CATEGORIES}
					class:font-semibold={activeTab === TABS.CATEGORIES}
					class:text-gray-700={activeTab !== TABS.CATEGORIES}
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
					class:text-gray-700={activeTab !== TABS.STUDIES}
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
					class:text-gray-700={activeTab !== TABS.DISCOUNTS}
					class:font-normal={activeTab !== TABS.DISCOUNTS}
					onclick={() => setTab(TABS.DISCOUNTS)}
				>
					Descuentos
				</button>
				<button
					class="tab-btn relative flex-1 rounded-t-md px-4 py-2 transition-colors duration-200 focus:outline-none"
					class:bg-white={activeTab === TABS.PROVIDERS}
					class:shadow-md={activeTab === TABS.PROVIDERS}
					class:!border-b-4={activeTab === TABS.PROVIDERS}
					class:!border-blue-600={activeTab === TABS.PROVIDERS}
					class:text-blue-900={activeTab === TABS.PROVIDERS}
					class:font-semibold={activeTab === TABS.PROVIDERS}
					class:text-gray-700={activeTab !== TABS.PROVIDERS}
					class:font-normal={activeTab !== TABS.PROVIDERS}
					onclick={() => setTab(TABS.PROVIDERS)}
				>
					Proveedores
				</button>
			</div>

			<div class="relative">
				{#if prevTab && prevTab !== activeTab}
					<div class="absolute inset-0" style="z-index: {direction === 1 ? 1 : 2};">
						{#if prevTab === TABS.CATEGORIES}
							<div out:fly={{ x: -direction * 300, duration: 250 }}>
								<CategoriesTab {categories} {studies} {discounts} />
							</div>
						{:else if prevTab === TABS.STUDIES}
							<div out:fly={{ x: -direction * 300, duration: 250 }}>
								<StudiesTab {studies} {categories} />
							</div>
						{:else if prevTab === TABS.DISCOUNTS}
							<div out:fly={{ x: -direction * 300, duration: 250 }}>
								<DiscountsTab {discounts} {categories} />
							</div>
						{:else if prevTab === TABS.PROVIDERS}
							<div out:fly={{ x: -direction * 300, duration: 250 }}>
								<ProvidersTab {providers} {invoices} />
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
				{:else if activeTab === TABS.PROVIDERS}
					<div in:fly={{ x: direction * 300, duration: 250 }}>
						<ProvidersTab {providers} {invoices} />
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

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
