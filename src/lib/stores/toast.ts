import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function addToast(message: string, type: ToastType = 'info', duration: number = 5000): string {
		const id = Math.random().toString(36).substring(2, 9);
		const toast: Toast = { id, message, type, duration };
		
		update(toasts => [...toasts, toast]);
		return id;
	}

	function removeToast(id: string) {
		update(toasts => toasts.filter(toast => toast.id !== id));
	}

	function success(message: string, duration?: number): string {
		return addToast(message, 'success', duration);
	}

	function error(message: string, duration?: number): string {
		return addToast(message, 'error', duration);
	}

	function warning(message: string, duration?: number): string {
		return addToast(message, 'warning', duration);
	}

	function info(message: string, duration?: number): string {
		return addToast(message, 'info', duration);
	}

	function clear() {
		update(() => []);
	}

	return {
		subscribe,
		add: addToast,
		remove: removeToast,
		success,
		error,
		warning,
		info,
		clear
	};
}

export const toastStore = createToastStore();
