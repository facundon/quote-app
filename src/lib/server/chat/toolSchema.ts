/**
 * Provider-agnostic tool definitions using JSON Schema format.
 * Each LLM provider adapter converts these to their native format.
 */

export interface ToolParameter {
	type: 'string' | 'number' | 'boolean' | 'object' | 'array';
	description?: string;
	items?: ToolParameter;
	properties?: Record<string, ToolParameter>;
	required?: string[];
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, ToolParameter>;
		required?: string[];
	};
}

export const tools: ToolDefinition[] = [
	{
		name: 'search_studies',
		description:
			'Search for medical studies/tests by name. Returns matching studies with their category and unit price. Useful for finding studies mentioned in WhatsApp messages.',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The search query to match against study names (supports partial matching)'
				},
				limit: {
					type: 'number',
					description: 'Maximum number of results to return (default: 20)'
				}
			},
			required: ['query']
		}
	},
	{
		name: 'list_categories',
		description:
			'List all available study categories with their unit prices. Categories group related medical studies together and determine pricing.',
		parameters: {
			type: 'object',
			properties: {}
		}
	},
	{
		name: 'calculate_quote',
		description:
			'Calculate a quote for medical studies. Provide either study names or category names with quantities. Returns itemized breakdown with discounts applied based on total quantity. The final total is rounded down to the nearest 1000.',
		parameters: {
			type: 'object',
			properties: {
				items: {
					type: 'array',
					description: 'List of items to quote',
					items: {
						type: 'object',
						properties: {
							study_name: {
								type: 'string',
								description: 'Name of the study (use search_studies to find exact names)'
							},
							category_name: {
								type: 'string',
								description: 'Name of the category (alternative to study_name)'
							},
							quantity: {
								type: 'number',
								description: 'Number of studies/tests'
							}
						},
						required: ['quantity']
					}
				}
			},
			required: ['items']
		}
	}
];
