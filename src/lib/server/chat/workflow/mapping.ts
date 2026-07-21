/**
 * Mapping workflow - Maps extracted study names to catalog entries.
 *
 * Two steps:
 * 1. Direct exact/substring match (fast, no LLM).
 * 2. For anything left over, a single reasoning pass with both the catalog
 *    tool and Google Search available — the model decides per study whether
 *    it needs to look up a synonym — followed by one cheap structuring call
 *    to shape the conclusion as JSON. No separate confidence-routing/
 *    validation pass like the old per-item grounded-search loop.
 */

import {
	GoogleGenAI,
	Type,
	type FunctionDeclaration,
	type Content,
	type Schema
} from '@google/genai';
import { env } from '$env/dynamic/private';
import type {
	ExtractedStudy,
	MappedStudy,
	MappingResult,
	AgentResult,
	LLMMappingResponse,
	LLMMapping,
	TokenUsage,
	MappingConfidence
} from './types';
import {
	type CatalogStudy,
	getAllStudies,
	findBestMatch,
	formatCatalogByCategory
} from './catalog';
import { buildMappingPrompt } from '../prompts/mapping';
import { MODEL_CONFIG } from '$lib/server/chat/workflow/models';

const MAPPING_MODEL = MODEL_CONFIG.mapping;
const PARSER_MODEL = MODEL_CONFIG.parser;

/** Max get_catalog round trips before giving up and forcing a final answer. */
const MAX_TOOL_ITERATIONS = 3;

export interface MappingWorkflowResult extends AgentResult<MappingResult> {
	usage?: TokenUsage;
	cost?: number;
}

/** Tool the model can call to fetch the full study catalog on demand. */
const getCatalogDeclaration: FunctionDeclaration = {
	name: 'get_catalog',
	description:
		'Returns the full lab study catalog, grouped by category, with prices. Call this before proposing any mapping.',
	parameters: {
		type: Type.OBJECT,
		properties: {},
		required: []
	}
};

const mappingResponseSchema: Schema = {
	type: Type.OBJECT,
	properties: {
		mappings: {
			type: Type.ARRAY,
			items: {
				type: Type.OBJECT,
				properties: {
					original: { type: Type.STRING, description: 'Original study name from input' },
					catalogName: {
						type: Type.STRING,
						description: 'Matched catalog name (empty if unmatched)'
					},
					confidence: {
						type: Type.STRING,
						description: 'Confidence level: high, medium, or low',
						format: 'enum',
						enum: ['high', 'medium', 'low']
					},
					reasoning: {
						type: Type.STRING,
						description: 'Brief explanation of why this match was chosen'
					},
					unmatched: { type: Type.BOOLEAN, description: 'True if no match found in catalog' }
				},
				required: ['original', 'catalogName', 'confidence', 'unmatched']
			}
		}
	},
	required: ['mappings']
};

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
	if (!client) {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
		client = new GoogleGenAI({ apiKey });
	}
	return client;
}

function emptyUsage(): TokenUsage {
	return { inputTokens: 0, outputTokens: 0 };
}

function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
	return {
		inputTokens: a.inputTokens + b.inputTokens,
		outputTokens: a.outputTokens + b.outputTokens
	};
}

function extractUsage(response: {
	usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}): TokenUsage {
	return {
		inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
		outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0
	};
}

function toMappedStudy(
	extracted: ExtractedStudy,
	match: CatalogStudy,
	meta: { confidence: MappingConfidence; reasoning?: string }
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
		matchMethod: meta.confidence === 'exact' ? 'direct' : 'llm',
		reasoning: meta.reasoning,
		extractionConfidence: extracted.extractionConfidence
	};
}

// ── Step 1: Direct Matching ─────────────────────────────────────────────

/** Try exact and substring matching against the catalog (no LLM). */
function directMatch(
	studies: ExtractedStudy[],
	catalog: CatalogStudy[]
): { matched: MappedStudy[]; remaining: ExtractedStudy[] } {
	const matched: MappedStudy[] = [];
	const remaining: ExtractedStudy[] = [];

	for (const extracted of studies) {
		const match = findBestMatch(extracted.name, catalog);
		if (match) {
			matched.push(toMappedStudy(extracted, match, { confidence: 'exact' }));
		} else {
			remaining.push(extracted);
		}
	}

	return { matched, remaining };
}

// ── Step 2: LLM mapping (catalog tool + Google Search, then structure) ──

/**
 * Map the remaining studies through the model in two calls:
 *
 * 1. Reasoning: `get_catalog` and Google Search both available (requires
 *    `includeServerSideToolInvocations` — Search then runs server-side,
 *    folded into the response; only `get_catalog` needs a client answer).
 *    No `responseSchema` here — when Search actually fires mid-answer, its
 *    inline citation parts corrupt a structured-JSON stream (confirmed
 *    empirically: the model splits its JSON text across parts around the
 *    citation and the schema-mode output comes back truncated/invalid).
 * 2. Structuring: one more call, no tools, `responseSchema` on, reusing the
 *    resolved conversation — just shapes whatever the model already
 *    concluded into JSON. Cheap; not a second reasoning pass.
 */
async function llmMapRemaining(
	remaining: ExtractedStudy[],
	catalog: CatalogStudy[]
): Promise<{ matched: MappedStudy[]; unmatched: ExtractedStudy[]; usage: TokenUsage }> {
	const studyList = remaining.map((s) => `- "${s.name}"`).join('\n');
	let contents: Content[] = [
		{ role: 'user', parts: [{ text: `Mapea estos estudios al catálogo:\n\n${studyList}` }] }
	];
	let usage = emptyUsage();
	const systemInstruction = buildMappingPrompt();

	for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
		const response = await getClient().models.generateContent({
			model: MAPPING_MODEL.name,
			contents,
			config: {
				...MAPPING_MODEL,
				tools: [{ functionDeclarations: [getCatalogDeclaration] }, { googleSearch: {} }],
				toolConfig: { includeServerSideToolInvocations: true },
				systemInstruction
			}
		});
		usage = mergeUsage(usage, extractUsage(response));

		const modelParts = response.candidates?.[0]?.content?.parts ?? [];
		contents = [...contents, { role: 'model', parts: modelParts }];

		const catalogCall = (response.functionCalls ?? []).find((call) => call.name === 'get_catalog');
		if (!catalogCall) break;

		contents.push({
			role: 'user',
			parts: [
				{
					functionResponse: {
						id: catalogCall.id,
						name: catalogCall.name,
						response: { catalog: formatCatalogByCategory(catalog) }
					}
				}
			]
		});
	}

	let cost = MAPPING_MODEL.getCost(usage);

	contents.push({
		role: 'user',
		parts: [{ text: 'Devolvé ahora el JSON final con el mapeo de estos estudios.' }]
	});
	const finalResponse = await getClient().models.generateContent({
		model: PARSER_MODEL.name,
		contents,
		config: {
			...PARSER_MODEL,
			responseMimeType: 'application/json',
			responseSchema: mappingResponseSchema
		}
	});
	const parserUsage = extractUsage(finalResponse);
	cost += PARSER_MODEL.getCost(parserUsage);
	usage = mergeUsage(usage, parserUsage);

	const parsed = parseMappingResponse(finalResponse.text);
	return routeMappings(parsed, remaining, catalog, usage, cost);
}

function parseMappingResponse(text: string | undefined): LLMMappingResponse {
	if (!text) return { mappings: [] };
	return JSON.parse(text) as LLMMappingResponse;
}

function routeMappings(
	response: LLMMappingResponse,
	remaining: ExtractedStudy[],
	catalog: CatalogStudy[],
	usage: TokenUsage,
	cost: number
): { matched: MappedStudy[]; unmatched: ExtractedStudy[]; usage: TokenUsage; cost: number } {
	const matched: MappedStudy[] = [];
	const unmatched: ExtractedStudy[] = [];

	for (const mapping of response.mappings as LLMMapping[]) {
		const extracted = remaining.find((s) => s.name === mapping.original);
		if (!extracted) continue;

		if (mapping.unmatched || !mapping.catalogName) {
			unmatched.push(extracted);
			continue;
		}

		const catalogMatch = findBestMatch(mapping.catalogName, catalog);
		if (catalogMatch) {
			matched.push(
				toMappedStudy(extracted, catalogMatch, {
					confidence: mapping.confidence,
					reasoning: mapping.reasoning
				})
			);
		} else {
			unmatched.push(extracted);
		}
	}

	return { matched, unmatched, usage, cost };
}

// ── Public API ───────────────────────────────────────────────────────────

/** Map extracted studies to catalog entries: direct match, then LLM fallback. */
export async function mapStudies(studies: ExtractedStudy[]): Promise<MappingWorkflowResult> {
	try {
		const catalog = getAllStudies();
		const { matched, remaining } = directMatch(studies, catalog);

		if (remaining.length === 0) {
			return { success: true, data: { matched, unmatched: [] } };
		}

		const llmResult = await llmMapRemaining(remaining, catalog);
		return {
			success: true,
			data: { matched: [...matched, ...llmResult.matched], unmatched: llmResult.unmatched },
			usage: llmResult.usage
		};
	} catch (error) {
		console.error('Mapping workflow error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown mapping error'
		};
	}
}
