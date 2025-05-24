<script lang="ts">
	let { data } = $props();

	let client = $state('');
	let date = $state(new Date().toISOString().slice(0, 10));
	let selectedStudies = $state<{ studyId: number; quantity: number }[]>([
		{ studyId: data.studies[0]?.id ?? 0, quantity: 1 }
	]);
	let showSummary = $state(false);

	function addStudy() {
		// Buscar el primer estudio no seleccionado
		const usedIds = selectedStudies.map((s) => s.studyId);
		const available = data.studies.find((study) => !usedIds.includes(study.id));
		const defaultId = available ? available.id : (data.studies[0]?.id ?? 0);
		selectedStudies = [...selectedStudies, { studyId: defaultId, quantity: 1 }];
	}

	function updateStudy(index: number, field: 'studyId' | 'quantity', value: any) {
		selectedStudies = selectedStudies.map((s, i) => (i === index ? { ...s, [field]: value } : s));
	}

	function removeStudy(index: number) {
		if (selectedStudies.length > 1) {
			selectedStudies = selectedStudies.filter((_, i) => i !== index);
		}
	}

	function handleSelectChange(e: Event, index: number) {
		const target = e.target as HTMLSelectElement;
		updateStudy(index, 'studyId', +target.value);
	}

	function handleInputChange(e: Event, index: number) {
		const target = e.target as HTMLInputElement;
		updateStudy(index, 'quantity', +target.value);
	}

	function getUnitPrice(studyId: number) {
		const study = data.studies.find((s) => s.id === studyId);
		if (!study) return 0;
		const category = data.categories.find((c) => c.id === study.category_id);
		return category?.unit_price ?? 0;
	}

	function getSubtotal(studyId: number, quantity: number) {
		return getUnitPrice(studyId) * quantity;
	}

	let total = $derived.by(() =>
		selectedStudies.reduce((sum, sel) => sum + getSubtotal(sel.studyId, sel.quantity), 0)
	);

	let totalQuantity = $derived.by(() =>
		selectedStudies.reduce((sum, sel) => sum + sel.quantity, 0)
	);

	let discount = $derived.by(() => {
		if (!data.discounts.length) return null;
		const applicable = data.discounts
			.filter((d) => totalQuantity >= d.min_quantity)
			.sort((a, b) => b.percentage - a.percentage);
		return applicable[0] ?? null;
	});

	let discountAmount = $derived.by(() => (discount ? (total * discount.percentage) / 100 : 0));

	let finalTotal = $derived.by(() => total - discountAmount);
</script>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-2 py-8"
>
	<div class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-2xl">
		<h2 class="mb-6 text-center text-3xl font-extrabold tracking-tight text-blue-900">
			Nuevo presupuesto
		</h2>
		<form method="POST" class="space-y-6">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label class="mb-1 block text-sm font-semibold text-blue-900">Cliente</label>
					<input
						type="text"
						name="client"
						bind:value={client}
						placeholder="Nombre del cliente"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-semibold text-blue-900">Fecha</label>
					<input
						type="date"
						name="date"
						bind:value={date}
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
					/>
				</div>
			</div>
			<div>
				<label class="mb-2 block text-sm font-semibold text-blue-900">Estudios</label>
				{#each selectedStudies as sel, i}
					<div
						class="mb-1 flex min-h-6 flex-col items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs md:flex-row"
					>
						<select
							name="studies[]"
							bind:value={sel.studyId}
							onchange={(e) => handleSelectChange(e, i)}
							class="h-6 flex-1 rounded-lg border border-slate-300 px-1 py-0.5 text-xs transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
						>
							{#each data.studies as study}
								<option
									value={study.id}
									disabled={selectedStudies.some((s, j) => s.studyId === study.id && j !== i)}
								>
									{study.name} ({data.categories.find((c) => c.id === study.category_id)?.name})
								</option>
							{/each}
						</select>
						<input
							type="number"
							min="1"
							name="quantities[]"
							bind:value={sel.quantity}
							onchange={(e) => handleInputChange(e, i)}
							class="h-6 w-12 rounded-lg border border-slate-300 px-1 py-0.5 text-xs transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
						/>
						<span class="text-xs text-slate-500"
							>Subtotal: ${getSubtotal(sel.studyId, sel.quantity).toFixed(2)}</span
						>
						<button
							type="button"
							title="Eliminar"
							aria-label="Eliminar estudio"
							class="ml-1 flex items-center justify-center rounded-full border border-red-100 bg-red-50 p-1 text-xs text-red-600 shadow-sm transition hover:bg-red-200 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
							onclick={() => removeStudy(i)}
							disabled={selectedStudies.length === 1}
						>
							<span class="px-1">✕</span>
						</button>
					</div>
				{/each}
				<div class="mt-2 flex justify-end">
					<button
						type="button"
						class="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={addStudy}
						disabled={selectedStudies.length >= data.studies.length}
					>
						<span class="text-base">＋</span> <span>Agregar estudio</span>
					</button>
				</div>
			</div>

			{#if selectedStudies.length > 0}
				<div class="mt-6 mb-2">
					<div class="mb-2 flex items-center gap-1">
						<h3 class="text-lg font-bold text-blue-900">Resumen</h3>
						<button
							type="button"
							class="ml-1 flex items-center p-0 text-blue-700 transition hover:text-blue-900"
							onclick={() => (showSummary = !showSummary)}
							aria-expanded={showSummary}
							aria-controls="summary-panel"
						>
							<svg
								class="h-5 w-5 transition-transform duration-200"
								style:transform={showSummary ? 'rotate(90deg)' : 'rotate(0deg)'}
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
								><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg
							>
						</button>
					</div>
					<div
						id="summary-panel"
						class="overflow-hidden transition-all duration-300"
						style:height={showSummary ? 'auto' : '0'}
						style:paddingTop={showSummary ? '0.5rem' : '0'}
						style:paddingBottom={showSummary ? '0.5rem' : '0'}
						style:marginBottom={showSummary ? '0.5rem' : '0'}
					>
						{#if showSummary}
							<ul class="divide-y divide-slate-200">
								{#each selectedStudies as sel}
									<li class="flex min-h-8 items-center gap-2 py-1 text-sm text-slate-700">
										<span class="min-w-0 flex-1 truncate font-medium">
											{data.studies.find((s) => s.id === sel.studyId)?.name}
											<span class="text-xs text-slate-400"
												>({data.categories.find(
													(c) =>
														c.id === data.studies.find((s) => s.id === sel.studyId)?.category_id
												)?.name})</span
											>
										</span>
										<span class="text-xs text-slate-500"
											>x{sel.quantity} @ ${getUnitPrice(sel.studyId).toFixed(2)}</span
										>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{/if}

			<div
				class="mt-8 flex flex-col gap-2 rounded-lg border-t-4 border-blue-400 bg-slate-50 px-4 pt-8 shadow-inner"
			>
				<div class="mb-2 flex flex-wrap items-center justify-end gap-4">
					<div class="flex items-center gap-2">
						<span class="text-base text-slate-700">Total:</span>
						<span class="rounded-full bg-blue-100 px-2 py-0.5 text-base font-bold text-blue-900"
							>${total.toFixed(2)}</span
						>
					</div>
					{#if discount}
						<div class="flex items-center gap-2">
							<span class="text-base font-semibold text-green-700">Descuento:</span>
							<span class="rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-800"
								>{discount.percentage}%</span
							>
							<span class="font-semibold text-red-500">- ${discountAmount.toFixed(2)}</span>
						</div>
					{/if}
				</div>
				<div class="mt-2 mb-2 flex flex-col items-center justify-center">
					<span class="text-xl font-extrabold text-blue-900">Total final</span>
					<span class="text-4xl font-extrabold tracking-tight text-blue-900"
						>${finalTotal.toFixed(2)}</span
					>
				</div>
			</div>

			<button
				type="submit"
				class="mt-6 w-full rounded-xl bg-green-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-green-700"
			>
				Crear presupuesto
			</button>
		</form>
	</div>
</div>

<style>
	body {
		background: linear-gradient(120deg, #f8fafc 0%, #e0e7ef 100%);
	}
</style>
