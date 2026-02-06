/**
 * MappingAgent - Maps extracted study names to catalog entries.
 *
 * Uses a three-tier approach:
 * 1. Exact/substring match (fast, no LLM)
 * 2. LLM medical expertise with confidence levels
 * 3. Gemini Grounding with Google Search for low-confidence matches
 */

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import type {
	ExtractedStudy,
	MappedStudy,
	MappingResult,
	AgentResult,
	LLMMappingResponse,
	LLMMapping,
	TokenUsage,
	MatchMethod,
	MappingConfidence
} from './types';
import {
	type CatalogStudy,
	getAllStudies,
	findExactMatch,
	findSubstringMatch,
	findBestMatch,
	formatCatalogByCategory,
	formatCatalogFlat
} from './catalog';
import { buildMappingPrompt, buildGroundedSearchPrompt } from '../prompts/mapping';

const MODEL = 'gemini-2.5-flash';

export interface MappingAgentResult extends AgentResult<MappingResult> {
	usage?: TokenUsage;
}

// ── LLM Response Schema ──────────────────────────────────────────────

const mappingResponseSchema: Schema = {
	type: SchemaType.OBJECT,
	properties: {
		mappings: {
			type: SchemaType.ARRAY,
			items: {
				type: SchemaType.OBJECT,
				properties: {
					original: {
						type: SchemaType.STRING,
						description: 'Original study name from input'
					},
					catalogName: {
						type: SchemaType.STRING,
						description: 'Matched catalog name (empty if unmatched)'
					},
					confidence: {
						type: SchemaType.STRING,
						description: 'Confidence level: high, medium, or low',
						format: 'enum',
						enum: ['high', 'medium', 'low']
					},
					reasoning: {
						type: SchemaType.STRING,
						description: 'Brief explanation of why this match was chosen'
					},
					unmatched: {
						type: SchemaType.BOOLEAN,
						description: 'True if no match found in catalog'
					}
				},
				required: ['original', 'catalogName', 'confidence', 'unmatched']
			}
		}
	},
	required: ['mappings']
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Merge two token usage objects. */
function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
	return {
		inputTokens: a.inputTokens + b.inputTokens,
		outputTokens: a.outputTokens + b.outputTokens
	};
}

/** Create a zero-value usage object. */
function emptyUsage(): TokenUsage {
	return { inputTokens: 0, outputTokens: 0 };
}

/** Extract token usage from a Gemini response. */
function extractUsage(response: {
	usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}): TokenUsage {
	return {
		inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
		outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0
	};
}

/** A low-confidence study awaiting grounded web validation. */
interface PendingValidation {
	extracted: ExtractedStudy;
	suggestedName: string;
}

// ── Agent ────────────────────────────────────────────────────────────

export class MappingAgent {
	private client: GoogleGenerativeAI;
	private catalogCache: CatalogStudy[] | null = null;

	constructor() {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
		this.client = new GoogleGenerativeAI(apiKey);
	}

	// ── Public API ─────────────────────────────────────────────────

	/** Map extracted studies to catalog entries through the three-tier pipeline. */
	async map(studies: ExtractedStudy[]): Promise<MappingAgentResult> {
		try {
			const catalog = this.getCatalog();
			const { matched, remaining } = this.directMatch(studies, catalog);

			if (remaining.length === 0) {
				return this.success({ matched, unmatched: [] });
			}

			return await this.llmPipeline(remaining, matched, catalog);
		} catch (error) {
			console.error('MappingAgent error:', error);
			return this.failure(error);
		}
	}

	/** Clear the catalog cache (useful after DB updates). */
	clearCache(): void {
		this.catalogCache = null;
	}

	// ── Pass 1: Direct Matching ────────────────────────────────────

	/** Try exact and substring matching against the catalog (no LLM). */
	private directMatch(
		studies: ExtractedStudy[],
		catalog: CatalogStudy[]
	): { matched: MappedStudy[]; remaining: ExtractedStudy[] } {
		const matched: MappedStudy[] = [];
		const remaining: ExtractedStudy[] = [];

		for (const extracted of studies) {
			const match = findBestMatch(extracted.name, catalog);
			if (match) {
				matched.push(
					this.toMappedStudy(extracted, match, {
						confidence: 'exact',
						matchMethod: 'direct'
					})
				);
			} else {
				remaining.push(extracted);
			}
		}

		return { matched, remaining };
	}

	// ── Pass 2 + 3: LLM Pipeline ──────────────────────────────────

	/** Run LLM matching (pass 2) and grounded search (pass 3) for remaining studies. */
	private async llmPipeline(
		remaining: ExtractedStudy[],
		matched: MappedStudy[],
		catalog: CatalogStudy[]
	): Promise<MappingAgentResult> {
		const llmResult = await this.llmMatch(remaining);

		if (!llmResult.success) {
			return this.success({ matched, unmatched: remaining });
		}

		const unmatched: ExtractedStudy[] = [];
		const pendingValidation: PendingValidation[] = [];
		let usage = llmResult.usage ?? emptyUsage();

		this.routeByConfidence(
			llmResult.data?.mappings ?? [],
			remaining,
			catalog,
			matched,
			unmatched,
			pendingValidation
		);

		// Pass 3: grounded web search for low-confidence matches
		if (pendingValidation.length > 0) {
			const groundedResult = await this.groundedSearch(pendingValidation, catalog);
			matched.push(...groundedResult.matched);
			unmatched.push(...groundedResult.unmatched);

			if (groundedResult.usage) {
				usage = mergeUsage(usage, groundedResult.usage);
			}
		}

		return this.success({ matched, unmatched }, usage);
	}

	/** Route LLM mappings into matched, unmatched, or pending validation buckets. */
	private routeByConfidence(
		mappings: LLMMapping[],
		remaining: ExtractedStudy[],
		catalog: CatalogStudy[],
		matched: MappedStudy[],
		unmatched: ExtractedStudy[],
		pendingValidation: PendingValidation[]
	): void {
		for (const mapping of mappings) {
			const extracted = remaining.find((s) => s.name === mapping.original);
			if (!extracted) continue;

			if (mapping.unmatched || !mapping.catalogName) {
				unmatched.push(extracted);
				continue;
			}

			if (mapping.confidence === 'low') {
				pendingValidation.push({ extracted, suggestedName: mapping.catalogName });
				continue;
			}

			const catalogMatch = findExactMatch(mapping.catalogName, catalog);
			if (catalogMatch) {
				matched.push(
					this.toMappedStudy(extracted, catalogMatch, {
						confidence: mapping.confidence as MappingConfidence,
						matchMethod: 'llm',
						reasoning: mapping.reasoning
					})
				);
			} else {
				unmatched.push(extracted);
			}
		}
	}

	// ── Pass 2: LLM Medical Expertise ──────────────────────────────

	/** Use LLM medical expertise to match study names to catalog entries. */
	private async llmMatch(
		studies: ExtractedStudy[]
	): Promise<AgentResult<LLMMappingResponse> & { usage?: TokenUsage }> {
		try {
			const model = this.client.getGenerativeModel({
				model: MODEL,
				systemInstruction: buildMappingPrompt(formatCatalogByCategory(this.getCatalog())),
				generationConfig: {
					responseMimeType: 'application/json',
					responseSchema: mappingResponseSchema
				}
			});

			const studyList = studies.map((s) => `- "${s.name}"`).join('\n');
			const result = await model.generateContent(
				`Mapea estos estudios al catálogo:\n\n${studyList}`
			);
			const response = result.response;

			const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
			if (!text) {
				return { success: false, error: 'Empty response from mapping model' };
			}

			return {
				success: true,
				data: JSON.parse(text) as LLMMappingResponse,
				usage: extractUsage(response)
			};
		} catch (error) {
			console.error('LLM matching error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown LLM match error'
			};
		}
	}

	// ── Pass 3: Grounded Web Search ────────────────────────────────

	/** Validate low-confidence matches using Gemini Grounding with Google Search. */
	private async groundedSearch(
		studies: PendingValidation[],
		catalog: CatalogStudy[]
	): Promise<{ matched: MappedStudy[]; unmatched: ExtractedStudy[]; usage?: TokenUsage }> {
		const matched: MappedStudy[] = [];
		const unmatched: ExtractedStudy[] = [];
		let usage = emptyUsage();

		for (const { extracted, suggestedName } of studies) {
			try {
				const result = await this.searchAndValidate(extracted.name, suggestedName, catalog);
				usage = mergeUsage(usage, result.usage ?? emptyUsage());

				if (result.catalogMatch) {
					matched.push(
						this.toMappedStudy(extracted, result.catalogMatch, {
							confidence: 'grounded',
							matchMethod: 'grounded',
							reasoning: `Validated via web search (originally suggested: "${suggestedName}")`
						})
					);
				} else {
					unmatched.push(extracted);
				}
			} catch (error) {
				console.error(`Grounded search failed for "${extracted.name}":`, error);
				unmatched.push(extracted);
			}
		}

		return { matched, unmatched, usage };
	}

	/** Query Gemini with Google Search grounding for a single study. */
	private async searchAndValidate(
		originalName: string,
		suggestedName: string,
		catalog: CatalogStudy[]
	): Promise<{ catalogMatch?: CatalogStudy; usage?: TokenUsage }> {
		const model = this.client.getGenerativeModel({
			model: MODEL,
			tools: [{ googleSearchRetrieval: {} }]
		});

		const prompt = buildGroundedSearchPrompt(
			originalName,
			suggestedName,
			formatCatalogFlat(catalog)
		);

		try {
			const result = await model.generateContent(prompt);
			const response = result.response;
			const text = response.text().trim();
			const usage = extractUsage(response);

			if (!text || text === 'NO_MATCH') {
				return { usage };
			}

			const catalogMatch = findBestMatch(text, catalog);
			return { catalogMatch, usage };
		} catch (error) {
			console.error('Grounded search error:', error);
			return {};
		}
	}

	// ── Internal Helpers ───────────────────────────────────────────

	private getCatalog(): CatalogStudy[] {
		if (!this.catalogCache) {
			this.catalogCache = getAllStudies();
		}
		return this.catalogCache;
	}

	private toMappedStudy(
		extracted: ExtractedStudy,
		match: CatalogStudy,
		meta: {
			confidence: MappingConfidence;
			matchMethod: MatchMethod;
			reasoning?: string;
		}
	): MappedStudy {
		return {
			original: extracted.name,
			catalogName: match.name,
			catalogId: match.id,
			categoryName: match.categoryName,
			categoryId: match.categoryId,
			unitPrice: match.unitPrice,
			quantity: extracted.quantity,
			confidence: meta.confidence,
			matchMethod: meta.matchMethod,
			reasoning: meta.reasoning,
			extractionConfidence: extracted.extractionConfidence
		};
	}

	private success(data: MappingResult, usage?: TokenUsage): MappingAgentResult {
		return { success: true, data, usage };
	}

	private failure(error: unknown): MappingAgentResult {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown mapping error'
		};
	}
}

// ── Singleton ────────────────────────────────────────────────────────

let instance: MappingAgent | null = null;

export function getMappingAgent(): MappingAgent {
	if (!instance) instance = new MappingAgent();
	return instance;
}
