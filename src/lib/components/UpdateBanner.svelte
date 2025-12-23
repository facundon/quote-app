<script lang="ts">
	import { browser } from '$app/environment';
	import type { UpdateCheckResponse, UpdateInstallResponse } from '$lib/update/types';
	import { toastStore } from '$lib/stores/toast';

	let check = $state<UpdateCheckResponse | null>(null);
	let installing = $state(false);
	let dismissedVersion = $state<string | null>(null);
	let checking = $state(false);
	let didCheck = $state(false);
	let lastNotifiedVersion = $state<string | null>(null);

	const POLL_MS = 30 * 60 * 1000;

	async function runCheck() {
		if (checking) return;
		checking = true;
		try {
			const res = await fetch('/api/update/check');
			const data = (await res.json()) as UpdateCheckResponse;
			check = data;

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
</script>

{#if show}
	<div
		class="mb-6 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950"
	>
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="font-semibold">
					Actualización disponible: v{check?.latestVersion}
					{#if check?.currentVersion}
						<span class="font-normal text-blue-800">(actual: v{check.currentVersion})</span>
					{/if}
				</div>
				{#if check?.notes}
					<div class="mt-1 text-sm text-blue-900">{check.notes}</div>
				{/if}
			</div>

			<button
				type="button"
				class="shrink-0 rounded-md px-2 py-1 text-sm text-blue-900 hover:bg-blue-100"
				onclick={dismiss}
			>
				Ahora no
			</button>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
				onclick={install}
				disabled={installing}
			>
				{#if installing}
					Instalando…
				{:else}
					Descargar e instalar
				{/if}
			</button>
			<div class="text-sm text-blue-900">
				La aplicación puede reiniciarse durante la instalación.
			</div>
		</div>
	</div>
{/if}
