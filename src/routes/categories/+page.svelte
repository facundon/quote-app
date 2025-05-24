<script lang="ts">
	export let data: { categories: { id: number; name: string; unit_price: number }[] };
</script>

<h2>Categorías</h2>
<table>
	<thead>
		<tr>
			<th>Nombre</th>
			<th>Precio unitario</th>
		</tr>
	</thead>
	<tbody>
		{#each data.categories as category}
			<tr>
				<td>{category.name}</td>
				<td>${category.unit_price}</td>
			</tr>
		{/each}
	</tbody>
</table>
