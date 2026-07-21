/**
 * Pipeline Orchestrator - Chains agents together to process chat messages.
 *
 * Flow:
 * 1. ExtractionAgent: Extract study names from text/image
 * 2. Mapping workflow: Map extracted names to catalog entries
 * 3. QuoteAgent: Calculate quote and format response
 */

import { env } from '$env/dynamic/private';
import { convertUsdToArs, getUsdToArsRate } from '$lib/server/exchange/usdToArs';
import { ExtractionAgent, type ExtractionResult } from './extraction';
import { mapStudies, type MappingWorkflowResult } from './mapping';
import { getQuoteAgent } from './quote';
import { ChatEventType, type PipelineResponse, type QuoteResult, type TokenUsage } from './types';

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

function addToCost(totalUsage: PipelineUsage, usage: TokenUsage, cost: number | undefined) {
	totalUsage.inputTokens += usage.inputTokens;
	totalUsage.outputTokens += usage.outputTokens;
	totalUsage.costUsd += cost ?? 0;
}

/**
 * Process a single message through the agent pipeline.
 * This is the main entry point for quote generation.
 */
export async function processMessage(
	message: ChatMessage,
	controller: ReadableStreamDefaultController
): Promise<PipelineResponse> {
	const encoder = new TextEncoder();

	const emit = (type: ChatEventType | string, data: any) => {
		const payload = JSON.stringify({ type, data }) + '\n';
		controller.enqueue(encoder.encode(payload));
	};

	const extractionAgent = getExtractionAgent();
	const quoteAgent = getQuoteAgent();

	const totalUsage: PipelineUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

	console.log('[Pipeline] Stage 1: Extraction');

	if (message.audio) {
		emit(ChatEventType.STATUS, 'Escuchando y transcribiendo nota de voz...');
	} else if (message.image) {
		emit(ChatEventType.STATUS, 'Analizando la imagen enviada...');
	} else {
		emit(ChatEventType.STATUS, 'Procesando tu consulta...');
	}

	const extractionResult: ExtractionResult = await extractionAgent.extract({
		text: message.content,
		image: message.image,
		imageType: message.imageType,
		audio: message.audio,
		audioType: message.audioType
	});

	if (extractionResult.transcript) {
		emit(ChatEventType.TRANSCRIPT, extractionResult.transcript);
	}

	if (!extractionResult.success) {
		console.error('[Pipeline] Extraction failed:', extractionResult.error);
		const errorMsg = quoteAgent.formatErrorResponse(
			extractionResult.error || 'Error de extracción'
		);

		emit(ChatEventType.TEXT_DELTA, errorMsg);
		emit(ChatEventType.FINISH, { usage: await withArsCost(totalUsage) });

		return {
			response: errorMsg,
			transcript: extractionResult.transcript,
			usage: await withArsCost(totalUsage)
		};
	}

	if (extractionResult.usage) addToCost(totalUsage, extractionResult.usage, extractionResult.cost);

	const extractedStudies = extractionResult.data || [];
	console.log(`[Pipeline] Extracted ${extractedStudies.length} studies:`, extractedStudies);

	if (extractedStudies.length === 0) {
		const emptyMsg = quoteAgent.formatEmptyResponse();

		emit(ChatEventType.TEXT_DELTA, emptyMsg);
		emit(ChatEventType.FINISH, { usage: await withArsCost(totalUsage) });

		return {
			response: emptyMsg,
			transcript: extractionResult.transcript,
			usage: await withArsCost(totalUsage)
		};
	}

	console.log('[Pipeline] Stage 2: Mapping');
	emit(ChatEventType.STATUS, `Buscando ${extractedStudies.length} estudio(s) en el catálogo...`);

	const mappingResult: MappingWorkflowResult = await mapStudies(extractedStudies);

	if (!mappingResult.success) {
		console.error('[Pipeline] Mapping failed:', mappingResult.error);
		const errorMsg = quoteAgent.formatErrorResponse(mappingResult.error || 'Error de mapeo');

		emit(ChatEventType.TEXT_DELTA, errorMsg);
		emit(ChatEventType.FINISH, { usage: await withArsCost(totalUsage) });

		return {
			response: errorMsg,
			transcript: extractionResult.transcript,
			usage: await withArsCost(totalUsage)
		};
	}

	if (mappingResult.usage) addToCost(totalUsage, mappingResult.usage, mappingResult.cost);

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
		const unmappedMsg = `No pude encontrar estos estudios en el catálogo: ${unmatchedNames}\n\nPor favor, verificá los nombres o escribilos de otra forma.`;

		emit(ChatEventType.TEXT_DELTA, unmappedMsg);
		emit(ChatEventType.FINISH, { usage: await withArsCost(totalUsage) });

		return {
			response: unmappedMsg,
			transcript: extractionResult.transcript,
			usage: await withArsCost(totalUsage)
		};
	}

	console.log('[Pipeline] Stage 3: Quote calculation');
	emit(ChatEventType.STATUS, 'Generando presupuesto...');

	const quote: QuoteResult = quoteAgent.calculate(mapping);
	console.log('[Pipeline] Quote calculated:', quote.summary);

	const response = quoteAgent.formatResponse(quote);
	const finalUsage = await withArsCost(totalUsage);

	emit(ChatEventType.TEXT_DELTA, response);
	emit(ChatEventType.FINISH, { usage: finalUsage, quote });

	return {
		response,
		quote,
		transcript: extractionResult.transcript,
		usage: finalUsage
	};
}
/**
 * Process a conversation (handles context from previous messages).
 * For now, only processes the last user message.
 * Future: could use conversation history for context.
 */
export async function processConversation(
	messages: ChatMessage[],
	controller: ReadableStreamDefaultController
): Promise<PipelineResponse> {
	// Find the last user message
	const lastUserMessage = [...messages].findLast((m) => m.role === 'user');

	if (!lastUserMessage) {
		return {
			response: 'No encontré un mensaje para procesar.'
		};
	}

	return processMessage(lastUserMessage, controller);
}

/**
 * Re-export types for convenience.
 */
export type { ChatMessage as PipelineChatMessage };
export type { PipelineResponse };
