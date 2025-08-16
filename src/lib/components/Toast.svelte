<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let { message, type = 'info', duration = 5000, onClose } = $props<{
		message: string;
		type?: 'success' | 'error' | 'warning' | 'info';
		duration?: number;
		onClose: () => void;
	}>();

	let visible = $state(true);
	let progress = $state(100);

	// Auto-hide timer
	let timer: ReturnType<typeof setTimeout>;

	// Progress bar animation
	let progressInterval: ReturnType<typeof setInterval>;

	function startTimer() {
		if (duration > 0) {
			timer = setTimeout(() => {
				close();
			}, duration);

			// Animate progress bar
			const startTime = Date.now();
			const endTime = startTime + duration;

			progressInterval = setInterval(() => {
				const now = Date.now();
				const remaining = Math.max(0, endTime - now);
				progress = (remaining / duration) * 100;

				if (remaining <= 0) {
					clearInterval(progressInterval);
				}
			}, 10);
		}
	}

	function close() {
		visible = false;
		clearTimeout(timer);
		clearInterval(progressInterval);
		setTimeout(() => {
			onClose();
		}, 300);
	}

	function getIcon() {
		switch (type) {
			case 'success':
				return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>`;
			case 'error':
				return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>`;
			case 'warning':
				return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
				</svg>`;
			case 'info':
				return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>`;
			default:
				return '';
		}
	}

	function getStyles() {
		switch (type) {
			case 'success':
				return {
					bg: 'bg-green-50 border-green-200',
					icon: 'text-green-400',
					text: 'text-green-800',
					progress: 'bg-green-500'
				};
			case 'error':
				return {
					bg: 'bg-red-50 border-red-200',
					icon: 'text-red-400',
					text: 'text-red-800',
					progress: 'bg-red-500'
				};
			case 'warning':
				return {
					bg: 'bg-yellow-50 border-yellow-200',
					icon: 'text-yellow-400',
					text: 'text-yellow-800',
					progress: 'bg-yellow-500'
				};
			case 'info':
				return {
					bg: 'bg-blue-50 border-blue-200',
					icon: 'text-blue-400',
					text: 'text-blue-800',
					progress: 'bg-blue-500'
				};
			default:
				return {
					bg: 'bg-gray-50 border-gray-200',
					icon: 'text-gray-400',
					text: 'text-gray-800',
					progress: 'bg-gray-500'
				};
		}
	}

	$effect(() => {
		startTimer();
		
		return () => {
			clearTimeout(timer);
			clearInterval(progressInterval);
		};
	});
</script>

{#if visible}
	<div
		class="fixed top-4 right-4 z-50 max-w-sm w-full"
		in:fly={{ y: -50, duration: 300, easing: quintOut }}
		out:fade={{ duration: 200 }}
	>
		<div class="relative overflow-hidden rounded-lg border shadow-lg {getStyles().bg}">
			<!-- Progress bar -->
			<div class="absolute bottom-0 left-0 h-1 {getStyles().progress} transition-all duration-100 ease-linear" style="width: {progress}%"></div>
			
			<div class="flex items-start p-4">
				<!-- Icon -->
				<div class="flex-shrink-0 {getStyles().icon}">
					{@html getIcon()}
				</div>
				
				<!-- Message -->
				<div class="ml-3 flex-1">
					<p class="text-sm font-medium {getStyles().text}">
						{message}
					</p>
				</div>
				
				<!-- Close button -->
				<div class="ml-4 flex flex-shrink-0">
					<button
						type="button"
						class="inline-flex rounded-md {getStyles().text} hover:bg-opacity-20 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
						onclick={close}
					>
						<span class="sr-only">Cerrar</span>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
