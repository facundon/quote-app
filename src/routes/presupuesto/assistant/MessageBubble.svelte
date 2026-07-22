<script lang="ts">
	import { marked } from 'marked';
	import StatusBadge from './StatusBadge.svelte';
	import type { ChatMessage, ChatUsage } from '$lib/chat/events';

	marked.setOptions({
		breaks: true,
		gfm: true
	});

	function renderMarkdown(content: string): string {
		return marked.parse(content) as string;
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

	interface Props {
		msg: ChatMessage;
		isReasoningOpen: boolean;
		onImageClick: (image: string, type: string) => void;
	}

	let { msg, isReasoningOpen = $bindable(), onImageClick }: Props = $props();
</script>

<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
	<div
		class="max-w-[85%] rounded-lg px-4 py-2 {msg.role === 'user'
			? 'bg-blue-600 text-white'
			: 'border border-slate-200 bg-white text-slate-800'}"
	>
		{#if msg.image}
			<button
				type="button"
				onclick={() => onImageClick(msg.image!, msg.imageType || 'image/jpeg')}
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
				<p class="mt-1 text-xs italic {msg.role === 'user' ? 'text-blue-100' : 'text-slate-500'}">
					"{msg.transcript}"
				</p>
			{/if}
		{/if}
		{#if msg.role === 'assistant'}
			{#if msg.thoughts}
				<details bind:open={isReasoningOpen} class="mb-2 rounded-md border border-slate-200 bg-slate-50">
					<summary
						class="cursor-pointer px-2 py-1 text-xs font-medium text-slate-500 select-none hover:text-slate-700"
					>
						💭 Razonamiento
					</summary>
					<div class="prose prose-sm max-w-none border-t border-slate-200 px-2 py-2 text-slate-500">
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
			<p class="mt-1 border-t border-slate-100 pt-1 text-xs text-slate-400">
				{formatUsage(msg.usage)}
			</p>
		{/if}
	</div>
</div>
