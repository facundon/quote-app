/**
 * ExtractionAgent - Extracts medical study names from text/images.
 * Uses Gemini's structured output to ensure valid JSON responses.
 */

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import type { ExtractedStudy, AgentResult } from './types';
import { EXTRACTION_SYSTEM_PROMPT, IMAGE_ONLY_PROMPT } from '../prompts/extraction';

const MODEL = 'gemini-2.5-flash';

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
							'How confident you are in reading this study name: high (clearly written/typed), medium (somewhat ambiguous or partially readable), low (guessing from poor handwriting or blurry image)',
						format: 'enum',
						enum: ['high', 'medium', 'low']
					}
				},
				required: ['name', 'quantity', 'confidence']
			}
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
}

interface ExtractionResponseStudy {
	name: string;
	quantity: number;
	context?: string;
	confidence: string;
}

interface ExtractionResponse {
	studies: ExtractionResponseStudy[];
}

interface ExtractionUsage {
	inputTokens: number;
	outputTokens: number;
}

export interface ExtractionResult extends AgentResult<ExtractedStudy[]> {
	usage?: ExtractionUsage;
}

/**
 * ExtractionAgent class that handles study extraction from text and images.
 */
export class ExtractionAgent {
	private client: GoogleGenerativeAI;

	constructor() {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) {
			throw new Error('GEMINI_API_KEY not configured');
		}
		this.client = new GoogleGenerativeAI(apiKey);
	}

	/**
	 * Extract medical studies from the given input.
	 * Uses structured output to ensure valid JSON.
	 */
	async extract(input: ExtractionInput): Promise<ExtractionResult> {
		try {
			const model = this.client.getGenerativeModel({
				model: MODEL,
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

				// Add default prompt if no text provided
				if (!input.text) {
					parts.unshift({ text: IMAGE_ONLY_PROMPT });
				}
			}

			// Must have at least some content
			if (parts.length === 0) {
				return {
					success: false,
					error: 'No input provided for extraction'
				};
			}

			const result = await model.generateContent(parts);
			const response = result.response;

			// Check for blocked content
			const promptFeedback = response.promptFeedback;
			if (promptFeedback?.blockReason) {
				return {
					success: false,
					error: `Request blocked: ${promptFeedback.blockReason}`
				};
			}

			const candidate = response.candidates?.[0];
			if (!candidate) {
				return {
					success: false,
					error: 'No response from extraction model'
				};
			}

			// Check finish reason
			if (candidate.finishReason === 'SAFETY') {
				return {
					success: false,
					error: 'Response blocked due to safety filters'
				};
			}

			// Parse the structured JSON response
			const text = candidate.content?.parts?.[0]?.text;
			if (!text) {
				return {
					success: false,
					error: 'Empty response from extraction model'
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

			return {
				success: true,
				data: studies,
				usage: {
					inputTokens: response.usageMetadata?.promptTokenCount || 0,
					outputTokens: response.usageMetadata?.candidatesTokenCount || 0
				}
			};
		} catch (error) {
			console.error('ExtractionAgent error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown extraction error'
			};
		}
	}
}

/**
 * Singleton instance for convenience.
 */
let instance: ExtractionAgent | null = null;

export function getExtractionAgent(): ExtractionAgent {
	if (!instance) {
		instance = new ExtractionAgent();
	}
	return instance;
}
