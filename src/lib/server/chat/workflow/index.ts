/**
 * Agent pipeline exports.
 */

export { processMessage, processConversation } from './pipeline';
export type { ChatMessage as PipelineChatMessage, PipelineResponse } from './pipeline';

export { ExtractionAgent } from './extraction';
export { mapStudies } from './mapping';
export { getQuoteAgent, QuoteAgent } from './quote';

export type {
	ExtractedStudy,
	MappedStudy,
	MappingResult,
	QuoteResult,
	QuoteLineItem,
	AgentResult,
	PipelineResponse as PipelineResponseType
} from './types';
