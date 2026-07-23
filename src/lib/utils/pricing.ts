const FIXED_PRICE_REGEX = /\*\$?([\d.]+)\*/;

/** Split a catalog study name into its display label and a fixed price, if one is encoded (e.g. "Estudio X *40.000*"). */
export function splitFixedPrice(name: string): { label: string; price: string | null } {
	const match = name.match(FIXED_PRICE_REGEX);
	if (!match) return { label: name, price: null };
	return { label: name.replace(match[0], '').trim(), price: match[1] };
}
