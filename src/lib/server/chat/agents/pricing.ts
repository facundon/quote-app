/**
 * Per-token pricing for the Gemini models used in this pipeline.
 * Rates are USD per 1,000,000 tokens.
 *
 * gemini-2.5-flash rates below are Google's published Gemini API pricing
 * at the time this was written ($0.30/1M input, $2.50/1M output, text/image).
 *
 * gemini-3.5-flash has no confirmed published pricing yet — it currently
 * reuses gemini-2.5-flash's rates as a placeholder. Verify against
 * https://ai.google.dev/gemini-api/docs/pricing and update before relying
 * on this for real financial reporting.
 */
export interface ModelPricing {
	inputPerMillionTokens: number;
	outputPerMillionTokens: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
	'gemini-3.1-flash-lite': { inputPerMillionTokens: 0.25, outputPerMillionTokens: 1.5 },
	'gemini-3.5-flash': { inputPerMillionTokens: 1.5, outputPerMillionTokens: 9 }
};

/** Fallback pricing for a model not present in MODEL_PRICING. */
const FALLBACK_PRICING: ModelPricing = { inputPerMillionTokens: 0.3, outputPerMillionTokens: 2.5 };

/** Cost in USD for a given model's token usage. */
export function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
	const pricing = MODEL_PRICING[model] ?? FALLBACK_PRICING;
	return (
		(inputTokens / 1_000_000) * pricing.inputPerMillionTokens +
		(outputTokens / 1_000_000) * pricing.outputPerMillionTokens
	);
}
