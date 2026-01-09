/**
 * Common types for LLM provider adapters.
 */

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	/** Base64-encoded image data (without data URL prefix) */
	image?: string;
	/** MIME type of the image (e.g., 'image/jpeg', 'image/png') */
	imageType?: string;
}

export interface ChatResponse {
	response: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
}

/**
 * Interface that all LLM providers must implement.
 */
export interface LLMProvider {
	/**
	 * Process a chat conversation and return the assistant's response.
	 * The provider handles tool calling internally.
	 */
	chat(messages: ChatMessage[]): Promise<ChatResponse>;
}
