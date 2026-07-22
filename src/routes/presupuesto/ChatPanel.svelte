<script lang="ts">
	import { browser } from '$app/environment';
	import { marked } from 'marked';
	import VoiceRecorder from './assistant/VoiceRecorder.svelte';
	import StatusBadge from './assistant/StatusBadge.svelte';
	import { mapLineToCallback, type ChatUsage } from '$lib/chat/events';

	marked.setOptions({
		breaks: true,
		gfm: true
	});

	function renderMarkdown(content: string): string {
		return marked.parse(content) as string;
	}

	interface Message {
		role: 'user' | 'assistant';
		content: string;
		image?: string;
		imageType?: string;
		audio?: string;
		audioType?: string;
		transcript?: string;
		usage?: ChatUsage;
		thoughts?: string;
		statusText?: string;
	}

	function formatCurrencyArs(value: number): string {
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	}

	function formatUsage(usage: ChatUsage): string {
		const totalTokens = usage.inputTokens + usage.outputTokens;
		const tokenLabel = `${totalTokens.toLocaleString('es-AR')} tokens (${usage.inputTokens.toLocaleString('es-AR')} in / ${usage.outputTokens.toLocaleString('es-AR')} out)`;
		const costLabel =
			usage.costArs != null ? formatCurrencyArs(usage.costArs) : `$${usage.costUsd.toFixed(4)} USD`;
		return `${tokenLabel} · ${costLabel}`;
	}

	const STORAGE_KEY = 'chat-messages' as const;
	const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB limit for Groq

	function loadMessages(): Message[] {
		if (!browser) return [];
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	}

	function saveMessages(msgs: Message[]) {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
		} catch {
			// Ignore storage errors (might fail with large images/audio)
		}
	}

	let messages = $state<Message[]>(loadMessages());
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let pendingImage = $state<{ data: string; type: string } | null>(null);
	let zoomedImage = $state<{ data: string; type: string } | null>(null);
	let pendingAudio = $state<{ data: string; type: string } | null>(null);
	let isRecording = $state(false);
	let input = $state('');

	function openImageZoom(imageData: string, imageType: string) {
		zoomedImage = { data: imageData, type: imageType };
	}

	function closeImageZoom() {
		zoomedImage = null;
	}

	function handleModalKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeImageZoom();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	$effect(() => {
		saveMessages(messages);
	});

	function fileToBase64(file: File): Promise<{ data: string; type: string }> {
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

	<div class="flex-1 overflow-y-auto p-4">
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
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[85%] rounded-lg px-4 py-2 {msg.role === 'user'
								? 'bg-blue-600 text-white'
								: 'border border-slate-200 bg-white text-slate-800'}"
						>
							{#if msg.image}
								<button
									type="button"
									onclick={() => openImageZoom(msg.image!, msg.imageType || 'image/jpeg')}
									class="mb-2 block cursor-zoom-in"
								>
									<img
										src="data:{msg.imageType || 'image/jpeg'};base64,{msg.image}"
										alt="Imagen adjunta (click para ampliar)"
										class="max-h-48 rounded transition hover:opacity-90"
									/>
								</button>
							{/if}
							{#if msg.audio}
								<audio
									controls
									src="data:{msg.audioType || 'audio/webm'};base64,{msg.audio}"
									class="mb-2 h-8 max-w-full"
								></audio>
								{#if msg.transcript}
									<p
										class="mt-1 text-xs italic {msg.role === 'user'
											? 'text-blue-100'
											: 'text-slate-500'}"
									>
										"{msg.transcript}"
									</p>
								{/if}
							{/if}
							{#if msg.role === 'assistant'}
								{#if msg.thoughts}
									<details class="mb-2 rounded-md border border-slate-200 bg-slate-50">
										<summary
											class="cursor-pointer px-2 py-1 text-xs font-medium text-slate-500 select-none hover:text-slate-700"
										>
											💭 Razonamiento
										</summary>
										<div
											class="prose prose-sm max-w-none border-t border-slate-200 px-2 py-2 text-slate-500"
										>
											{@html renderMarkdown(msg.thoughts)}
										</div>
									</details>
								{/if}
								<div class="prose prose-sm max-w-none">
									{@html renderMarkdown(msg.content)}
								</div>
								{#if msg.statusText}
									<div class="mt-2">
										<StatusBadge statusText={msg.statusText} />
									</div>
								{/if}
							{:else}
								<p class="text-sm whitespace-pre-wrap">{msg.content}</p>
							{/if}
							{#if msg.usage}
								<p
									class="mt-1 border-t border-slate-100 pt-1 text-xs text-slate-400"
								>
									{formatUsage(msg.usage)}
								</p>
							{/if}
						</div>
					</div>
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

	<div class="border-t border-slate-200 bg-white p-3" onpaste={handlePaste}>
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
						onclick={clearPendingImage}
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
				<audio controls src="data:{pendingAudio.type};base64,{pendingAudio.data}" class="h-8">
				</audio>
				<button
					type="button"
					onclick={discardPendingAudio}
					class="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
				>
					×
				</button>
			</div>
		{/if}
		<div class="flex gap-1">
			<textarea
				bind:value={input}
				onkeydown={handleKeydown}
				onpaste={handlePaste}
				placeholder="Escribí, pegá texto o una imagen..."
				rows="1"
				disabled={isLoading}
				class="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:bg-slate-100"
			></textarea>
			<VoiceRecorder isDisabled={isLoading} bind:error bind:pendingAudio bind:isRecording />
			<button
				type="button"
				onclick={sendMessage}
				disabled={isLoading || isRecording || (!pendingAudio && !pendingImage && !input.trim())}
				class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Enviar
			</button>
		</div>
	</div>
</div>

<!-- Image Zoom Modal -->
{#if zoomedImage}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		onclick={closeImageZoom}
		onkeydown={handleModalKeydown}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<button
			type="button"
			onclick={closeImageZoom}
			class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
			aria-label="Cerrar"
		>
			<span class="text-2xl">×</span>
		</button>
		<button type="button" class="cursor-default" onclick={(e) => e.stopPropagation()}>
			<img
				src="data:{zoomedImage.type};base64,{zoomedImage.data}"
				alt="Imagen ampliada"
				class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
			/>
		</button>
	</div>
{/if}
