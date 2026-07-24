import type { Content, FunctionDeclaration, Interactions } from '@google/genai';

// The return layout for any backend tool logic
export interface ToolContext {
	[key: string]: unknown;
}

// A tool contract combining its signature and execution action
export interface AppTool<
	TArgs = unknown,
	TResult = Interactions.FunctionResultStep['result'],
	TName extends string = string
> {
	name: TName;
	schema: FunctionDeclaration;
	execute: (args: TArgs, context?: ToolContext) => Promise<TResult>;
}

export function defineTool<
	TArgs,
	TResult extends Interactions.FunctionResultStep['result'],
	TName extends string
>(tool: AppTool<TArgs, TResult, TName>): AppTool<TArgs, TResult, TName> {
	return tool;
}

type TurnContent = Interactions.TextContent | Interactions.ImageContent | Interactions.AudioContent;

export interface ChatMessage {
	role: 'user' | 'assistant' | 'function';
	content?: string;
	/** Base64-encoded image data (without data URL prefix) */
	image?: string;
	/** MIME type of the image */
	imageType?: string;
	/** Base64-encoded audio data (without data URL prefix) */
	audio?: string;
	/** MIME type of the audio */
	audioType?: string;
} /** Token usage tracking for LLM calls. */

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
}

export function toGeminiContents(
	messages: ChatMessage[]
): { role: string; content: TurnContent[] }[] {
	return messages.flatMap((message) => {
		const content: TurnContent[] = [];
		if (message.content) content.push({ type: 'text', text: message.content });
		if (message.image) {
			content.push({
				type: 'image',
				mime_type: message.imageType || 'image/jpeg',
				data: message.image
			});
		}
		if (message.audio) {
			content.push({
				type: 'audio',
				mime_type: message.audioType || 'audio/webm',
				data: message.audio
			});
		}
		if (content.length === 0) return [];
		return [{ role: message.role === 'assistant' ? 'model' : 'user_input', content }];
	});
}

function getMediaType(mimeType: string): 'image' | 'audio' | 'video' {
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('audio/')) return 'audio';
	if (mimeType.startsWith('video/')) return 'video';
	return 'image'; // Fallback default
}

export function convertHistoryToStepList(contents: any[]) {
	return contents
		.map((item) => {
			// 1. SI YA ES UN STEP DE INTERACTIONS API (ya formateado)
			if (
				item.type === 'user_input' ||
				item.type === 'model_output' ||
				item.type === 'function_result' ||
				item.type === 'function_response'
			) {
				return item;
			}

			// Detectar el rol tanto si viene en `role` como si viene en `type`
			const role = item.role || item.type;

			// 2. USER MESSAGES ('user' o 'user_input')
			if (role === 'user' || role === 'user_input') {
				// Si ya trae la propiedad content estructurada
				if (Array.isArray(item.content)) {
					return { type: 'user_input' as const, content: item.content };
				}

				const stepContent = (item.parts ?? [])
					.map((part: any) => {
						if ('text' in part && part.text) {
							return { type: 'text' as const, text: part.text };
						}
						if ('inlineData' in part && part.inlineData?.mimeType && part.inlineData?.data) {
							const mimeType = part.inlineData.mimeType;
							return {
								type: getMediaType(mimeType),
								mime_type: mimeType,
								data: part.inlineData.data
							};
						}
						return null;
					})
					.filter((part: any): part is NonNullable<typeof part> => part !== null);

				return {
					type: 'user_input' as const,
					content: stepContent
				};
			}

			// 3. MODEL MESSAGES ('model' o 'model_output')
			if (role === 'model' || role === 'model_output') {
				if (Array.isArray(item.content)) {
					return { type: 'model_output' as const, content: item.content };
				}

				const stepContent = (item.parts ?? [])
					.map((part: any) => {
						if ('text' in part && part.text) {
							return { type: 'text' as const, text: part.text };
						}
						return null;
					})
					.filter((part: any): part is NonNullable<typeof part> => part !== null);

				return {
					type: 'model_output' as const,
					content: stepContent
				};
			}

			// 4. TOOL / FUNCTION RESULTS
			if (role === 'tool' || role === 'function' || role === 'function_result') {
				const part = item.parts?.[0];
				const fnResp = part && 'functionResponse' in part ? part.functionResponse : null;

				return {
					type: 'function_result' as const,
					name: item.name ?? fnResp?.name ?? 'unknown_tool',
					call_id: item.call_id ?? fnResp?.id ?? '',
					result: item.result ?? fnResp?.response ?? {}
				};
			}

			// Si llega un tipo desconocido o no soportado, lo ignoramos en lugar de romper la ejecución
			console.warn(`[History Converter] Ignorando elemento con rol/tipo no soportado:`, role);
			return null;
		})
		.filter((step): step is NonNullable<typeof step> => step !== null);
}
