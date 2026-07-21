/**
 * ExtractionAgent - Extracts medical study names from text/images.
 * Uses Gemini's structured output to ensure valid JSON responses.
 */

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import type { ExtractedStudy, AgentResult } from './types';
import {
	EXTRACTION_SYSTEM_PROMPT,
	IMAGE_ONLY_PROMPT,
	AUDIO_ONLY_PROMPT
} from '../prompts/extraction';

export const EXTRACTION_MODEL = 'gemini-3.5-flash';

/**
 * Schema for structured JSON output.
 * Gemini will enforce this structure in its response.
 */
const extractionResponseSchema: Schema = {
	type: SchemaType.OBJECT,
	properties: {
		studies: {
			type: SchemaType.ARRAY,
			description: 'List of extracted medical studies',
			items: {
				type: SchemaType.OBJECT,
				properties: {
					name: {
						type: SchemaType.STRING,
						description: 'Study name as written in the input'
					},
					quantity: {
						type: SchemaType.NUMBER,
						description: 'Number of this study requested (default 1)'
					},
					context: {
						type: SchemaType.STRING,
						description: 'Optional context like urgency or special instructions'
					},
					confidence: {
						type: SchemaType.STRING,
						description:
							'How confident you are in reading/hearing this study name: high (clearly written/typed or clearly spoken), medium (somewhat ambiguous or partially readable/audible), low (guessing from poor handwriting, blurry image, or unclear/noisy audio)',
						format: 'enum',
						enum: ['high', 'medium', 'low']
					}
				},
				required: ['name', 'quantity', 'confidence']
			}
		},
		transcript: {
			type: SchemaType.STRING,
			description:
				'Verbatim (or best-effort) transcription of the audio input, if audio was provided. Empty otherwise.'
		}
	},
	required: ['studies']
};

interface ExtractionInput {
	/** Text content from the user */
	text?: string;
	/** Base64-encoded image data */
	image?: string;
	/** MIME type of the image */
	imageType?: string;
	/** Base64-encoded audio data */
	audio?: string;
	/** MIME type of the audio */
	audioType?: string;
}

interface ExtractionResponseStudy {
	name: string;
	quantity: number;
	context?: string;
	confidence: string;
}

interface ExtractionResponse {
	studies: ExtractionResponseStudy[];
	transcript?: string;
}

export interface ExtractionUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	cachedTokens?: number;
}

export interface ExtractionMeta {
	model: string;
	durationMs: number;
	finishReason?: string;
	inputKind: 'text' | 'image' | 'audio' | 'text+image' | 'audio+image';
	studyCount: number;
	confidenceBreakdown: { high: number; medium: number; low: number };
}

export interface ExtractionResult extends AgentResult<ExtractedStudy[]> {
	usage?: ExtractionUsage;
	meta?: ExtractionMeta;
	/** Transcription of the audio input, when audio was provided. */
	transcript?: string;
}

/**
 * ExtractionAgent class that handles study extraction from text and images.
 */
export class ExtractionAgent {
	private client: GoogleGenerativeAI;

	constructor(apiKey: string) {
		this.client = new GoogleGenerativeAI(apiKey);
	}

	/**
	 * Extract medical studies from the given input.
	 * Uses structured output to ensure valid JSON.
	 */
	async extract(input: ExtractionInput): Promise<ExtractionResult> {
		const startedAt = performance.now();

		const inputKind: ExtractionMeta['inputKind'] = input.audio
			? input.image
				? 'audio+image'
				: 'audio'
			: input.text && input.image
				? 'text+image'
				: input.image
					? 'image'
					: 'text';

		try {
			const model = this.client.getGenerativeModel({
				model: EXTRACTION_MODEL,
				systemInstruction: EXTRACTION_SYSTEM_PROMPT,
				generationConfig: {
					responseMimeType: 'application/json',
					responseSchema: extractionResponseSchema
				}
			});

			// Build the content parts
			const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> =
				[];

			// Add text content
			if (input.text) {
				parts.push({ text: input.text });
			}

			// Add image if present
			if (input.image) {
				const mimeType = input.imageType || 'image/jpeg';
				parts.push({
					inlineData: {
						mimeType,
						data: input.image
					}
				});
			}

			// Add audio if present
			if (input.audio) {
				const mimeType = input.audioType || 'audio/webm';
				parts.push({
					inlineData: {
						mimeType,
						data: input.audio
					}
				});
			}

			// Add default lead-in prompt if no text was provided alongside audio/image
			if (!input.text) {
				if (input.audio) {
					parts.unshift({ text: AUDIO_ONLY_PROMPT });
				} else if (input.image) {
					parts.unshift({ text: IMAGE_ONLY_PROMPT });
				}
			}

			// Must have at least some content
			if (parts.length === 0) {
				return {
					success: false,
					error: 'No input provided for extraction',
					meta: {
						model: EXTRACTION_MODEL,
						durationMs: Math.round(performance.now() - startedAt),
						inputKind,
						studyCount: 0,
						confidenceBreakdown: { high: 0, medium: 0, low: 0 }
					}
				};
			}

			const result = await model.generateContent(parts);
			const response = result.response;
			const durationMs = Math.round(performance.now() - startedAt);
			const usageMetadata = response.usageMetadata;

			const usage: ExtractionUsage = {
				inputTokens: usageMetadata?.promptTokenCount ?? 0,
				outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
				totalTokens: usageMetadata?.totalTokenCount ?? 0,
				cachedTokens: usageMetadata?.cachedContentTokenCount
			};

			const baseMeta: Omit<ExtractionMeta, 'studyCount' | 'confidenceBreakdown' | 'finishReason'> =
				{
					model: EXTRACTION_MODEL,
					durationMs,
					inputKind
				};

			// Check for blocked content
			const promptFeedback = response.promptFeedback;
			if (promptFeedback?.blockReason) {
				return {
					success: false,
					error: `Request blocked: ${promptFeedback.blockReason}`,
					usage,
					meta: {
						...baseMeta,
						finishReason: promptFeedback.blockReason,
						studyCount: 0,
						confidenceBreakdown: { high: 0, medium: 0, low: 0 }
					}
				};
			}

			const candidate = response.candidates?.[0];
			if (!candidate) {
				return {
					success: false,
					error: 'No response from extraction model',
					usage,
					meta: {
						...baseMeta,
						studyCount: 0,
						confidenceBreakdown: { high: 0, medium: 0, low: 0 }
					}
				};
			}

			// Check finish reason
			if (candidate.finishReason === 'SAFETY') {
				return {
					success: false,
					error: 'Response blocked due to safety filters',
					usage,
					meta: {
						...baseMeta,
						finishReason: candidate.finishReason,
						studyCount: 0,
						confidenceBreakdown: { high: 0, medium: 0, low: 0 }
					}
				};
			}

			// Parse the structured JSON response
			const text = candidate.content?.parts?.[0]?.text;
			if (!text) {
				return {
					success: false,
					error: 'Empty response from extraction model',
					usage,
					meta: {
						...baseMeta,
						finishReason: candidate.finishReason,
						studyCount: 0,
						confidenceBreakdown: { high: 0, medium: 0, low: 0 }
					}
				};
			}

			const parsed: ExtractionResponse = JSON.parse(text);

			// Validate and normalize the studies
			const studies: ExtractedStudy[] = parsed.studies.map((s) => ({
				name: s.name.trim(),
				quantity: Math.max(1, Math.round(s.quantity || 1)),
				context: s.context?.trim(),
				extractionConfidence: (['high', 'medium', 'low'].includes(s.confidence)
					? s.confidence
					: 'high') as 'high' | 'medium' | 'low'
			}));

			const confidenceBreakdown = { high: 0, medium: 0, low: 0 };
			for (const study of studies) {
				const level = study.extractionConfidence ?? 'high';
				confidenceBreakdown[level]++;
			}

			return {
				success: true,
				data: studies,
				usage,
				transcript: parsed.transcript?.trim() || undefined,
				meta: {
					...baseMeta,
					finishReason: candidate.finishReason,
					studyCount: studies.length,
					confidenceBreakdown
				}
			};
		} catch (error) {
			console.error('ExtractionAgent error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown extraction error',
				meta: {
					model: EXTRACTION_MODEL,
					durationMs: Math.round(performance.now() - startedAt),
					inputKind,
					studyCount: 0,
					confidenceBreakdown: { high: 0, medium: 0, low: 0 }
				}
			};
		}
	}
}
