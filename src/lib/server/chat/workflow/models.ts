/**
 * Model configuration: definitions, pricing, and defaults for all LLM calls.
 */

import { ThinkingLevel, type GenerateContentConfig } from '@google/genai';

export interface ModelPricing {
	inputPerMillionTokens: number;
	inputAudio: number;
	outputPerMillionTokens: number;
}

export interface ModelConfig extends ModelPricing, GenerateContentConfig {
	name: GeminiModel;
	getCost(args: GetCostProps, usedAudio?: boolean): number;
}

const MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;
export type GeminiModel = (typeof MODELS)[number];

const MODEL_PRICING: Record<GeminiModel, ModelPricing> = {
	'gemini-3.5-flash': {
		inputPerMillionTokens: 1.5,
		outputPerMillionTokens: 9,
		inputAudio: 1.5
	},
	'gemini-3.5-flash-lite': {
		inputPerMillionTokens: 1.5,
		outputPerMillionTokens: 9,
		inputAudio: 1.5
	},
	'gemini-3.1-flash-lite': {
		inputPerMillionTokens: 0.25,
		outputPerMillionTokens: 1.5,
		inputAudio: 0.5
	}
};

interface GetCostProps {
	inputTokens: number;
	outputTokens: number;
}

const LLM_USE = ['extraction', 'mapping', 'parser', 'validator', 'assistant'] as const;

export const MODEL_CONFIG: Record<(typeof LLM_USE)[number], ModelConfig> = {
	get extraction(): ModelConfig {
		const model: GeminiModel = 'gemini-3.1-flash-lite';
		const pricing = MODEL_PRICING[model];
		return {
			name: model,
			...pricing,
			temperature: 0.1,
			getCost: ({ inputTokens, outputTokens }, usedAudio) =>
				calculateCostUsd(model, inputTokens, outputTokens, usedAudio)
		};
	},
	get mapping(): ModelConfig {
		const model: GeminiModel = 'gemini-3.1-flash-lite';
		const pricing = MODEL_PRICING[model];
		return {
			name: model,
			...pricing,
			temperature: 0.1,
			thinkingConfig: { includeThoughts: true, thinkingLevel: ThinkingLevel.MINIMAL },
			getCost: ({ inputTokens, outputTokens }, usedAudio) =>
				calculateCostUsd(model, inputTokens, outputTokens, usedAudio)
		};
	},
	get parser(): ModelConfig {
		const model: GeminiModel = 'gemini-3.1-flash-lite';
		const pricing = MODEL_PRICING[model];
		return {
			name: model,
			...pricing,
			temperature: 0.1,
			getCost: ({ inputTokens, outputTokens }, usedAudio) =>
				calculateCostUsd(model, inputTokens, outputTokens, usedAudio)
		};
	},
	get validator(): ModelConfig {
		const model: GeminiModel = 'gemini-3.1-flash-lite';
		const pricing = MODEL_PRICING[model];
		return {
			name: model,
			...pricing,
			temperature: 0.1,
			thinkingConfig: { includeThoughts: true, thinkingLevel: ThinkingLevel.MINIMAL },
			getCost: ({ inputTokens, outputTokens }, usedAudio) =>
				calculateCostUsd(model, inputTokens, outputTokens, usedAudio)
		};
	},
	get assistant(): ModelConfig {
		const model: GeminiModel = 'gemini-3.1-flash-lite';
		const pricing = MODEL_PRICING[model];
		return {
			name: model,
			...pricing,
			thinkingConfig: { includeThoughts: true, thinkingLevel: ThinkingLevel.MINIMAL },
			getCost: ({ inputTokens, outputTokens }, usedAudio) =>
				calculateCostUsd(model, inputTokens, outputTokens, usedAudio)
		};
	}
} as const;

/** Fallback pricing for a model not present in MODEL_PRICING. */
const FALLBACK_PRICING: ModelPricing = {
	inputPerMillionTokens: 0.3,
	outputPerMillionTokens: 2.5,
	inputAudio: 1
};

function calculateCostUsd(
	modelKey: GeminiModel,
	inputTokens: number,
	outputTokens: number,
	usedAudio?: boolean
): number {
	const model = MODEL_PRICING[modelKey] ?? FALLBACK_PRICING;
	const inputCost = usedAudio ? model.inputAudio : model.inputPerMillionTokens;
	return (
		(inputTokens / 1_000_000) * inputCost +
		(outputTokens / 1_000_000) * model.outputPerMillionTokens
	);
}
