<script lang="ts">
	import '../app.css';
	import SideNav from '$lib/components/SideNav.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen bg-gray-50">
	<SideNav />
	<main class="ml-64 flex-1 p-8">
		<UpdateBanner />
		{@render children()}
	</main>
</div>

<!-- Toast Container -->
<ToastContainer />
