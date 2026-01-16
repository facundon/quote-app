import {
	GoogleGenerativeAI,
	type Content,
	type Part,
	type Tool,
	type Schema,
	type FunctionDeclaration,
	type FunctionDeclarationSchema,
	FunctionCallingMode,
	SchemaType
} from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import type { LLMProvider, ChatMessage, ChatResponse } from './types';
import { tools, type ToolDefinition, type ToolParameter } from '../toolSchema';
import { executeTool, getStudyCatalog } from '../tools';
import { buildSystemPrompt } from '../prompt';

const MODEL = 'gemini-2.0-flash';

/**
 * Recursively convert a ToolParameter to a typed Gemini Schema.
 * Builds the correct discriminated union variant based on param.type.
 */
function convertToGeminiSchema(param: ToolParameter): Schema {
	switch (param.type) {
		case 'string':
			return {
				type: SchemaType.STRING,
				description: param.description
			};

		case 'number':
			return {
				type: SchemaType.NUMBER,
				description: param.description
			};

		case 'boolean':
			return {
				type: SchemaType.BOOLEAN,
				description: param.description
			};

		case 'array': {
			if (!param.items) {
				// Default to string array if no items specified
				return {
					type: SchemaType.ARRAY,
					description: param.description,
					items: { type: SchemaType.STRING }
				};
			}
			return {
				type: SchemaType.ARRAY,
				description: param.description,
				items: convertToGeminiSchema(param.items)
			};
		}

		case 'object': {
			const properties: Record<string, Schema> = {};
			if (param.properties) {
				for (const [key, nestedParam] of Object.entries(param.properties)) {
					properties[key] = convertToGeminiSchema(nestedParam);
				}
			}
			return {
				type: SchemaType.OBJECT,
				description: param.description,
				properties,
				required: param.required
			};
		}

		default:
			return {
				type: SchemaType.STRING,
				description: param.description
			};
	}
}

/**
 * Convert our tool schema to Gemini's function declaration format.
 */
function convertToGeminiTools(): Tool[] {
	const functionDeclarations: FunctionDeclaration[] = tools.map((tool: ToolDefinition) => {
		const properties: Record<string, Schema> = {};

		for (const [key, param] of Object.entries(tool.parameters.properties)) {
			properties[key] = convertToGeminiSchema(param);
		}

		const parameters: FunctionDeclarationSchema = {
			type: SchemaType.OBJECT,
			properties,
			required: tool.parameters.required
		};

		return {
			name: tool.name,
			description: tool.description,
			parameters
		};
	});

	return [{ functionDeclarations }];
}

/**
 * Convert a ChatMessage to Gemini Content format.
 */
function toGeminiContent(msg: ChatMessage): Content {
	const parts: Part[] = [];

	// Add text content
	if (msg.content) {
		parts.push({ text: msg.content });
	}

	// Add image if present
	if (msg.image) {
		const mimeType = msg.imageType || 'image/jpeg';
		parts.push({
			inlineData: {
				mimeType,
				data: msg.image
			}
		});

		// Add default prompt for images if no text
		if (!msg.content) {
			parts.unshift({ text: 'Extraé la lista de estudios de esta imagen y cotizalos.' });
		}
	}

	return {
		role: msg.role === 'assistant' ? 'model' : 'user',
		parts
	};
}

/**
 * Gemini LLM provider implementation.
 * Uses Gemini 2.0 Flash with tool calling and vision support.
 */
export class GeminiProvider implements LLMProvider {
	private client: GoogleGenerativeAI;

	constructor() {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) {
			throw new Error('GEMINI_API_KEY not configured');
		}
		this.client = new GoogleGenerativeAI(apiKey);
	}

	async chat(messages: ChatMessage[]): Promise<ChatResponse> {
		const geminiTools = convertToGeminiTools();
		const studyCatalog = getStudyCatalog();
		const systemPrompt = buildSystemPrompt(studyCatalog);

		const model = this.client.getGenerativeModel({
			model: MODEL,
			systemInstruction: systemPrompt,
			tools: geminiTools,
			toolConfig: {
				functionCallingConfig: {
					mode: FunctionCallingMode.AUTO
				}
			}
		});

		// Convert messages to Gemini format
		const history: Content[] = messages.slice(0, -1).map(toGeminiContent);
		const lastMessage = messages[messages.length - 1];

		// Start chat with history
		const chat = model.startChat({ history });

		// Send the last message
		let response = await chat.sendMessage(toGeminiContent(lastMessage).parts);

		// Tool calling loop
		let candidate = response.response.candidates?.[0];
		while (candidate?.content.parts.some((part) => part.functionCall)) {
			const functionCalls = candidate.content.parts.filter((part) => part.functionCall);

			// Execute each function call
			const functionResponses: Part[] = [];
			for (const part of functionCalls) {
				if (!part.functionCall) continue;

				const args = part.functionCall.args as Record<string, unknown>;
				const result = executeTool(part.functionCall.name, args);

				functionResponses.push({
					functionResponse: {
						name: part.functionCall.name,
						response: { result }
					}
				});
			}

			// Send function results back
			response = await chat.sendMessage(functionResponses);
			candidate = response.response.candidates?.[0];
		}

		// Extract final text
		const finalText =
			candidate?.content.parts
				.filter((part) => part.text)
				.map((part) => part.text)
				.join('') || '';

		return {
			response: finalText,
			usage: {
				inputTokens: response.response.usageMetadata?.promptTokenCount,
				outputTokens: response.response.usageMetadata?.candidatesTokenCount
			}
		};
	}
}
