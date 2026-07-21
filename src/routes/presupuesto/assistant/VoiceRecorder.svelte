<script lang="ts">
	import VolumeMeter from '../VolumeMeter.svelte';

	const MAX_RECORDING_MS = 90 * 1000;
	const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
	const AUDIO_MIME_CANDIDATES = [
		'audio/webm;codecs=opus',
		'audio/webm',
		'audio/ogg;codecs=opus',
		'audio/mp4'
	] as const;

	function pickAudioMimeType(): string {
		for (const type of AUDIO_MIME_CANDIDATES) {
			if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) {
				return type;
			}
		}
		return '';
	}

	function formatElapsed(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	type Props = {
		isRecording: boolean;
		pendingAudio: { data: string; type: string } | null;
		isDisabled?: boolean;
		error?: string | null;
	};

	let {
		isRecording = $bindable(),
		isDisabled = false,
		error = $bindable(null),
		pendingAudio = $bindable(null)
	}: Props = $props();

	let recordedChunks: Blob[] = [];
	let recordingInterval: ReturnType<typeof setInterval> | null = null;
	let mediaRecorder: MediaRecorder | null = null;

	let mediaStream: MediaStream | null = $state(null);

	let recordingSeconds = $state(0);
	let isRecordingPaused = $state(false);

	async function startRecording() {
		error = null;
		try {
			mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			error = 'Se necesita acceso al micrófono para grabar';
			return;
		}

		const mimeType = pickAudioMimeType();
		recordedChunks = [];

		try {
			mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
		} catch {
			error = 'No se pudo iniciar la grabación en este navegador';
			stopRecordingTracks();
			return;
		}

		mediaRecorder.ondataavailable = (e) => {
			if (e.data.size > 0) recordedChunks.push(e.data);
		};

		mediaRecorder.onstop = async () => {
			const type = mediaRecorder?.mimeType || mimeType || 'audio/webm';
			const blob = new Blob(recordedChunks, { type });
			stopRecordingTracks();

			if (blob.size > MAX_AUDIO_SIZE) {
				error = 'La grabación es muy larga, intentá con un mensaje más corto';
				return;
			}

			try {
				pendingAudio = await blobToBase64(blob, type);
			} catch {
				error = 'Error al procesar la grabación';
			}
		};

		mediaRecorder.start();
		isRecording = true;
		recordingSeconds = 0;
		isRecordingPaused = false;
		recordingInterval = setInterval(() => {
			if (isRecordingPaused) return;
			recordingSeconds += 1;
			if (recordingSeconds * 1000 >= MAX_RECORDING_MS) {
				stopRecording();
			}
		}, 1000);
	}

	function blobToBase64(blob: Blob, type: string): Promise<{ data: string; type: string }> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				const base64 = result.split(',')[1];
				resolve({ data: base64, type });
			};
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	function stopRecordingTracks() {
		mediaStream?.getTracks().forEach((track) => track.stop());
		mediaStream = null;
	}

	function clearRecordingInterval() {
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}
	}

	function stopRecording() {
		clearRecordingInterval();
		isRecording = false;
		mediaRecorder?.stop();
	}

	function toggleRecording() {
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	}

	function togglePauseRecording() {
		isRecordingPaused ? mediaRecorder?.resume() : mediaRecorder?.pause();
		isRecordingPaused = !isRecordingPaused;
	}
</script>

<div class="flex items-center gap-2">
	{#if isRecording}
		<VolumeMeter stream={mediaStream} isPaused={isRecordingPaused} />
	{/if}
	<button
		type="button"
		onclick={toggleRecording}
		disabled={isDisabled}
		class="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 {isRecording
			? 'border-red-300 bg-red-50 text-red-600'
			: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}"
	>
		{#if isRecording}
			<span class="animate-pulse {isRecordingPaused ? 'text-blue-500' : 'text-red-500'}">●</span>
			{#if isRecordingPaused}
				<span class="text-blue-500">
					Pausado {formatElapsed(recordingSeconds)}
				</span>
			{:else}
				<span>Grabando... {formatElapsed(recordingSeconds)}</span>
			{/if}
			<span class="text-xs text-red-500">(Detener)</span>
		{:else}
			<span>🎤</span>
			<span>Grabar</span>
		{/if}
	</button>
	{#if isRecording}
		<button
			type="button"
			onclick={togglePauseRecording}
			disabled={isDisabled}
			class="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if isRecordingPaused}
				<span>▶️</span>
				<span>Resumir</span>
			{:else}
				<span>⏸️</span>
				<span>Pausar</span>
			{/if}
		</button>
	{/if}
</div>
