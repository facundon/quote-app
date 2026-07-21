import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processConversation, type PipelineChatMessage } from '$lib/server/chat/workflow';

interface ChatRequest {
	messages: PipelineChatMessage[];
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as ChatRequest;
	const { messages } = body;

	if (!messages || !Array.isArray(messages)) {
		return json({ error: 'messages array is required' }, { status: 400 });
	}

	const stream = new ReadableStream({
		async start(controller) {
			try {
				await processConversation(messages, controller);
			} catch (error) {
				console.error('Error en la lógica del stream:', error);
				controller.error(error);
			} finally {
				controller.close();
			}
		},
		cancel() {
			console.log('El cliente canceló la generación.');
			//TODO: add abort signal
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-cache'
		}
	});
};
