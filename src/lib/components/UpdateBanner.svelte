<script lang="ts">
	import { browser } from '$app/environment';
	import type { UpdateCheckResponse, UpdateInstallResponse } from '$lib/update/types';
	import { toastStore } from '$lib/stores/toast';

	type NoteBlock = { kind: 'bullet'; text: string } | { kind: 'text'; text: string };

	let check = $state<UpdateCheckResponse | null>(null);
	let installing = $state(false);
	let dismissedVersion = $state<string | null>(null);
	let checking = $state(false);
	let didCheck = $state(false);
	let lastNotifiedVersion = $state<string | null>(null);
	let lastError = $state<string | null>(null);
	let showChanges = $state(true);

	const POLL_MS = 30 * 60 * 1000;

	function parseNotes(notes: string | null | undefined): NoteBlock[] {
		if (!notes) return [];
		// Handle both actual newlines and literal "\n" sequences from JSON/inputs.
		const normalized = notes.replaceAll('\\n', '\n');
		const lines = normalized
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);

		const blocks: NoteBlock[] = [];
		for (const line of lines) {
			const bulletMatch = /^[-*•]\s+(.*)$/.exec(line);
			if (bulletMatch?.[1]) {
				blocks.push({ kind: 'bullet', text: bulletMatch[1].trim() });
			} else {
				blocks.push({ kind: 'text', text: line });
			}
		}
		return blocks;
	}

	async function runCheck() {
		if (checking) return;
		checking = true;
		try {
			const res = await fetch('/api/update/check');
			const data = (await res.json()) as UpdateCheckResponse;
			check = data;

			if (data.error && data.error !== lastError) {
				lastError = data.error;
				toastStore.error(`Update check failed: ${data.error}`);
			}

			if (
				data.updateAvailable &&
				data.latestVersion &&
				data.latestVersion !== lastNotifiedVersion
			) {
				lastNotifiedVersion = data.latestVersion;
				toastStore.info(`Update available: v${data.latestVersion}`);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			check = {
				updateAvailable: false,
				currentVersion: null,
				latestVersion: null,
				releasedAt: null,
				notes: null,
				error: msg
			};
		} finally {
			checking = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		if (didCheck) return;
		// Check on initial mount only; keep it simple.
		didCheck = true;
		runCheck();

		const interval = window.setInterval(() => {
			if (document.visibilityState === 'visible') runCheck();
		}, POLL_MS);

		const onVisibility = () => {
			if (document.visibilityState === 'visible') runCheck();
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});

	function dismiss() {
		dismissedVersion = check?.latestVersion ?? null;
		showChanges = false;
	}

	async function install() {
		if (installing) return;
		installing = true;
		try {
			const res = await fetch('/api/update/install', { method: 'POST' });
			const data = (await res.json()) as UpdateInstallResponse;
			if (!res.ok || !data.started) {
				throw new Error(data.error ?? data.message ?? 'Install failed');
			}
			toastStore.success(data.message);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toastStore.error(`Update failed: ${msg}`);
		} finally {
			installing = false;
		}
	}

	let show = $derived(
		!!check?.updateAvailable && !!check.latestVersion && check.latestVersion !== dismissedVersion
	);

	let notesBlocks = $derived.by(() => parseNotes(check?.notes));
	let hasChanges = $derived(notesBlocks.length > 0);
</script>

{#if show}
	<div
		class="mb-6 overflow-hidden rounded-xl border border-blue-200 bg-blue-50 text-blue-950 shadow-sm"
	>
		<div class="flex items-start justify-between gap-4 px-4 pt-4 pb-3">
			<div class="min-w-0">
				<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<div class="font-semibold">
						Actualización disponible <span class="font-mono">v{check?.latestVersion}</span>
					</div>
					{#if check?.currentVersion}
						<div class="text-sm text-blue-800">
							(actual <span class="font-mono">v{check.currentVersion}</span>)
						</div>
					{/if}
				</div>
			</div>
		</div>

		{#if hasChanges}
			{#if showChanges}
				<div class="border-t border-blue-200 bg-white/40 px-4 py-3">
					<div class="flex items-center justify-between gap-3">
						<div class="text-sm font-semibold text-blue-950">Novedades</div>
						<button
							type="button"
							class="text-sm font-medium text-blue-900 hover:underline disabled:opacity-60"
							onclick={() => (showChanges = false)}
							disabled={installing}
						>
							Ocultar cambios
						</button>
					</div>
					<div class="mt-2 text-sm text-blue-950">
						<ul class="space-y-1 pl-5">
							{#each notesBlocks as b}
								{#if b.kind === 'bullet'}
									<li class="list-disc">{b.text}</li>
								{:else}
									<li class="list-none">
										<p>{b.text}</p>
									</li>
								{/if}
							{/each}
						</ul>
					</div>
				</div>
			{:else}
				<div class="px-4 pb-3">
					<button
						type="button"
						class="text-sm font-medium text-blue-900 hover:underline disabled:opacity-60"
						onclick={() => (showChanges = true)}
						disabled={installing}
					>
						Ver cambios
					</button>
				</div>
			{/if}
		{/if}

		<div class="mb-3 px-4 pt-3">
			<div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
				Termina tu trabajo antes de actualizar.
			</div>
		</div>

		<div class="border-t border-blue-200 bg-blue-50 px-4 py-3">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
						onclick={install}
						disabled={installing}
					>
						{#if installing}
							Instalando…
						{:else}
							Actualizar ahora
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
