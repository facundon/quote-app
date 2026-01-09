import Groq from 'groq-sdk';
import { env } from '$env/dynamic/private';
import type { LLMProvider, ChatMessage, ChatResponse } from './types';
import { tools, type ToolDefinition } from '../toolSchema';
import { executeTool } from '../tools';
import { SYSTEM_PROMPT } from '../prompt';

/**
 * Convert our tool schema to Groq's function format (OpenAI-compatible).
 */
function convertToGroqTools(): Groq.Chat.ChatCompletionTool[] {
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
 * Groq LLM provider implementation.
 * Uses Llama 3 models with tool calling support.
 */
export class GroqProvider implements LLMProvider {
	private client: Groq;

	constructor() {
		const apiKey = env.GROQ_API_KEY;
		if (!apiKey) {
			throw new Error('GROQ_API_KEY not configured');
		}
		this.client = new Groq({ apiKey });
	}

	async chat(messages: ChatMessage[]): Promise<ChatResponse> {
		const groqTools = convertToGroqTools();

		// Convert messages to Groq format (OpenAI-compatible)
		const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: SYSTEM_PROMPT },
			...messages.map((m) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content
			}))
		];

		// Initial API call - use tool-use optimized model
		let response = await this.client.chat.completions.create({
			model: 'llama-3.3-70b-versatile',
			max_tokens: 4096,
			tools: groqTools,
			tool_choice: 'auto',
			messages: groqMessages
		});

		// Tool calling loop
		while (response.choices[0]?.finish_reason === 'tool_calls') {
			const toolCalls = response.choices[0].message.tool_calls;
			if (!toolCalls || toolCalls.length === 0) break;

			// Add assistant message with tool calls
			groqMessages.push({
				role: 'assistant',
				content: response.choices[0].message.content,
				tool_calls: toolCalls
			});

			// Execute each tool and add results
			for (const toolCall of toolCalls) {
				const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
				const result = executeTool(toolCall.function.name, args);

				groqMessages.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					content: result
				});
			}

			// Continue the conversation
			response = await this.client.chat.completions.create({
				model: 'llama-3.3-70b-versatile',
				max_tokens: 4096,
				tools: groqTools,
				tool_choice: 'auto',
				messages: groqMessages
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
