<script lang="ts">
	import { login } from '$lib/stores/auth';

	let password = $state('');
	let errorMessage = $state('');

	function handleLogin() {
		if (login(password)) {
			password = '';
			errorMessage = '';
		} else {
			errorMessage = 'Contraseña incorrecta';
			password = '';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleLogin();
		}
	}
</script>

<div class="mx-auto max-w-md">
	<div class="rounded-xl bg-white p-8 shadow-lg">
		<div class="mb-6 text-center">
			<div class="mb-4 text-4xl">🔒</div>
			<h1 class="text-2xl font-bold text-blue-900">Acceso Administrativo</h1>
			<p class="mt-2 text-gray-600">Ingresa la contraseña para continuar</p>
		</div>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleLogin();
			}}
			class="space-y-4"
		>
			<div>
				<label for="password" class="mb-2 block text-sm font-medium text-gray-700">
					Contraseña
				</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					onkeydown={handleKeydown}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					placeholder="Ingresa la contraseña"
					autocomplete="current-password"
				/>
			</div>

			{#if errorMessage}
				<div class="text-center text-sm text-red-600">{errorMessage}</div>
			{/if}

			<button
				type="submit"
				class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			>
				Ingresar
			</button>
		</form>
	</div>
</div>
