<script lang="ts">
	import { browser } from '$app/environment';

	interface Message {
		role: 'user' | 'assistant';
		content: string;
	}

	const STORAGE_KEY = 'chat-messages';

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
			// Ignore storage errors
		}
	}

	let messages = $state<Message[]>(loadMessages());
	let input = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		saveMessages(messages);
	});

	async function sendMessage() {
		const text = input.trim();
		if (!text || isLoading) return;

		error = null;
		input = '';

		messages = [...messages, { role: 'user', content: text }];

		isLoading = true;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages })
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.error || 'Error al procesar el mensaje';
				return;
			}

			messages = [...messages, { role: 'assistant', content: data.response }];
		} catch (e) {
			error = 'Error de conexión';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function clearChat() {
		messages = [];
		error = null;
	}
</script>

<div class="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50">
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

	<!-- Messages -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if messages.length === 0}
			<div class="flex h-full flex-col items-center justify-center text-center text-slate-400">
				<p class="mb-2 text-4xl">📋</p>
				<p class="text-sm">Que podemos cotizar?</p>
				<p class="mt-1 text-xs">Ejemplo: "Hola, necesito cotizar 5 hemogramas y 3 glucemias"</p>
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
							<p class="text-sm whitespace-pre-wrap">{msg.content}</p>
						</div>
					</div>
				{/each}
				{#if isLoading}
					<div class="flex justify-start">
						<div class="rounded-lg border border-slate-200 bg-white px-4 py-2">
							<div class="flex items-center gap-2 text-sm text-slate-500">
								<span class="animate-pulse">●</span>
								<span>Calculando presupuesto...</span>
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

	<div class="border-t border-slate-200 bg-white p-3">
		<div class="flex gap-2">
			<textarea
				bind:value={input}
				onkeydown={handleKeydown}
				placeholder="Escribí o pegá un mensaje..."
				rows="2"
				disabled={isLoading}
				class="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:bg-slate-100"
			></textarea>
			<button
				type="button"
				onclick={sendMessage}
				disabled={isLoading || !input.trim()}
				class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Enviar
			</button>
		</div>
	</div>
</div>
