import Groq from 'groq-sdk';
import { env } from '$env/dynamic/private';
import type { LLMProvider, ChatMessage, ChatResponse } from './types';
import { tools, type ToolDefinition } from '../toolSchema';
import { executeTool, getStudyCatalog } from '../tools';
import { buildSystemPrompt } from '../prompt';

const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

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
 * Check if any message contains an image.
 */
function hasImages(messages: ChatMessage[]): boolean {
	return messages.some((m) => m.image);
}

/**
 * Convert a message to Groq format for vision model (supports multimodal content).
 */
function toVisionMessage(msg: ChatMessage): Groq.Chat.ChatCompletionMessageParam {
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
 * Convert a message to Groq format for text model (string content only).
 */
function toTextMessage(msg: ChatMessage): Groq.Chat.ChatCompletionMessageParam {
	if (msg.role === 'user' && msg.image) {
		// For text model, describe that there was an image
		return {
			role: 'user',
			content: `${msg.content || ''}\n[El usuario envió una imagen con estudios a cotizar]`.trim()
		};
	}
	return { role: msg.role, content: msg.content };
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
		const useVision = hasImages(messages);
		const model = useVision ? VISION_MODEL : TEXT_MODEL;
		const toMessage = useVision ? toVisionMessage : toTextMessage;

		const studyCatalog = getStudyCatalog();
		const systemPrompt = buildSystemPrompt(studyCatalog);

		// Convert messages to Groq format
		const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: systemPrompt },
			...messages.map(toMessage)
		];

		// Initial API call
		let response = await this.client.chat.completions.create({
			model,
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

			// Continue with same model for consistency
			response = await this.client.chat.completions.create({
				model,
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
