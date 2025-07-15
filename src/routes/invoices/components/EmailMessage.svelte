<script lang="ts">
	let { message }: { message: { type: 'success' | 'error'; text: string } | null } = $props();
</script>

{#if message}
	<div
		class="border-b border-gray-200 px-6 py-3 {message.type === 'success'
			? 'bg-green-50'
			: 'bg-red-50'}"
	>
		<div class="flex items-center">
			{#if message.type === 'success'}
				<svg
					class="mr-2 h-5 w-5 text-green-600"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			{:else}
				<svg
					class="mr-2 h-5 w-5 text-red-600"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			{/if}
			<span
				class="text-sm font-medium {message.type === 'success' ? 'text-green-800' : 'text-red-800'}"
			>
				{message.text}
			</span>
		</div>
	</div>
{/if}
