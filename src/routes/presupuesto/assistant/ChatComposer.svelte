<script lang="ts">
	import VoiceRecorder from './VoiceRecorder.svelte';
	import type { PendingMedia } from '$lib/chat/events';

	interface Props {
		pendingImage: PendingMedia | null;
		pendingAudio: PendingMedia | null;
		isRecording: boolean;
		input: string;
		isLoading: boolean;
		error: string | null;
		onSend: () => void;
		onStopRecording: () => void;
		onPaste: (e: ClipboardEvent) => void;
		onClearImage: () => void;
		onDiscardAudio: () => void;
	}

	let {
		pendingImage,
		pendingAudio = $bindable(),
		isRecording = $bindable(),
		input = $bindable(),
		isLoading,
		error = $bindable(),
		onSend,
		onStopRecording,
		onPaste,
		onClearImage,
		onDiscardAudio
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onSend();
		}
	}
</script>

<div class="border-t border-slate-200 bg-white p-3" onpaste={onPaste}>
	{#if pendingImage}
		<div class="mb-2 flex items-start gap-2">
			<div class="relative">
				<img
					src="data:{pendingImage.type};base64,{pendingImage.data}"
					alt="Imagen a enviar"
					class="h-20 rounded border border-slate-200"
				/>
				<button
					type="button"
					onclick={onClearImage}
					class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
				>
					×
				</button>
			</div>
			<span class="text-xs text-slate-500">Imagen lista para enviar</span>
		</div>
	{/if}
	{#if pendingAudio}
		<div class="mb-2 flex items-center gap-2">
			<audio controls src="data:{pendingAudio.type};base64,{pendingAudio.data}" class="h-8"></audio>
			<button
				type="button"
				onclick={onDiscardAudio}
				class="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
			>
				×
			</button>
		</div>
	{/if}
	<div class="flex gap-1">
		{#if !isRecording}
			<textarea
				bind:value={input}
				onkeydown={handleKeydown}
				onpaste={onPaste}
				placeholder="Escribí, pegá texto o una imagen..."
				rows="1"
				disabled={isLoading}
				class="flex-3 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:bg-slate-100"
			></textarea>
		{/if}
		<VoiceRecorder isDisabled={isLoading} bind:error bind:pendingAudio bind:isRecording {onStopRecording} />
		{#if !isRecording}
			<button
				type="button"
				onclick={onSend}
				disabled={isLoading || isRecording || (!pendingAudio && !pendingImage && !input.trim())}
				class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Enviar
			</button>
		{/if}
	</div>
</div>
