<script lang="ts">
	import { browser } from '$app/environment';
	import MessageBubble from './assistant/MessageBubble.svelte';
	import ImageZoomModal from './assistant/ImageZoomModal.svelte';
	import ChatComposer from './assistant/ChatComposer.svelte';
	import { mapLineToCallback, type ChatMessage, type PendingMedia } from '$lib/chat/events';

	const STORAGE_KEY = 'chat-messages' as const;
	const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB limit for Groq

	function loadMessages(): ChatMessage[] {
		if (!browser) return [];
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	}

	function saveMessages(msgs: ChatMessage[]) {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
		} catch {
			// Ignore storage errors (might fail with large images/audio)
		}
	}

	let messages = $state<ChatMessage[]>(loadMessages());
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let pendingImage = $state<PendingMedia | null>(null);
	let zoomedImage = $state<PendingMedia | null>(null);
	let pendingAudio = $state<PendingMedia | null>(null);
	let isRecording = $state(false);
	let input = $state('');
	let isReasoningOpen = $state(true);

	function openImageZoom(imageData: string, imageType: string) {
		zoomedImage = { data: imageData, type: imageType };
	}

	function closeImageZoom() {
		zoomedImage = null;
	}

	$effect(() => {
		saveMessages(messages);
	});

	function fileToBase64(file: File): Promise<PendingMedia> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				// Remove the data URL prefix to get just the base64
				const base64 = result.split(',')[1];
				resolve({ data: base64, type: file.type });
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function handleImageFile(file: File) {
		if (!file.type.startsWith('image/')) return;

		if (file.size > MAX_IMAGE_SIZE) {
			error = 'La imagen es muy grande (máximo 4MB)';
			return;
		}

		try {
			pendingImage = await fileToBase64(file);
			error = null;
		} catch {
			error = 'Error al procesar la imagen';
		}
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) handleImageFile(file);
				return;
			}
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (file) handleImageFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function clearPendingImage() {
		pendingImage = null;
	}

	function discardPendingAudio() {
		pendingAudio = null;
	}

	function onStopRecording() {
		sendMessage();
	}

	async function processEvent(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>) {
		const decoder = new TextDecoder();
		const userMessageIndex = messages.length - 1;
		const assistantIndex = messages.length - 1;
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				mapLineToCallback(line, {
					onTranscript(transcript) {
						messages[userMessageIndex].transcript = transcript;
					},
					onTextDelta(text) {
						messages[assistantIndex].content += text;
					},
					onStatusChange(status) {
						messages[assistantIndex].statusText = status;
					},
					onFinish(usage) {
						messages[assistantIndex].usage = usage;
						isReasoningOpen = false;
					},
					onError(error) {
						error = error;
					},
					onThought(thought) {
						messages[assistantIndex].thoughts = (messages[assistantIndex].thoughts ?? '') + thought;
					}
				});
			}
		}
	}

	async function sendMessage() {
		const hasImage = !!pendingImage;
		const hasAudio = !!pendingAudio;

		if ((!hasAudio && !hasImage) || isLoading) return;

		error = null;
		const messageImage = pendingImage;
		const messageAudio = pendingAudio;
		const messageText = hasAudio ? '🎤 Nota de voz' : 'Cotizá los estudios de esta imagen';

		pendingImage = null;
		pendingAudio = null;

		messages.push({
			role: 'user',
			content: messageText,
			...(messageImage && { image: messageImage.data, imageType: messageImage.type }),
			...(messageAudio && { audio: messageAudio.data, audioType: messageAudio.type })
		});

		messages.push({
			role: 'assistant',
			content: ''
		});
		const assistantIndex = messages.length - 1;

		isLoading = true;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				error = data.error || 'Error al procesar el mensaje';
				messages.pop();
				return;
			}

			if (!res.body) throw new Error('No se recibió stream del servidor');
			const reader = res.body.getReader();
			await processEvent(reader);
			messages[assistantIndex].statusText = '';
		} catch (e) {
			error = 'Error de conexión';
			console.error(e);
			if (!messages[assistantIndex].content) {
				messages.pop();
			}
		} finally {
			isLoading = false;
		}
	}

	function clearChat() {
		messages = [];
		pendingImage = null;
		pendingAudio = null;
		error = null;
	}
</script>

<div
	class="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	role="region"
>
	<div class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
		<div class="flex items-center gap-2">
			<span class="text-lg">💬</span>
			<h3 class="font-semibold text-blue-900">Cotizador por Chat</h3>
		</div>
		{#if messages.length > 0}
			<button type="button" onclick={clearChat} class="text-sm text-slate-500 hover:text-red-600">
				Limpiar
			</button>
		{/if}
	</div>

	<div class="max-h-145 flex-1 overflow-y-auto p-4">
		{#if messages.length === 0}
			<div class="flex h-full flex-col items-center justify-center text-center text-slate-400">
				<p class="mb-2 text-4xl">📋</p>
				<p class="text-sm">Que podemos cotizar?</p>
				<p class="mt-1 text-xs">Grabá tu pedido: "Necesito cotizar 5 hemogramas y 3 glucemias"</p>
				<p class="mt-2 text-xs">También podés pegar o arrastrar una imagen 📷</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each messages as msg}
					<MessageBubble {msg} bind:isReasoningOpen onImageClick={openImageZoom} />
				{/each}
				{#if isLoading}
					<div class="flex justify-start">
						<div class="rounded-lg border border-slate-200 bg-white px-4 py-2">
							<div class="flex items-center gap-2 text-sm text-slate-500">
								<span class="animate-pulse">●</span>
								<span>Analizando y calculando...</span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if error}
		<div class="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
			{error}
		</div>
	{/if}

	<ChatComposer
		{pendingImage}
		bind:pendingAudio
		bind:isRecording
		bind:input
		{isLoading}
		bind:error
		onSend={sendMessage}
		{onStopRecording}
		onPaste={handlePaste}
		onClearImage={clearPendingImage}
		onDiscardAudio={discardPendingAudio}
	/>
</div>

<ImageZoomModal image={zoomedImage} onClose={closeImageZoom} />
