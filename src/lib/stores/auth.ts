import { writable } from 'svelte/store';

export const isAuthenticated = writable(false);

export function login(password: string): boolean {
	if (password === 'admin') {
		isAuthenticated.set(true);
		return true;
	}
	return false;
}

export function logout() {
	isAuthenticated.set(false);
}
