/**
 * Type definitions for the multi-agent chat pipeline.
 * Each agent passes strongly-typed data to the next stage.
 */

/**
 * Raw study extracted from user input (text or image).
 * This is the output of the ExtractionAgent before catalog matching.
 */
export interface ExtractedStudy {
	/** Raw name as written/detected */
	name: string;
	/** Quantity requested (default 1 if not specified) */
	quantity: number;
	/** Any relevant context (e.g., "urgent", "fasting required") */
	context?: string;
}

/**
 * Study after mapping to the catalog.
 * Contains both the original extraction and the catalog match.
 */
export interface MappedStudy {
	/** Original name as extracted */
	original: string;
	/** Exact name from catalog (empty if unmatched) */
	catalogName: string;
	/** Study ID from database (0 if unmatched) */
	catalogId: number;
	/** Category name for pricing */
	categoryName: string;
	/** Category ID for pricing */
	categoryId: number;
	/** Unit price from category */
	unitPrice: number;
	/** Quantity requested */
	quantity: number;
	/** Confidence level of the match */
	confidence: 'exact' | 'fuzzy' | 'unmatched';
}

/**
 * Result of the mapping stage.
 */
export interface MappingResult {
	/** Successfully mapped studies */
	matched: MappedStudy[];
	/** Studies that couldn't be mapped to catalog */
	unmatched: ExtractedStudy[];
}

/**
 * Line item in the quote calculation.
 */
export interface QuoteLineItem {
	/** Category name */
	category: string;
	/** Studies in this category */
	studies: string[];
	/** Total quantity */
	quantity: number;
	/** Price per unit */
	unitPrice: number;
	/** Subtotal before discount */
	subtotal: number;
	/** Discount percentage applied */
	discountPercentage: number;
	/** Discount amount */
	discountAmount: number;
	/** Final line total */
	lineTotal: number;
}

/**
 * Complete quote calculation result.
 */
export interface QuoteResult {
	/** Itemized breakdown by category */
	lineItems: QuoteLineItem[];
	/** Summary totals */
	summary: {
		totalStudies: number;
		subtotal: number;
		totalDiscount: number;
		finalTotal: number;
	};
	/** Studies that couldn't be found in catalog */
	unmatchedStudies: string[];
}

/**
 * Generic result wrapper for agent operations.
 */
export interface AgentResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

// ── LLM Mapping Types ────────────────────────────────────────────────

/**
 * Confidence levels for LLM matching.
 * - high: LLM is very confident (common abbreviation, clear synonym)
 * - medium: LLM thinks it's a match but not 100% sure
 * - low: LLM is guessing, needs web validation
 */
export type MatchConfidence = 'high' | 'medium' | 'low';

/** A single mapping result from the LLM. */
export interface LLMMapping {
	original: string;
	catalogName: string;
	confidence: MatchConfidence;
	reasoning?: string;
	unmatched: boolean;
}

/** Full LLM mapping response structure. */
export interface LLMMappingResponse {
	mappings: LLMMapping[];
}

/** Token usage tracking for LLM calls. */
export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
}

/**
 * Final pipeline response to be sent to the client.
 */
export interface PipelineResponse {
	/** Formatted markdown response for the user */
	response: string;
	/** Structured quote data (for programmatic access) */
	quote?: QuoteResult;
	/** Token usage across all LLM calls */
	usage?: {
		inputTokens: number;
		outputTokens: number;
	};
}
