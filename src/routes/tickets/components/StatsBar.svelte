<script lang="ts">
	let { stats }: { stats: { total: number; open: number; inProgress: number; resolved: number } } =
		$props();
</script>

<div class="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
	<div class="rounded-lg bg-gray-50 p-4 text-center">
		<div class="text-2xl font-bold text-gray-900">{stats.total}</div>
		<div class="text-sm text-gray-600">Total</div>
	</div>
	<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
		<div class="text-2xl font-bold text-blue-900">{stats.open}</div>
		<div class="text-sm text-blue-700">Pendientes</div>
	</div>
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
		<div class="text-2xl font-bold text-yellow-900">{stats.inProgress}</div>
		<div class="text-sm text-yellow-700">En Progreso</div>
	</div>
	<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
		<div class="text-2xl font-bold text-green-900">{stats.resolved}</div>
		<div class="text-sm text-green-700">Resueltos</div>
	</div>
</div>
