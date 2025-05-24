<script lang="ts">
	export let data: { studies: { id: number; name: string; category_name: string }[] };
</script>

<h2>Estudios</h2>
<table>
	<thead>
		<tr>
			<th>Nombre</th>
			<th>Categoría</th>
		</tr>
	</thead>
	<tbody>
		{#each data.studies as study}
			<tr>
				<td>{study.name}</td>
				<td>{study.category_name}</td>
			</tr>
		{/each}
	</tbody>
</table>
