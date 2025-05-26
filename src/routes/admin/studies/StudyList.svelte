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
	let error = $state('');
</script>

{#each categories as cat (cat.id)}
	{#if studies.filter((s) => s.category_id === cat.id).length > 0}
		<div class="mt-6">
			<h4 class="mb-2 border-b border-blue-200 pb-1 text-base font-bold text-blue-800">
				{cat.name}
			</h4>
			<ul class="space-y-2">
				{#each studies.filter((s) => s.category_id === cat.id) as study (study.id)}
					<li class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2 shadow-sm">
						<span class="text-sm font-semibold text-slate-800">{study.name}</span>
						<div class="flex items-center gap-2">
							<button
								class="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
								title="Editar"
								onclick={() => onEdit(study)}
							>
								<svg
									class="h-4 w-4"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13z"
									/></svg
								>
								Editar
							</button>
							<form
								method="POST"
								action="?/study_delete"
								style="display:inline"
								use:enhance={() => {
									return async ({
										result
									}: {
										result: { type: string; data?: { error?: string } };
									}) => {
										if (result.type === 'success' && onDeleted) await onDeleted();
										else if (result.type === 'failure')
											error = result.data?.error || 'Error desconocido';
									};
								}}
							>
								<input type="hidden" name="id" value={study.id} />
								<button
									class="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
									type="submit"
									onclick={(event) => {
										if (!confirm('¿Eliminar este estudio?')) event.preventDefault();
									}}
								>
									<svg
										class="h-4 w-4"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M6 18L18 6M6 6l12 12"
										/></svg
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

{#if error}
	<div class="mb-2 rounded bg-red-100 px-3 py-2 text-red-700">{error}</div>
{/if}
