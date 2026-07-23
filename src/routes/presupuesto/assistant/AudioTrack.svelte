<script lang="ts">
	const pattern = ['2/5', '3/5', 'full', '4/5', '2/5', '3/5'];
	const barHeights = Array.from({ length: 45 }, (_, i) => pattern[i % 5]);

	function formatAudioTime(value: number): string {
		if (isNaN(value) || !isFinite(value)) return '0:00';
		const minutes = Math.floor(value / 60);
		const seconds = Math.floor(value - minutes);
		return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
	}

	interface Props {
		audio: string;
		audioType: string | undefined;
	}

	let { audio, audioType }: Props = $props();
	let currentTime = $state(0);
	let isPaused = $state(true);
	let duration = $state(0);
	let audioElement = $state<HTMLAudioElement | null>(null);

	let progressRatio = $derived(duration > 0 ? currentTime / duration : 0);

	let completedCount = $derived(Math.floor(progressRatio * barHeights.length));
	let completedArray = $derived(barHeights.slice(0, completedCount));
	let uncompletedArray = $derived(barHeights.slice(completedCount));

	function handleSeek(event: MouseEvent) {
		if (!audioElement || !duration) return;

		const waveformContainer = event.currentTarget as HTMLDivElement;
		const rect = waveformContainer.getBoundingClientRect();

		const clickX = event.clientX - rect.left;
		const width = rect.width;

		const ratio = Math.max(0, Math.min(1, clickX / width));
		audioElement.currentTime = ratio * duration;
	}

	function onToggle() {
		isPaused = !isPaused;
	}
</script>

<div class="hidden h-2/5 h-3/5 h-4/5"></div>
{#snippet fullLine(height: string)}
	<span class="h-{height} w-2 rounded-full bg-indigo-400"></span>
{/snippet}
{#snippet emptyLine(height: string)}
	<span class="h-{height} w-2 rounded-full bg-slate-600 transition-colors group-hover:bg-slate-500"
	></span>
{/snippet}

<div class="flex max-w-sm items-center gap-3 rounded-2xl bg-slate-800 p-2 text-slate-100 shadow-md">
	<button
		class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition-colors hover:bg-indigo-600 focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-800 focus:outline-none"
		aria-label="Play voice note"
		onclick={onToggle}
	>
		{#if isPaused}
			<svg class="ml-0.5 h-5 w-5 fill-current" viewBox="0 0 24 24">
				<path d="M8 5v14l11-7z" />
			</svg>
		{:else}
			<svg class="h-5 w-5 fill-current" viewBox="0 0 24 24">
				<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
			</svg>
		{/if}
	</button>

	<!-- Waveform Visualizer & Progress -->
	<div class="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
		<div class="group relative flex h-6 cursor-pointer items-center gap-[3px]">
			<button
				type="button"
				onclick={handleSeek}
				class="group relative mt-4 flex h-7 w-full cursor-pointer items-center gap-[3px] focus:outline-none"
				aria-label="Seek audio position"
			>
				{#each completedArray as completed}
					{@render fullLine(completed)}
				{/each}
				{#each uncompletedArray as uncompleted}
					{@render emptyLine(uncompleted)}
				{/each}
			</button>
		</div>
		<div class="mt-1 flex items-center justify-between text-[10px] text-blue-100/80">
			<span>{formatAudioTime(currentTime)}</span>
			<span>{formatAudioTime(duration)}</span>
		</div>
	</div>
</div>
<audio
	bind:currentTime
	bind:paused={isPaused}
	bind:duration
	bind:this={audioElement}
	src="data:{audioType || 'audio/webm'};base64,{audio}"
	class="mb-2 h-8 max-w-full"
></audio>
