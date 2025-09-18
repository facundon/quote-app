<script lang="ts">
	let {
		employees = [] as string[],
		name = 'assignee',
		id = name,
		value = $bindable(''),
		required = false,
		placeholder = 'Seleccionar empleado',
		includeAll = false,
		allLabel = 'Todos',
		allValue = ''
	} = $props();

	function handleChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		value = select.value;
	}
</script>

<select
	{id}
	{name}
	bind:value
	class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
	{required}
	onchange={handleChange}
>
	{#if includeAll}
		<option value={allValue}>{allLabel}</option>
	{:else}
		<option value="" disabled selected={value === ''}>{placeholder}</option>
	{/if}
	{#each employees as emp}
		<option value={emp}>{emp}</option>
	{/each}
</select>
