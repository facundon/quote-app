/**
 * Pipeline Orchestrator - Chains agents together to process chat messages.
 *
 * Flow:
 * 1. ExtractionAgent: Extract study names from text/image
 * 2. MappingAgent: Map extracted names to catalog entries
 * 3. QuoteAgent: Calculate quote and format response
 */

import { env } from '$env/dynamic/private';
import { convertUsdToArs, getUsdToArsRate } from '$lib/server/exchange/usdToArs';
import { ExtractionAgent, EXTRACTION_MODEL, type ExtractionResult } from './extraction';
import { getMappingAgent, MAPPING_MODEL, type MappingAgentResult } from './mapping';
import { getQuoteAgent } from './quote';
import { calculateCostUsd } from './pricing';
import type { PipelineResponse, QuoteResult } from './types';

/**
 * Singleton ExtractionAgent instance for the app's pipeline.
 * Kept out of extraction.ts so that file has no SvelteKit dependency and
 * can be imported directly by the extraction eval harness (evals/extraction).
 */
let extractionAgentInstance: ExtractionAgent | null = null;

function getExtractionAgent(): ExtractionAgent {
	if (!extractionAgentInstance) {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) {
			throw new Error('GEMINI_API_KEY not configured');
		}
		extractionAgentInstance = new ExtractionAgent(apiKey);
	}
	return extractionAgentInstance;
}

export interface ChatMessage {
	role: 'user' | 'assistant';
	content?: string;
	/** Base64-encoded image data (without data URL prefix) */
	image?: string;
	/** MIME type of the image */
	imageType?: string;
	/** Base64-encoded audio data (without data URL prefix) */
	audio?: string;
	/** MIME type of the audio */
	audioType?: string;
}

interface PipelineUsage {
	inputTokens: number;
	outputTokens: number;
	costUsd: number;
	costArs?: number;
}

async function withArsCost(usage: PipelineUsage): Promise<PipelineUsage> {
	if (usage.costUsd <= 0) return usage;

	try {
		const rate = await getUsdToArsRate();
		return { ...usage, costArs: convertUsdToArs(usage.costUsd, rate) };
	} catch (err) {
		console.warn('[Pipeline] USD/ARS conversion failed:', err);
		return usage;
	}
}

/**
 * Process a single message through the agent pipeline.
 * This is the main entry point for quote generation.
 */
export async function processMessage(message: ChatMessage): Promise<PipelineResponse> {
	const extractionAgent = getExtractionAgent();
	const mappingAgent = getMappingAgent();
	const quoteAgent = getQuoteAgent();

	const totalUsage: PipelineUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

	// Stage 1: Extract studies from input
	console.log('[Pipeline] Stage 1: Extraction');
	const extractionResult: ExtractionResult = await extractionAgent.extract({
		text: message.content,
		image: message.image,
		imageType: message.imageType,
		audio: message.audio,
		audioType: message.audioType
	});

	if (!extractionResult.success) {
		console.error('[Pipeline] Extraction failed:', extractionResult.error);
		return {
			response: quoteAgent.formatErrorResponse(extractionResult.error || 'Error de extracción'),
			transcript: extractionResult.transcript,
			usage: await withArsCost(totalUsage)
		};
	}

	// Track usage
	if (extractionResult.usage) {
		totalUsage.inputTokens += extractionResult.usage.inputTokens;
		totalUsage.outputTokens += extractionResult.usage.outputTokens;
		totalUsage.costUsd += calculateCostUsd(
			EXTRACTION_MODEL,
			extractionResult.usage.inputTokens,
			extractionResult.usage.outputTokens
		);
	}

	const extractedStudies = extractionResult.data || [];
	console.log(`[Pipeline] Extracted ${extractedStudies.length} studies:`, extractedStudies);

	// Handle empty extraction
	if (extractedStudies.length === 0) {
		return {
			response: quoteAgent.formatEmptyResponse(),
			transcript: extractionResult.transcript,
			usage: await withArsCost(totalUsage)
		};
	}

	// Stage 2: Map to catalog
	console.log('[Pipeline] Stage 2: Mapping');
	const mappingResult: MappingAgentResult = await mappingAgent.map(extractedStudies);

	if (!mappingResult.success) {
		console.error('[Pipeline] Mapping failed:', mappingResult.error);
		return {
			response: quoteAgent.formatErrorResponse(mappingResult.error || 'Error de mapeo'),
			transcript: extractionResult.transcript,
			usage: await withArsCost(totalUsage)
		};
	}

	// Track usage
	if (mappingResult.usage) {
		totalUsage.inputTokens += mappingResult.usage.inputTokens;
		totalUsage.outputTokens += mappingResult.usage.outputTokens;
		totalUsage.costUsd += calculateCostUsd(
			MAPPING_MODEL,
			mappingResult.usage.inputTokens,
			mappingResult.usage.outputTokens
		);
	}

	const mapping = mappingResult.data!;
	console.log(
		`[Pipeline] Mapped: ${mapping.matched.length} matched, ${mapping.unmatched.length} unmatched`
	);

	// Log per-item confidence for debugging
	for (const study of mapping.matched) {
		const extractionTag = study.extractionConfidence
			? ` [extraction: ${study.extractionConfidence}]`
			: '';
		console.log(
			`[Pipeline]   "${study.original}" → "${study.catalogName}" (${study.matchMethod}/${study.confidence})${extractionTag}${study.reasoning ? ` — ${study.reasoning}` : ''}`
		);
	}

	// Handle case where nothing could be mapped
	if (mapping.matched.length === 0 && mapping.unmatched.length > 0) {
		const unmatchedNames = mapping.unmatched.map((u) => u.name).join(', ');
		return {
			response: `No pude encontrar estos estudios en el catálogo: ${unmatchedNames}\n\nPor favor, verificá los nombres o escribilos de otra forma.`,
			transcript: extractionResult.transcript,
			usage: await withArsCost(totalUsage)
		};
	}

	// Stage 3: Calculate quote
	console.log('[Pipeline] Stage 3: Quote calculation');
	const quote: QuoteResult = quoteAgent.calculate(mapping);
	console.log('[Pipeline] Quote calculated:', quote.summary);

	// Stage 4: Format response
	const response = quoteAgent.formatResponse(quote);

	return {
		response,
		quote,
		transcript: extractionResult.transcript,
		usage: await withArsCost(totalUsage)
	};
}

/**
 * Process a conversation (handles context from previous messages).
 * For now, only processes the last user message.
 * Future: could use conversation history for context.
 */
export async function processConversation(messages: ChatMessage[]): Promise<PipelineResponse> {
	// Find the last user message
	const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

	if (!lastUserMessage) {
		return {
			response: 'No encontré un mensaje para procesar.'
		};
	}

	return processMessage(lastUserMessage);
}

/**
 * Re-export types for convenience.
 */
export type { ChatMessage as PipelineChatMessage };
export type { PipelineResponse };
