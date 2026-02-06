import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processConversation, type PipelineChatMessage } from '$lib/server/chat/agents';

interface ChatRequest {
	messages: PipelineChatMessage[];
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as ChatRequest;
	const { messages } = body;

	if (!messages || !Array.isArray(messages)) {
		return json({ error: 'messages array is required' }, { status: 400 });
	}

	try {
		const result = await processConversation(messages);

		return json({
			response: result.response,
			quote: result.quote,
			usage: result.usage
		});
	} catch (error) {
		console.error('Chat API error:', error);

		if (error instanceof Error) {
			// Check for configuration errors
			if (error.message.includes('not configured')) {
				return json({ error: error.message }, { status: 500 });
			}
			return json({ error: `API error: ${error.message}` }, { status: 500 });
		}

		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
