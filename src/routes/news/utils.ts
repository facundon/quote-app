import type { Bulletin } from '$lib/server/db/schema';

export type PeriodFilter = 'day' | 'three-days' | 'week' | 'two-weeks' | 'month';

export interface DateRange {
	start: Date;
	end: Date;
}

export function getPeriodDateRange(period: PeriodFilter): DateRange {
	const end = new Date();
	const start = new Date();

	switch (period) {
		case 'day':
			start.setDate(start.getDate() - 1);
			break;
		case 'three-days':
			start.setDate(start.getDate() - 3);
			break;
		case 'week':
			start.setDate(start.getDate() - 7);
			break;
		case 'two-weeks':
			start.setDate(start.getDate() - 14);
			break;
		case 'month':
			start.setDate(start.getDate() - 30);
			break;
	}

	return { start, end };
}

export function formatDate(isoString: string): string {
	const date = new Date(isoString);
	const formatter = new Intl.DateTimeFormat('es-AR', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
	return formatter.format(date);
}

export function getTimeAgo(isoString: string): string {
	const date = new Date(isoString);
	const now = new Date();
	const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (seconds < 60) return 'hace unos segundos';
	if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} minutos`;
	if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} horas`;
	if (seconds < 604800) return `hace ${Math.floor(seconds / 86400)} días`;
	if (seconds < 2592000) return `hace ${Math.floor(seconds / 604800)} semanas`;
	return `hace ${Math.floor(seconds / 2592000)} meses`;
}

export function parseEmployeesJson(jsonString: string | null | undefined): string[] {
	if (!jsonString) return [];
	try {
		const parsed = JSON.parse(jsonString);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function stringifyEmployeesJson(arr: string[]): string {
	return JSON.stringify(arr);
}

export function getEmployeeColor(name: string): string {
	const colors = [
		'bg-blue-100 text-blue-800',
		'bg-green-100 text-green-800',
		'bg-red-100 text-red-800',
		'bg-purple-100 text-purple-800',
		'bg-yellow-100 text-yellow-800',
		'bg-pink-100 text-pink-800',
		'bg-indigo-100 text-indigo-800',
		'bg-cyan-100 text-cyan-800'
	];

	// Hash function to consistently assign colors
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		const char = name.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	return colors[Math.abs(hash) % colors.length];
}

export function applyFilters(
	bulletins: Bulletin[],
	period: PeriodFilter,
	searchTerm: string,
	employeeFilter: string
): Bulletin[] {
	const { start, end } = getPeriodDateRange(period);

	return bulletins
		.filter((b) => {
			const itemDate = new Date(b.created_at);
			return itemDate >= start;
		})
		.filter((b) => {
			if (!searchTerm) return true;
			return b.title.toLowerCase().includes(searchTerm.toLowerCase());
		})
		.filter((b) => {
			if (!employeeFilter) return true;
			const employees = parseEmployeesJson(b.employees);
			return employees.includes(employeeFilter);
		})
		.sort((a, b) => {
			// Pinned first, then by date descending
			if (a.isPinned !== b.isPinned) {
				return a.isPinned === 'true' ? -1 : 1;
			}
			return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
		});
}

export const periodOptions = [
	{ value: 'day', label: 'Hoy' },
	{ value: 'three-days', label: '3 días' },
	{ value: 'week', label: 'Semana' },
	{ value: 'two-weeks', label: '2 semanas' },
	{ value: 'month', label: '1 Mes' }
];
