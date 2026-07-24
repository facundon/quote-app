import { Type, type Schema } from '@google/genai';
import { StatusChatEvent, ThoughtChatEvent, type ChatEvent } from '$lib/chat/events';
import { getGeminiClient } from '$lib/server/chat/gemini';
import { getValidatorSystemPrompt } from '$lib/server/chat/prompts/validator';
import { normalize } from '$lib/server/chat/workflow/catalog';
import { MODEL_CONFIG } from '$lib/server/chat/workflow/models';
import type { MappingResult, MappedStudy, TokenUsage } from '$lib/server/chat/workflow/types';

const VALIDATOR_MODEL = MODEL_CONFIG.validator;

export interface ValidationResult {
	mapping: MappingResult;
	usage?: TokenUsage;
	cost?: number;
}

const studiesToValidate = [
	'GOT',
	'GPT',
	'FAL',
	'BILIRRUBINA',
	'Colesterol',
	'HDL',
	'Triglicaridos',
	'sodio',
	'potasio',
	'cloro',
	'LINFOCITOS CD4 + CARGA VIRAL HIV',
	'Screening Neonatal 6 + Leucina'
].map((v) => v.toLowerCase());

function needsValidation(mapping: MappingResult): boolean {
	return mapping.matched.some(({ catalogName }) =>
		studiesToValidate.some((validate) => catalogName.toLocaleLowerCase().includes(validate))
	);
}

/** LLM decides which catalog names are redundant; filtering itself stays deterministic. */
const validatorResponseSchema: Schema = {
	type: Type.OBJECT,
	properties: {
		toRemove: {
			type: Type.ARRAY,
			items: {
				type: Type.OBJECT,
				properties: {
					catalogName: { type: Type.STRING },
					reason: { type: Type.STRING, description: 'Why this study is redundant' }
				},
				required: ['catalogName']
			}
		}
	},
	required: ['toRemove']
};

export async function validateMapping(
	mapping: MappingResult,
	onProcess: (data: ChatEvent) => void
): Promise<ValidationResult> {
	if (!needsValidation(mapping)) return { mapping };
	onProcess(new StatusChatEvent('Validando estudios antes de presupuestar'));

	const studyList = mapping.matched.map((s) => `- ${s.catalogName}`).join('\n');
	const stream = await getGeminiClient().models.generateContentStream({
		model: VALIDATOR_MODEL.name,
		contents: [{ role: 'user', parts: [{ text: studyList }] }],
		config: {
			...VALIDATOR_MODEL,
			systemInstruction: getValidatorSystemPrompt(),
			responseMimeType: 'application/json',
			responseSchema: validatorResponseSchema
		}
	});

	let text = '';
	const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
	for await (const chunk of stream) {
		// usageMetadata is cumulative per chunk, not a delta — overwrite, don't accumulate.
		usage.inputTokens = chunk.usageMetadata?.promptTokenCount ?? usage.inputTokens;
		usage.outputTokens = chunk.usageMetadata?.candidatesTokenCount ?? usage.outputTokens;
		for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
			if (!part.text) continue;
			if (part.thought) onProcess(new ThoughtChatEvent(part.text));
			else text += part.text;
		}
	}
	const cost = VALIDATOR_MODEL.getCost(usage);

	if (!text) return { mapping, usage, cost };
	const { toRemove } = JSON.parse(text) as { toRemove: { catalogName: string }[] };

	// Match toRemove names against mapping.matched by substring (not exact
	// equality) since the model doesn't always quote the catalog name
	// verbatim. Remove one matched entry per toRemove item — tracked by
	// index, not catalogId — so a legitimate double order of the same study
	// (2 flagged, 1 removed) collapses to one instead of losing both.
	const remaining = [...mapping.matched];
	for (const { catalogName } of toRemove) {
		const index = resolveToMatchedIndex(catalogName, remaining);
		if (index !== -1) remaining.splice(index, 1);
	}

	return {
		mapping: { ...mapping, matched: remaining },
		usage,
		cost
	};
}

function resolveToMatchedIndex(catalogName: string, matched: MappedStudy[]): number {
	const normalized = normalize(catalogName);
	const exactIndex = matched.findIndex((s) => normalize(s.catalogName) === normalized);
	if (exactIndex !== -1) return exactIndex;
	return matched.findIndex(
		(s) => normalize(s.catalogName).includes(normalized) || normalized.includes(normalize(s.catalogName))
	);
}
