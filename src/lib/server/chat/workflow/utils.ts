export function getEventEmitter<T extends { data: unknown; type: string }>(
	controller: ReadableStreamDefaultController
) {
	const encoder = new TextEncoder();

	const emit = ({ data, type }: T) => {
		const payload = JSON.stringify({ type, data }) + '\n';
		controller.enqueue(encoder.encode(payload));
	};
	return emit;
}
