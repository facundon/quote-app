<script lang="ts">
	import { enhance } from '$app/forms';
	type Category = { id: number; name: string };
	type Study = { id: number; name: string; category_id: number };
	let {
		studies,
		categories,
		onEdit,
		onDeleted
	}: {
		studies: Study[];
		categories: Category[];
		onEdit: (study: Study) => void;
		onDeleted?: () => void | Promise<void>;
	} = $props();
</script>

{#each categories as cat}
	{#if studies.filter((s) => s.category_id === cat.id).length > 0}
		<div class="mt-6">
			<h4 class="mb-2 border-b border-blue-200 pb-1 text-base font-bold text-blue-800">
				{cat.name}
			</h4>
			<ul class="divide-y">
				{#each studies.filter((s) => s.category_id === cat.id) as study}
					<li class="flex items-center justify-between py-2">
						<span>{study.name}</span>
						<div>
							<button class="mr-2 text-blue-600 hover:underline" onclick={() => onEdit(study)}>
								Editar
							</button>
							<form
								method="POST"
								action="?/study_delete"
								style="display:inline"
								use:enhance={() => {
									return async ({ result }) => {
										if (result.type === 'success' && onDeleted) await onDeleted();
									};
								}}
							>
								<input type="hidden" name="id" value={study.id} />
								<button
									class="text-red-600 hover:underline"
									type="submit"
									onclick={(event) => {
										if (!confirm('¿Eliminar este estudio?')) event.preventDefault();
									}}
								>
									Eliminar
								</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/each}
