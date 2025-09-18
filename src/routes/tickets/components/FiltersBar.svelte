<script lang="ts">
	import EmployeeSelect from '$lib/components/EmployeeSelect.svelte';

	let {
		searchTerm = $bindable(''),
		empleadoFilter = $bindable(''),
		prioridadFilter = $bindable('all'),
		statusFilter = $bindable<'all' | 'resolved'>('all'),
		employees = [] as string[],
		quickCounts = { nonResolved: 0, resolved: 0 },
		onClear
	}: {
		searchTerm?: string;
		empleadoFilter?: string;
		prioridadFilter?: string;
		statusFilter?: 'all' | 'resolved';
		employees?: string[];
		quickCounts?: { nonResolved: number; resolved: number };
		onClear: () => void;
	} = $props();
</script>

<div class="mb-6 rounded-lg bg-gray-50 p-6">
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div class="min-w-64 flex-1">
			<label for="search" class="mb-1 block text-sm font-medium text-gray-700"
				>🔍 Buscar tickets</label
			>
			<input
				id="search"
				type="text"
				bind:value={searchTerm}
				placeholder="Título, descripción o asignado..."
				class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
			/>
		</div>

		<div class="min-w-56">
			<div class="mb-1 block text-sm font-medium text-gray-700">Personal</div>
			<EmployeeSelect
				name="empleadoFilter"
				bind:value={empleadoFilter}
				{employees}
				includeAll={true}
				allLabel="Todos"
				allValue=""
				placeholder="Seleccionar personal"
			/>
		</div>

		<div class="mt-4 flex w-full items-end gap-4 md:col-span-2">
			<div class="flex min-w-0 flex-1 items-end gap-4">
				<div>
					<div class="mb-1 block text-sm font-medium text-gray-700">Estados</div>
					<div class="flex items-center gap-2">
						<button
							onclick={() => (statusFilter = 'all')}
							class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none"
							class:bg-blue-600={statusFilter === 'all'}
							class:text-white={statusFilter === 'all'}
							class:border-blue-600={statusFilter === 'all'}
							class:ring-2={statusFilter === 'all'}
							class:ring-blue-200={statusFilter === 'all'}
							class:bg-white={statusFilter !== 'all'}
							class:text-blue-700={statusFilter !== 'all'}
							class:border-blue-300={statusFilter !== 'all'}
							aria-pressed={statusFilter === 'all'}
						>
							<span
								class="h-2 w-2 rounded-full"
								class:bg-white={statusFilter === 'all'}
								class:bg-blue-600={statusFilter !== 'all'}
							></span>
							No resueltos
							<span
								class="rounded px-2 py-0.5 text-xs font-semibold"
								class:bg-blue-500={statusFilter === 'all'}
								class:text-white={statusFilter === 'all'}
								class:bg-blue-50={statusFilter !== 'all'}
								class:text-blue-800={statusFilter !== 'all'}>{quickCounts.nonResolved}</span
							>
						</button>
						<button
							onclick={() => (statusFilter = 'resolved')}
							class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none"
							class:bg-green-600={statusFilter === 'resolved'}
							class:text-white={statusFilter === 'resolved'}
							class:border-green-600={statusFilter === 'resolved'}
							class:ring-2={statusFilter === 'resolved'}
							class:ring-green-200={statusFilter === 'resolved'}
							class:bg-white={statusFilter !== 'resolved'}
							class:text-green-700={statusFilter !== 'resolved'}
							class:border-green-300={statusFilter !== 'resolved'}
							aria-pressed={statusFilter === 'resolved'}
						>
							<span
								class="h-2 w-2 rounded-full"
								class:bg-white={statusFilter === 'resolved'}
								class:bg-green-600={statusFilter !== 'resolved'}
							></span>
							Resueltos
							<span
								class="rounded px-2 py-0.5 text-xs font-semibold"
								class:bg-green-500={statusFilter === 'resolved'}
								class:text-white={statusFilter === 'resolved'}
								class:bg-green-50={statusFilter !== 'resolved'}
								class:text-green-800={statusFilter !== 'resolved'}>{quickCounts.resolved}</span
							>
						</button>
					</div>
				</div>

				<div>
					<label for="prioridad-filter" class="mb-1 block text-sm font-medium text-gray-700"
						>Prioridad</label
					>
					<select
						id="prioridad-filter"
						bind:value={prioridadFilter}
						class="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						<option value="all">Todas las prioridades</option>
						<option value="low">🟢 Baja</option>
						<option value="medium">🟠 Media</option>
						<option value="high">🔴 Alta</option>
						<option value="urgent">🚨 Urgente</option>
					</select>
				</div>
			</div>

			<div class="ml-auto shrink-0 text-right">
				{#if statusFilter !== 'all' || prioridadFilter !== 'all' || searchTerm || empleadoFilter}
					<button
						onclick={onClear}
						class="inline-flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium whitespace-nowrap text-gray-700 transition-colors hover:bg-gray-300"
					>
						🗑️ Limpiar filtros
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
