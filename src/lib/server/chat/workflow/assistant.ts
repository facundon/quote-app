import {
	FinishChatEvent,
	StatusChatEvent,
	TextDeltaChatEvent,
	ThoughtChatEvent,
	type ChatEvent
} from '$lib/chat/events';
import { convertUsdToArs, getUsdToArsRate } from '$lib/server/exchange/usdToArs';
import { getAssistantSystemPrompt } from '$lib/server/chat/prompts/assistant';
import { MODEL_CONFIG } from '$lib/server/chat/workflow/models';
import type { PipelineResponse } from '$lib/server/chat/workflow/types';
import type { ChatMessage } from '$lib/ai-tools/types';
import { getEventEmitter } from '$lib/server/chat/workflow/utils';
import { getRegisteredToolSchemas } from '$lib/ai-tools/registry';
import { runModelInteractions } from '$lib/ai-tools/execution';
import { convertHistoryToStepList, toGeminiContents } from '$lib/ai-tools/types';

const MODEL = MODEL_CONFIG.assistant;

export async function processMessagesWithAssistant(
	messages: ChatMessage[],
	controller: ReadableStreamDefaultController
): Promise<PipelineResponse> {
	const emit = getEventEmitter<ChatEvent>(controller);

	emit(new StatusChatEvent('Procesando tu consulta...'));

	const contents = convertHistoryToStepList(toGeminiContents(messages));

	const { fullText, usage } = await runModelInteractions(
		{
			model: MODEL.name,
			input: contents,
			system_instruction: getAssistantSystemPrompt(),
			generation_config: {
				temperature: MODEL.temperature,
				thinking_level: MODEL.thinkingConfig?.thinkingLevel
			},
			tools: getRegisteredToolSchemas(['list_categories', 'create_study'])
		},
		{
			onChunk: (chunkText) => emit(new TextDeltaChatEvent(chunkText)),
			onThought: (chunkText) => emit(new ThoughtChatEvent(chunkText)),
			onStatus: (status) => emit(new StatusChatEvent(status))
		}
	);

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

	return { response: fullText, usage: finalUsage };
}
