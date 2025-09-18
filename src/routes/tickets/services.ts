export async function updateTicketStatus(id: number, status: 'open' | 'in_progress' | 'resolved') {
	const formData = new FormData();
	formData.append('id', String(id));
	formData.append('status', status);
	const response = await fetch('?/updateStatus', { method: 'POST', body: formData });
	const result = await response.json().catch(() => ({}));
	return { ok: response.ok || (result && result.type === 'success') };
}

export async function cycleStatus(
	currentStatus: string
): Promise<'open' | 'in_progress' | 'resolved' | null> {
	const flow: Record<string, 'open' | 'in_progress' | 'resolved' | null> = {
		open: 'in_progress',
		in_progress: 'resolved',
		resolved: null
	};
	return flow[currentStatus] ?? null;
}

export async function deleteTicketById(id: number) {
	const formData = new FormData();
	formData.append('id', String(id));
	const response = await fetch('?/delete', { method: 'POST', body: formData });
	const result = await response.json().catch(() => ({}));
	return { ok: response.ok || (result && result.type === 'success') };
}
