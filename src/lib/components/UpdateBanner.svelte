<script lang="ts">
	import { browser } from '$app/environment';
	import type { UpdateCheckResponse, UpdateInstallResponse, UpdateStatus } from '$lib/update/types';
	import { toastStore } from '$lib/stores/toast';

	type NoteBlock = { kind: 'bullet'; text: string } | { kind: 'text'; text: string };

	let check = $state<UpdateCheckResponse | null>(null);
	let installing = $state(false);
	let dismissedVersion = $state<string | null>(null);
	let checking = $state(false);
	let lastNotifiedVersion = $state<string | null>(null);
	let lastError = $state<string | null>(null);
	let showChanges = $state(true);
	let lastCheckedAtMs = $state(0);

	// Update status polling
	let updateStatus = $state<UpdateStatus | null>(null);
	let statusPollInterval = $state<number | null>(null);
	let serverDown = $state(false);
	let pollStartedAt = $state<number | null>(null);
	let consecutiveFailures = $state(0);

	const POLL_MS = 30 * 60 * 1000;
	const FOCUS_COOLDOWN_MS = 10_000;
	const STATUS_POLL_MS = 1_500;
	const MAX_POLL_TIME_MS = 120_000; // 2 minutes max

	// Non-reactive flag to prevent effect from re-running and removing listeners
	let effectMounted = false;

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
			lastCheckedAtMs = Date.now();

			if (data.error && data.error !== lastError) {
				lastError = data.error;
				toastStore.error(`No se pudo verificar actualizaciones: ${data.error}`);
			}

			if (
				data.updateAvailable &&
				data.latestVersion &&
				data.latestVersion !== lastNotifiedVersion
			) {
				lastNotifiedVersion = data.latestVersion;
				toastStore.info(`Actualización disponible: v${data.latestVersion}`);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Error desconocido';
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

	function maybeRunCheck() {
		const now = Date.now();
		if (now - lastCheckedAtMs < FOCUS_COOLDOWN_MS) return;
		runCheck();
	}

	$effect(() => {
		if (!browser) return;
		if (effectMounted) return;
		effectMounted = true;

		// Initial check on mount
		maybeRunCheck();

		const interval = window.setInterval(() => {
			if (document.visibilityState === 'visible') maybeRunCheck();
		}, POLL_MS);

		const onVisibility = () => {
			if (document.visibilityState === 'visible') maybeRunCheck();
		};
		document.addEventListener('visibilitychange', onVisibility);

		const onFocus = () => {
			if (document.visibilityState === 'visible') maybeRunCheck();
		};
		window.addEventListener('focus', onFocus);

		const onPageShow = (event: PageTransitionEvent) => {
			if (event.persisted) maybeRunCheck();
		};
		window.addEventListener('pageshow', onPageShow);

		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('focus', onFocus);
			window.removeEventListener('pageshow', onPageShow);
		};
	});

	function stopStatusPolling() {
		if (statusPollInterval !== null) {
			window.clearInterval(statusPollInterval);
			statusPollInterval = null;
		}
	}

	async function pollStatus() {
		if (pollStartedAt && Date.now() - pollStartedAt > MAX_POLL_TIME_MS) {
			stopStatusPolling();
			toastStore.warning(
				'La actualización está tardando más de lo esperado. Recarga la página manualmente.'
			);
			installing = false;
			return;
		}

		try {
			const res = await fetch('/api/update/status');

			if (!res.ok) {
				consecutiveFailures++;
				return;
			}

			if (serverDown) serverDown = false;
			consecutiveFailures = 0;

			const status = (await res.json()) as UpdateStatus;
			updateStatus = status;

			if (status.step === 'done') {
				stopStatusPolling();
				toastStore.success('Actualización completada. Recargando…');
				setTimeout(() => {
					window.location.reload();
				}, 1500);
			} else if (status.step === 'error') {
				stopStatusPolling();
				toastStore.error(`Error en la actualización: ${status.error ?? 'Error desconocido'}`);
				installing = false;
			}
		} catch {
			consecutiveFailures++;
			if (consecutiveFailures >= 2 && !serverDown) {
				serverDown = true;
			}
		}
	}

	function startStatusPolling() {
		stopStatusPolling();
		pollStartedAt = Date.now();
		consecutiveFailures = 0;
		serverDown = false;
		pollStatus();
		statusPollInterval = window.setInterval(pollStatus, STATUS_POLL_MS);
	}

	async function install() {
		if (installing) return;
		installing = true;
		updateStatus = null;

		try {
			const res = await fetch('/api/update/install', { method: 'POST' });
			const data = (await res.json()) as UpdateInstallResponse;
			if (!res.ok || !data.started) {
				const err = data.error ?? '';
				if (err === 'invalid-install-layout') {
					throw new Error(
						'No se puede instalar en este entorno. La app debe ejecutarse desde una carpeta `current/`.'
					);
				}
				throw new Error(data.message ?? data.error ?? 'No se pudo iniciar la instalación');
			}
			toastStore.success('Actualización iniciada. Esperando…');
			startStatusPolling();
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Error desconocido';
			toastStore.error(`Falló la actualización: ${msg}`);
			installing = false;
		}
	}

	function getStatusMessage(status: UpdateStatus | null, isServerDown: boolean): string {
		if (isServerDown) {
			return 'Reiniciando servidor…';
		}

		if (!status) return 'Iniciando…';

		switch (status.step) {
			case 'starting':
				return 'Iniciando actualización…';
			case 'stopping':
				return 'Deteniendo servidor…';
			case 'stopped':
				return 'Servidor detenido';
			case 'swapping':
				return 'Actualizando archivos…';
			case 'swapped':
				return 'Archivos actualizados';
			case 'starting-server':
				return 'Iniciando nuevo servidor…';
			case 'done':
				return 'Actualización completada. Recargando…';
			case 'error':
				return status.error ?? 'Error';
			default:
				return status.message ?? 'Procesando…';
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
					{#if installing}
						<div class="flex items-center gap-2 text-sm text-blue-800">
							<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<span>{getStatusMessage(updateStatus, serverDown)}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
