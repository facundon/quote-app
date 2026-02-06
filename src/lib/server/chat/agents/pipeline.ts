/**
 * Pipeline Orchestrator - Chains agents together to process chat messages.
 *
 * Flow:
 * 1. ExtractionAgent: Extract study names from text/image
 * 2. MappingAgent: Map extracted names to catalog entries
 * 3. QuoteAgent: Calculate quote and format response
 */

import { getExtractionAgent, type ExtractionResult } from './extraction';
import { getMappingAgent, type MappingAgentResult } from './mapping';
import { getQuoteAgent } from './quote';
import type { PipelineResponse, QuoteResult } from './types';

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	/** Base64-encoded image data (without data URL prefix) */
	image?: string;
	/** MIME type of the image */
	imageType?: string;
}

interface PipelineUsage {
	inputTokens: number;
	outputTokens: number;
}

/**
 * Process a single message through the agent pipeline.
 * This is the main entry point for quote generation.
 */
export async function processMessage(message: ChatMessage): Promise<PipelineResponse> {
	const extractionAgent = getExtractionAgent();
	const mappingAgent = getMappingAgent();
	const quoteAgent = getQuoteAgent();

	let totalUsage: PipelineUsage = { inputTokens: 0, outputTokens: 0 };

	// Stage 1: Extract studies from input
	console.log('[Pipeline] Stage 1: Extraction');
	const extractionResult: ExtractionResult = await extractionAgent.extract({
		text: message.content,
		image: message.image,
		imageType: message.imageType
	});

	if (!extractionResult.success) {
		console.error('[Pipeline] Extraction failed:', extractionResult.error);
		return {
			response: quoteAgent.formatErrorResponse(extractionResult.error || 'Error de extracción'),
			usage: totalUsage
		};
	}

	// Track usage
	if (extractionResult.usage) {
		totalUsage.inputTokens += extractionResult.usage.inputTokens;
		totalUsage.outputTokens += extractionResult.usage.outputTokens;
	}

	const extractedStudies = extractionResult.data || [];
	console.log(`[Pipeline] Extracted ${extractedStudies.length} studies:`, extractedStudies);

	// Handle empty extraction
	if (extractedStudies.length === 0) {
		return {
			response: quoteAgent.formatEmptyResponse(),
			usage: totalUsage
		};
	}

	// Stage 2: Map to catalog
	console.log('[Pipeline] Stage 2: Mapping');
	const mappingResult: MappingAgentResult = await mappingAgent.map(extractedStudies);

	if (!mappingResult.success) {
		console.error('[Pipeline] Mapping failed:', mappingResult.error);
		return {
			response: quoteAgent.formatErrorResponse(mappingResult.error || 'Error de mapeo'),
			usage: totalUsage
		};
	}

	// Track usage
	if (mappingResult.usage) {
		totalUsage.inputTokens += mappingResult.usage.inputTokens;
		totalUsage.outputTokens += mappingResult.usage.outputTokens;
	}

	const mapping = mappingResult.data!;
	console.log(
		`[Pipeline] Mapped: ${mapping.matched.length} matched, ${mapping.unmatched.length} unmatched`
	);

	// Handle case where nothing could be mapped
	if (mapping.matched.length === 0 && mapping.unmatched.length > 0) {
		const unmatchedNames = mapping.unmatched.map((u) => u.name).join(', ');
		return {
			response: `No pude encontrar estos estudios en el catálogo: ${unmatchedNames}\n\nPor favor, verificá los nombres o escribilos de otra forma.`,
			usage: totalUsage
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
		usage: totalUsage
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
