import type { Ticket } from '$lib/server/db/schema';

export const statusOptions = [
	{
		value: 'open',
		label: 'Pendiente',
		color: 'bg-blue-100 text-blue-800 border-blue-200',
		icon: '🔵'
	},
	{
		value: 'in_progress',
		label: 'En Progreso',
		color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
		icon: '🟡'
	},
	{
		value: 'resolved',
		label: 'Resuelto',
		color: 'bg-green-100 text-green-800 border-green-200',
		icon: '✅'
	}
];

export const prioridadOptions = [
	{
		value: 'low',
		label: 'Baja',
		color: 'bg-green-100 text-green-800 border-green-200',
		icon: '🟢'
	},
	{
		value: 'medium',
		label: 'Media',
		color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
		icon: '🟠'
	},
	{
		value: 'high',
		label: 'Alta',
		color: 'bg-orange-100 text-orange-800 border-orange-200',
		icon: '🔴'
	},
	{ value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-800 border-red-200', icon: '🚨' }
];

export function getStatusInfo(status: string) {
	return statusOptions.find((s) => s.value === status) || statusOptions[0];
}

export function getPrioridadInfo(prioridad: string) {
	return prioridadOptions.find((p) => p.value === prioridad) || prioridadOptions[1];
}

export function formatDate(dateString: string | null) {
	if (!dateString) return '-';
	const utcDate = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
	return utcDate.toLocaleDateString('es-ES', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function getTimeAgo(dateString: string) {
	const now = new Date();
	const date = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMinutes = Math.floor(diffMs / (1000 * 60));

	if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
	if (diffHours > 0) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
	if (diffMinutes > 0) return `hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
	return 'hace un momento';
}

function hashStringToHue(value: string): number {
	let hash = 0;
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}
	return hash % 360;
}

export function getAssigneeStyle(name: string | null): { bg: string; text: string } {
	if (!name) {
		return { bg: 'hsl(210, 20%, 90%)', text: 'hsl(215, 25%, 27%)' };
	}
	const hue = hashStringToHue(name);
	return {
		bg: `hsl(${hue}, 85%, 88%)`,
		text: `hsl(${hue}, 60%, 35%)`
	};
}

export type { Ticket };
