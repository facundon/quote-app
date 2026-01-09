import type { LLMProvider } from './types';
import { GroqProvider } from './groq';

export type { LLMProvider, ChatMessage, ChatResponse } from './types';

/**
 * Get the LLM provider.
 */
export function getProvider(): LLMProvider {
	return new GroqProvider();
}
