import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProvider, type ChatMessage } from '$lib/server/chat/providers';

interface ChatRequest {
	messages: ChatMessage[];
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as ChatRequest;
	const { messages } = body;

	if (!messages || !Array.isArray(messages)) {
		return json({ error: 'messages array is required' }, { status: 400 });
	}

	try {
		const provider = getProvider();
		const result = await provider.chat(messages);

		return json({
			response: result.response,
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
