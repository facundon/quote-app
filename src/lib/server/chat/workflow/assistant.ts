import {
	FinishChatEvent,
	StatusChatEvent,
	TextDeltaChatEvent,
	ThoughtChatEvent,
	type ChatEvent
} from '$lib/chat/events';
import { convertUsdToArs, getUsdToArsRate } from '$lib/server/exchange/usdToArs';
import { getGeminiClient } from '$lib/server/chat/gemini';
import { getAssistantSystemPrompt } from '$lib/server/chat/prompts/assistant';
import { MODEL_CONFIG } from '$lib/server/chat/workflow/models';
import type { ChatMessage, PipelineResponse, TokenUsage } from '$lib/server/chat/workflow/types';
import { getEventEmitter } from '$lib/server/chat/workflow/utils';

const MODEL = MODEL_CONFIG.assistant;

type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

function toGeminiContents(messages: ChatMessage[]): { role: string; parts: ContentPart[] }[] {
	return messages.map((message) => {
		const parts: ContentPart[] = [];
		if (message.content) parts.push({ text: message.content });
		if (message.image) {
			parts.push({
				inlineData: { mimeType: message.imageType || 'image/jpeg', data: message.image }
			});
		}
		if (message.audio) {
			parts.push({
				inlineData: { mimeType: message.audioType || 'audio/webm', data: message.audio }
			});
		}
		return { role: message.role === 'assistant' ? 'model' : 'user', parts };
	});
}

export async function processMessagesWithAssistant(
	messages: ChatMessage[],
	controller: ReadableStreamDefaultController
): Promise<PipelineResponse> {
	const client = getGeminiClient();
	const emit = getEventEmitter<ChatEvent>(controller);

	emit(new StatusChatEvent('Interpretando'));

	const stream = await client.models.generateContentStream({
		model: MODEL.name,
		contents: toGeminiContents(messages),
		config: {
			...MODEL,
			systemInstruction: getAssistantSystemPrompt()
		}
	});
	let text = '';
	const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

	for await (const chunk of stream) {
		// usageMetadata is cumulative per chunk, not a delta — overwrite, don't accumulate.
		usage.inputTokens = chunk.usageMetadata?.promptTokenCount ?? usage.inputTokens;
		usage.outputTokens = chunk.usageMetadata?.candidatesTokenCount ?? usage.outputTokens;
		for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
			if (!part.text) continue;
			if (part.thought) {
				emit(new ThoughtChatEvent(part.text));
				continue;
			}
			text += part.text;
			emit(new TextDeltaChatEvent(part.text));
		}
	}
	const cost = MODEL.getCost(usage);
	const usageWithCost = {
		inputTokens: usage.inputTokens,
		outputTokens: usage.outputTokens,
		costUsd: cost
	};
	const finalUsage =
		cost > 0
			? await getUsdToArsRate()
					.then((rate) => ({ ...usageWithCost, costArs: convertUsdToArs(cost, rate) }))
					.catch(() => usageWithCost)
			: usageWithCost;

	emit(new FinishChatEvent({ usage: finalUsage }));

	return { response: text, usage: finalUsage };
}
