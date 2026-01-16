import { env } from '$env/dynamic/private';
import type { LLMProvider } from './types';
import { GroqProvider } from './groq';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

export type { LLMProvider, ChatMessage, ChatResponse } from './types';

type ProviderName = 'openai' | 'groq' | 'gemini';

const providers: Record<ProviderName, () => LLMProvider> = {
	openai: () => new OpenAIProvider(),
	groq: () => new GroqProvider(),
	gemini: () => new GeminiProvider()
};

const DEFAULT_PROVIDER: ProviderName = 'openai';

/**
 * Get the LLM provider based on LLM_PROVIDER environment variable.
 * Defaults to OpenAI if not specified.
 */
export function getProvider(): LLMProvider {
	const name = (env.LLM_PROVIDER || DEFAULT_PROVIDER) as ProviderName;

	const factory = providers[name];
	if (!factory) {
		const valid = Object.keys(providers).join(', ');
		throw new Error(`Unknown LLM provider: "${name}". Valid options: ${valid}`);
	}

	return factory();
}
