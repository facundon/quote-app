<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const navItems = [
		{
			label: 'Presupuestador',
			href: '/presupuesto',
			icon: '📊'
		},
		{
			label: 'Facturas',
			href: '/invoices',
			icon: '📄'
		}
	];

	const adminItem = {
		label: 'Configuración',
		href: '/admin',
		icon: '⚙️'
	};

	function isActive(href: string): boolean {
		return page.url.pathname === href;
	}

	function handleNavClick(href: string) {
		goto(href);
	}
</script>

<nav class="fixed top-0 left-0 h-full w-64 bg-white shadow-lg">
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="border-b border-gray-200 p-6">
			<h1 class="text-xl font-bold text-blue-900">Laboratorio Yunes</h1>
		</div>

		<!-- Navigation Items -->
		<div class="flex-1 p-4">
			<ul class="space-y-2">
				{#each navItems as item}
					<li>
						<button
							class="flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors duration-200 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							class:bg-blue-100={isActive(item.href)}
							class:text-blue-900={isActive(item.href)}
							class:text-gray-700={!isActive(item.href)}
							onclick={() => handleNavClick(item.href)}
						>
							<span class="mr-3 text-lg">{item.icon}</span>
							<span class="font-medium">{item.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>

		<!-- Admin Section -->
		<div class="border-t border-gray-200 p-4">
			<button
				class="flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors duration-200 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none"
				class:bg-red-100={isActive(adminItem.href)}
				class:text-red-900={isActive(adminItem.href)}
				class:text-gray-700={!isActive(adminItem.href)}
				onclick={() => handleNavClick(adminItem.href)}
			>
				<span class="mr-3 text-lg">{adminItem.icon}</span>
				<span class="font-medium">{adminItem.label}</span>
			</button>
		</div>
	</div>
</nav>
