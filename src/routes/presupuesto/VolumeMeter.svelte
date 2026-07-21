<script lang="ts">
	type Props = { stream: MediaStream | null; isPaused?: boolean };
	let { stream = $bindable(null), isPaused = false }: Props = $props();

	let volume = $state(0);

	$effect(() => {
		if (!stream) {
			volume = 0;
			return;
		}

		const audioContext = new AudioContext();
		const source = audioContext.createMediaStreamSource(stream);
		const analyser = audioContext.createAnalyser();

		analyser.fftSize = 128;
		source.connect(analyser);

		const bufferLength = analyser.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);
		let animationFrameId: number;

		function updateVolume() {
			analyser.getByteFrequencyData(dataArray);

			let sum = 0;
			for (let i = 0; i < bufferLength; i++) {
				sum += dataArray[i];
			}

			const average = sum / bufferLength;

			volume = isPaused ? 0 : Math.min(100, Math.round((average / 128) * 100));

			animationFrameId = requestAnimationFrame(updateVolume);
		}

		updateVolume();

		return () => {
			cancelAnimationFrame(animationFrameId);
			analyser.disconnect();
			source.disconnect();
			if (audioContext.state !== 'closed') {
				audioContext.close();
			}
		};
	});
</script>

<div class="meter-wrapper">
	<div
		class="meter-fill"
		style:transform={`scaleY(${volume / 100})`}
		style:opacity={0.3 + (volume / 100) * 0.7}
	></div>
</div>

<style>
	.meter-wrapper {
		width: 8px;
		height: 32px;
		background: #e2e8f0;
		border-radius: 9999px;
		overflow: hidden;
	}

	.meter-fill {
		height: 100%;
		width: 100%;
		background: #10b981;
		transform-origin: left bottom;
		transition: transform 0.05s ease-out;
	}
</style>
