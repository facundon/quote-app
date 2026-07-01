<script lang="ts">
	import { periodOptions, type PeriodFilter } from '../utils';

	interface Props {
		period?: PeriodFilter;
		searchTerm?: string;
		employeeFilter?: string;
		employees?: string[];
		onPeriodChange?: (value: PeriodFilter) => void;
		onSearchChange?: (value: string) => void;
		onEmployeeChange?: (value: string) => void;
		onClear?: () => void;
	}

	let {
		period = 'week',
		searchTerm = '',
		employeeFilter = '',
		employees = [],
		onPeriodChange,
		onSearchChange,
		onEmployeeChange,
		onClear
	}: Props = $props();

	let showClear = $derived(!!searchTerm || employeeFilter !== '' || period !== 'week');
</script>

<div class="space-y-4 rounded-lg bg-white p-6 shadow-sm">
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<!-- Period Filter -->
		<div>
			<label for="period" class="mb-2 block text-sm font-medium text-gray-700">Período</label>
			<select
				id="period"
				value={period}
				onchange={(e) => {
					const target = e.target as HTMLSelectElement;
					onPeriodChange?.(target.value as PeriodFilter);
				}}
				class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
			>
				{#each periodOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<!-- Search -->
		<div>
			<label for="search" class="mb-2 block text-sm font-medium text-gray-700">Buscar noticia</label
			>
			<input
				id="search"
				type="text"
				placeholder="Buscar por título..."
				value={searchTerm}
				onchange={(e) => {
					const target = e.target as HTMLInputElement;
					onSearchChange?.(target.value);
				}}
				oninput={(e) => {
					const target = e.target as HTMLInputElement;
					onSearchChange?.(target.value);
				}}
				class="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
			/>
		</div>

		<!-- Employee Filter -->
		<div>
			<label for="employee" class="mb-2 block text-sm font-medium text-gray-700">Usuario</label>
			<select
				id="employee"
				value={employeeFilter}
				onchange={(e) => {
					const target = e.target as HTMLSelectElement;
					onEmployeeChange?.(target.value);
				}}
				class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
			>
				<option value="">Todos</option>
				{#each employees as emp}
					<option value={emp}>{emp}</option>
				{/each}
			</select>
		</div>

		<!-- Clear Button -->
		<div class="flex items-end">
			{#if showClear}
				<button
					onclick={onClear}
					class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:ring-blue-500"
				>
					Limpiar filtros
				</button>
			{/if}
		</div>
	</div>
</div>
