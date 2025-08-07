<script lang="ts">
	import { onMount, tick } from 'svelte';

	type MenuOption = {
		label: string;
		icon?: string;
		color?: string;
		callback: () => void;
	};

	let { open = false, options = [] as MenuOption[] } = $props();

	let menuButton: HTMLButtonElement | null = null;
	let menuPanel: HTMLDivElement | null = $state(null);
	let menuItems: HTMLButtonElement[] = [];
	let portalContainer = $state<HTMLDivElement | null>(null);

	let isOpen = $state(open);
	let menuPosition = $state({ top: 0, left: 0 });

	function openMenu() {
		isOpen = true;
	}

	function closeMenu() {
		isOpen = false;
		menuButton?.focus();
	}

	function toggleMenu() {
		isOpen ? closeMenu() : openMenu();
	}

	function updateMenuPosition() {
		if (!menuButton || !menuPanel) return;

		const rect = menuButton.getBoundingClientRect();
		const menuHeight = menuPanel.offsetHeight;
		const menuWidth = menuPanel.offsetWidth;
		const windowHeight = window.innerHeight;
		const windowWidth = window.innerWidth;

		// Calculate available space
		const spaceBelow = windowHeight - rect.bottom;
		const spaceAbove = rect.top;

		// Determine if menu should go up or down
		const shouldGoUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

		// Calculate vertical position
		let top: number;
		if (shouldGoUp) {
			top = rect.top - menuHeight;
		} else {
			top = rect.bottom;
		}

		// Calculate horizontal position - align to button
		let left: number;
		if (rect.left + menuWidth <= windowWidth) {
			// Enough space on the right, align to left edge of button
			left = rect.left;
		} else {
			// Not enough space, align to right edge of button
			left = rect.right - menuWidth;
		}

		// Ensure menu doesn't go outside viewport
		left = Math.max(0, Math.min(left, windowWidth - menuWidth));
		top = Math.max(0, Math.min(top, windowHeight - menuHeight));

		menuPosition = { top, left };
	}

	function handleTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openMenu();
		}
	}

	function handleMenuKeydown(e: KeyboardEvent) {
		const idx = menuItems.findIndex((el) => el === document.activeElement);
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			menuItems[(idx + 1) % menuItems.length]?.focus();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			menuItems[(idx - 1 + menuItems.length) % menuItems.length]?.focus();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			closeMenu();
		} else if (e.key === 'Tab') {
			closeMenu();
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (
			isOpen &&
			!menuPanel?.contains(e.target as Node) &&
			!menuButton?.contains(e.target as Node)
		) {
			closeMenu();
		}
	}

	function handleOptionClick(option: MenuOption) {
		option.callback();
		closeMenu();
	}

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		window.addEventListener('resize', updateMenuPosition);
		window.addEventListener('scroll', updateMenuPosition);

		// Create portal container
		portalContainer = document.createElement('div');
		portalContainer.id = 'menu-portal';
		portalContainer.style.position = 'fixed';
		portalContainer.style.top = '0';
		portalContainer.style.left = '0';
		portalContainer.style.width = '100%';
		portalContainer.style.height = '100%';
		portalContainer.style.pointerEvents = 'none';
		portalContainer.style.zIndex = '9999';
		document.body.appendChild(portalContainer);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			window.removeEventListener('resize', updateMenuPosition);
			window.removeEventListener('scroll', updateMenuPosition);
			if (portalContainer && document.body.contains(portalContainer)) {
				document.body.removeChild(portalContainer);
			}
		};
	});

	$effect(() => {
		if (isOpen && menuPanel) {
			// Update position after menu is rendered
			tick().then(() => {
				updateMenuPosition();
				// Focus first item after position is set
				tick().then(() => {
					menuItems = Array.from(
						menuPanel?.querySelectorAll('button, [tabindex]:not([tabindex="-1"])') ?? []
					);
					menuItems[0]?.focus();
				});
			});
		}
	});
</script>

<div class="relative inline-block text-left">
	<button
		bind:this={menuButton}
		type="button"
		class="flex h-8 w-8 items-center justify-center cursor-pointer rounded-full hover:bg-gray-100"
		aria-label="Acciones"
		aria-haspopup="menu"
		aria-expanded={isOpen}
		onclick={toggleMenu}
		onkeydown={handleTriggerKeydown}
	>
		<svg
			class="h-5 w-5 text-gray-600"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
			/>
		</svg>
	</button>
</div>

{#if isOpen && portalContainer}
	<div
		bind:this={menuPanel}
		id="menu-panel"
		class="fixed z-[9999] rounded-lg border border-gray-100 bg-white shadow-xl focus:outline-none min-w-[200px]"
		style="top: {menuPosition.top}px; left: {menuPosition.left}px; pointer-events: auto;"
		role="menu"
		tabindex="-1"
		onkeydown={handleMenuKeydown}
	>
		{#each options as option}
			<button
				type="button"
				class="flex w-full items-center px-4 py-3 text-sm transition-colors duration-150 hover:bg-gray-50 {option.color ||
					'text-gray-700'}"
				role="menuitem"
				onclick={() => handleOptionClick(option)}
			>
				{#if option.icon}
					<div class="mr-3 h-4 w-4 flex-shrink-0">{@html option.icon}</div>
				{/if}
				<span class="truncate">{option.label}</span>
			</button>
		{/each}
	</div>
{/if}
