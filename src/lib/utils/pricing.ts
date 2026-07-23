const FIXED_PRICE_REGEX = /\*\$?([\d.]+)\*/;
const BUNDLE_MULTIPLIER_REGEX = /\(x(\d+)\)/i;

/**
 * Split a catalog study name into its display label plus any encoded badges:
 * a fixed price (e.g. "Estudio X *40.000*") and/or a bundle multiplier (e.g. "Hepatograma (x4)").
 */
export function splitFixedPrice(name: string): {
	label: string;
	price: string | null;
	bundle: string | null;
} {
	const priceMatch = name.match(FIXED_PRICE_REGEX);
	const bundleMatch = name.match(BUNDLE_MULTIPLIER_REGEX);

	let label = name;
	if (priceMatch) label = label.replace(priceMatch[0], '');
	if (bundleMatch) label = label.replace(bundleMatch[0], '');

	return {
		label: label.trim(),
		price: priceMatch ? priceMatch[1] : null,
		bundle: bundleMatch ? bundleMatch[1] : null
	};
}
