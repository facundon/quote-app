/**
 * Live USD → ARS conversion using the dólar blue sell rate.
 * Fetches once per cache window; concurrent callers share the same in-flight request.
 */

const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4_000;

interface CachedRate {
	rate: number;
	source: string;
	fetchedAt: number;
}

let cache: CachedRate | null = null;
let inflight: Promise<number> | null = null;

async function fetchWithTimeout(url: string): Promise<Response> {
	return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function fetchFromBluelytics(): Promise<number> {
	const res = await fetchWithTimeout('https://api.bluelytics.com.ar/v2/latest');
	if (!res.ok) throw new Error(`Bluelytics HTTP ${res.status}`);

	const data = (await res.json()) as { blue?: { value_sell?: number } };
	const rate = data.blue?.value_sell;
	if (!rate || rate <= 0) throw new Error('Bluelytics: invalid blue sell rate');

	return rate;
}

async function fetchFromDolarApi(): Promise<number> {
	const res = await fetchWithTimeout('https://dolarapi.com/v1/dolares/blue');
	if (!res.ok) throw new Error(`DolarAPI HTTP ${res.status}`);

	const data = (await res.json()) as { venta?: number };
	const rate = data.venta;
	if (!rate || rate <= 0) throw new Error('DolarAPI: invalid blue sell rate');

	return rate;
}

async function fetchRate(): Promise<number> {
	const now = Date.now();
	const sources: Array<{ name: string; fetch: () => Promise<number> }> = [
		{ name: 'bluelytics', fetch: fetchFromBluelytics },
		{ name: 'dolarapi', fetch: fetchFromDolarApi }
	];

	for (const source of sources) {
		try {
			const rate = await source.fetch();
			cache = { rate, source: source.name, fetchedAt: now };
			return rate;
		} catch (err) {
			console.warn(`[exchange] ${source.name} failed:`, err);
		}
	}

	if (cache) {
		console.warn('[exchange] using stale cached rate');
		return cache.rate;
	}

	throw new Error('No se pudo obtener la cotización USD/ARS');
}

/** Dólar blue venta — USD cost × this rate ≈ ARS cost. */
export function getUsdToArsRate(): Promise<number> {
	const now = Date.now();
	if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
		return Promise.resolve(cache.rate);
	}

	if (!inflight) {
		inflight = fetchRate().finally(() => {
			inflight = null;
		});
	}

	return inflight;
}

export function convertUsdToArs(usd: number, rate: number): number {
	return usd * rate;
}
