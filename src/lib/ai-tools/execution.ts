import { resolveToolUsage } from '$lib/ai-tools/registry';
import type { ToolContext } from '$lib/ai-tools/types';
import { getGeminiClient } from '$lib/server/chat/gemini';
import type { TokenUsage } from './types';
import type { Interactions, Stream } from '@google/genai';

const MAX_TOOL_ITERATIONS = 6 as const;

interface AgentOptions {
	maxTurns?: number;
	context?: ToolContext;
	onChunk?: (chunkText: string) => void;
	onThought?: (chunkText: string) => void;
	onStatus?: (status: string) => void;
}

interface PendingFunctionCall {
	id: string;
	name: string;
	args: string;
}

interface AcumulatedFunctionsCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
}

async function processStream(
	stream: Stream<Interactions.InteractionSSEEvent>,
	{
		pendingFunctionCalls,
		accumulatedFunctionCalls,
		options
	}: {
		pendingFunctionCalls: Map<number, PendingFunctionCall>;
		accumulatedFunctionCalls: AcumulatedFunctionsCall[];
		options: AgentOptions;
	}
) {
	let interactionId: string | undefined;
	let fullText = '';
	let thoughts = '';
	const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

	for await (const event of stream) {
		if (
			event.event_type === 'interaction.created' ||
			event.event_type === 'interaction.completed'
		) {
			interactionId = event.interaction.id;
			if (event.interaction.usage) {
				usage.inputTokens = event.interaction.usage.total_input_tokens ?? 0;
				usage.outputTokens = event.interaction.usage.total_output_tokens ?? 0;
			}
		}

		if (event.event_type === 'step.start') {
			if (event.step.type === 'function_call') {
				pendingFunctionCalls.set(event.index, {
					id: event.step.id,
					name: event.step.name,
					args: ''
				});
				options.onStatus?.(`Ejecutando ${event.step.name}...`);
			} else if (event.step.type === 'model_output') {
				options.onStatus?.('Generando respuesta...');
			} else if (event.step.type === 'thought') {
				options.onStatus?.('Analizando...');
			}
		}

		if (event.event_type === 'error') {
			throw new Error(`[Interactions API] ${event.error?.code}: ${event.error?.message}`);
		}

		if (event.event_type === 'step.delta') {
			if (event.delta.type === 'text') {
				const text = event.delta.text;
				fullText += text;
				options.onChunk?.(text);
			}
			if (event.delta.type === 'thought_summary') {
				if (event.delta.content?.type === 'text') {
					const text = event.delta.content.text;
					thoughts += text;
					options.onThought?.(text);
				}
			}
			if (event.delta.type === 'arguments_delta') {
				const pending = pendingFunctionCalls.get(event.index);
				if (pending) pending.args += event.delta.arguments ?? '';
			}
		}

		if (event.event_type === 'step.stop') {
			const pending = pendingFunctionCalls.get(event.index);
			if (pending) {
				accumulatedFunctionCalls.push({
					id: pending.id,
					name: pending.name,
					args: pending.args ? JSON.parse(pending.args) : {}
				});
				pendingFunctionCalls.delete(event.index);
			}
		}
	}
	return { interactionId, fullText, usage };
}

export async function runModelInteractions(
	config: Omit<
		Interactions.CreateModelInteractionParamsNonStreaming,
		'stream' | 'previous_interaction_id'
	>,
	options: AgentOptions = {}
) {
	const client = getGeminiClient();
	const maxTurns = options.maxTurns ?? MAX_TOOL_ITERATIONS;
	let currentTurn = 0;
	let previousInteractionId: string | undefined = undefined;
	let currentInput: Parameters<typeof client.interactions.create>['0']['input'] = config.input;
	const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

	while (currentTurn < maxTurns) {
		currentTurn++;

		const stream: Awaited<ReturnType<typeof client.interactions.create>> =
			await client.interactions.create({
				...config,
				generation_config: {
					thinking_level: config.generation_config?.thinking_level?.toLowerCase()
				},
				stream: true,
				input: currentInput,
				previous_interaction_id: previousInteractionId
			});

		const pendingFunctionCalls = new Map<number, PendingFunctionCall>();
		const accumulatedFunctionCalls: AcumulatedFunctionsCall[] = [];

		const {
			interactionId,
			fullText,
			usage: loopUsage
		} = await processStream(stream, {
			pendingFunctionCalls,
			accumulatedFunctionCalls,
			options
		});

		usage.inputTokens += loopUsage.inputTokens;
		usage.outputTokens += loopUsage.outputTokens;
		previousInteractionId = interactionId;

		if (accumulatedFunctionCalls.length === 0) return { fullText, usage };

		const toolResponses = await Promise.all(
			accumulatedFunctionCalls.map(async (call): Promise<Interactions.FunctionResultStep> => {
				try {
					const result = await resolveToolUsage(call, options.context);
					const safeResult = Array.isArray(result) ? { data: result } : result;
					return {
						type: 'function_result',
						call_id: call.id,
						name: call.name,
						result: safeResult
					};
				} catch (err) {
					return {
						type: 'function_result',
						call_id: call.id,
						name: call.name,
						is_error: true,
						result: err instanceof Error ? err.message : 'Execution failed'
					};
				}
			})
		);

		currentInput = toolResponses;
	}

	throw new Error(`Circuit Breaker: Exceeded maximum tool turns (${maxTurns}).`);
}
