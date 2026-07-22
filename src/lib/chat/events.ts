import type { QuoteResult } from '$lib/server/chat/workflow';

export const ChatEventType = {
	TRANSCRIPT: 'transcript',
	TEXT_DELTA: 'text-delta',
	FINISH: 'finish',
	ERROR: 'error',
	STATUS: 'status'
} as const;
export type ChatEventType = (typeof ChatEventType)[keyof typeof ChatEventType];

export interface ChatUsage {
	inputTokens: number;
	outputTokens: number;
	costUsd: number;
	costArs?: number;
}
interface BaseChatEvent {
	type: ChatEventType;
	data: unknown;
}

export class TranscriptChatEvent implements BaseChatEvent {
	readonly type = 'transcript' as const;
	readonly data: string;
	constructor(data: string) {
		this.data = data;
	}
}
export class ErrorChatEvent implements BaseChatEvent {
	readonly type = 'error' as const;
	readonly data: Error;
	constructor(data: Error) {
		this.data = data;
	}
}
export class TextDeltaChatEvent implements BaseChatEvent {
	readonly type = 'text-delta' as const;
	readonly data: string;
	constructor(data: string) {
		this.data = data;
	}
}
export class FinishChatEvent implements BaseChatEvent {
	readonly type = 'finish' as const;
	readonly data: { usage: ChatUsage; quote?: QuoteResult };
	constructor(data: { usage: ChatUsage; quote?: QuoteResult }) {
		this.data = data;
	}
}
export class StatusChatEvent implements BaseChatEvent {
	readonly type = 'status' as const;
	readonly data: string;
	constructor(data: string) {
		this.data = data;
	}
}

export type ChatEvent =
	| StatusChatEvent
	| FinishChatEvent
	| TextDeltaChatEvent
	| ErrorChatEvent
	| TranscriptChatEvent;

interface EventCallbacks {
	onTranscript(transcript: string): void;
	onStatusChange(status: string): void;
	onTextDelta(text: string): void;
	onFinish(usage: ChatUsage): void;
	onError(error: unknown): void;
}

export function mapLineToCallback(
	line: string,
	{ onTranscript, onStatusChange, onTextDelta, onFinish, onError }: EventCallbacks
) {
	if (!line.trim()) return null;
	try {
		const event: ChatEvent = JSON.parse(line);

		switch (event.type) {
			case ChatEventType.STATUS:
				onStatusChange(event.data);
				break;

			case ChatEventType.TRANSCRIPT:
				onTranscript(event.data);
				break;

			case ChatEventType.TEXT_DELTA:
				onTextDelta(event.data);
				break;

			case ChatEventType.FINISH:
				onFinish(event.data.usage);
				break;

			case ChatEventType.ERROR:
				onError(event.data);
				break;
		}
	} catch (err) {
		console.error('Error parseando fragmento NDJSON:', err, line);
	}
}
