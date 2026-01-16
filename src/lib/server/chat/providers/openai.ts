import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { LLMProvider, ChatMessage, ChatResponse } from './types';
import { tools, type ToolDefinition } from '../toolSchema';
import { executeTool, getStudyCatalog } from '../tools';
import { buildSystemPrompt } from '../prompt';
import type { ChatModel } from 'openai/resources';

const MODEL: ChatModel = 'gpt-5.2';

/**
 * Convert our tool schema to OpenAI's function format.
 */
function convertToOpenAITools(): OpenAI.Chat.ChatCompletionTool[] {
	return tools.map((tool: ToolDefinition) => ({
		type: 'function' as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters
		}
	}));
}

/**
 * Convert a ChatMessage to OpenAI format.
 * GPT-5.2 handles both text and vision natively in a single model.
 */
function toOpenAIMessage(msg: ChatMessage): OpenAI.Chat.ChatCompletionMessageParam {
	if (msg.role === 'user' && msg.image) {
		const mimeType = msg.imageType || 'image/jpeg';
		return {
			role: 'user',
			content: [
				{
					type: 'text',
					text: msg.content || 'Extraé la lista de estudios de esta imagen y cotizalos.'
				},
				{
					type: 'image_url',
					image_url: {
						url: `data:${mimeType};base64,${msg.image}`
					}
				}
			]
		};
	}
	return { role: msg.role, content: msg.content };
}

/**
 * OpenAI LLM provider implementation.
 * Uses GPT-5.2 model with unified text+vision and tool calling support.
 */
export class OpenAIProvider implements LLMProvider {
	private client: OpenAI;

	constructor() {
		const apiKey = env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error('OPENAI_API_KEY not configured');
		}
		this.client = new OpenAI({ apiKey });
	}

	async chat(messages: ChatMessage[]): Promise<ChatResponse> {
		const openAITools = convertToOpenAITools();

		const studyCatalog = getStudyCatalog();
		const systemPrompt = buildSystemPrompt(studyCatalog);

		// Convert messages to OpenAI format
		const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: systemPrompt },
			...messages.map(toOpenAIMessage)
		];

		// Initial API call
		let response = await this.client.chat.completions.create({
			model: MODEL,
			verbosity: 'low',
			max_tokens: 4096,
			tools: openAITools,
			tool_choice: 'auto',
			messages: openAIMessages
		});

		// Tool calling loop
		while (response.choices[0]?.finish_reason === 'tool_calls') {
			const toolCalls = response.choices[0].message.tool_calls;
			if (!toolCalls || toolCalls.length === 0) break;

			// Add assistant message with tool calls
			openAIMessages.push({
				role: 'assistant',
				content: response.choices[0].message.content,
				tool_calls: toolCalls
			});

			// Execute each tool and add results
			for (const toolCall of toolCalls) {
				// Skip non-function tool calls
				if (toolCall.type !== 'function') continue;

				const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
				const result = executeTool(toolCall.function.name, args);

				openAIMessages.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					content: result
				});
			}

			// Continue conversation after tool execution
			response = await this.client.chat.completions.create({
				model: MODEL,
				max_tokens: 4096,
				tools: openAITools,
				tool_choice: 'auto',
				messages: openAIMessages
			});
		}

		// Extract final text
		const finalText = response.choices[0]?.message?.content || '';

		return {
			response: finalText,
			usage: {
				inputTokens: response.usage?.prompt_tokens,
				outputTokens: response.usage?.completion_tokens
			}
		};
	}
}
