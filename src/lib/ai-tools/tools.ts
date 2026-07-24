import { getCategories } from '$lib/queries/category';
import { Type, type FunctionDeclaration } from '@google/genai';
import { defineTool, type ToolContext } from './types';
import { createStudy } from '$lib/mutations/study';
import { formatCatalogByCategory, type CatalogStudy } from '$lib/server/chat/workflow/catalog';

function assertCreateStudyArgs(args: unknown): asserts args is { name: string; category_id: number } {
	const candidate = args as { name?: unknown; category_id?: unknown } | null;
	if (typeof candidate?.name !== 'string' || typeof candidate?.category_id !== 'number') {
		throw new Error('create_study tool called with invalid arguments');
	}
}

function assertCatalogContext(
	context: ToolContext | undefined
): asserts context is { catalog: CatalogStudy[] } {
	if (!Array.isArray(context?.catalog)) {
		throw new Error('get_catalog tool requires a context with a catalog array');
	}
}

const listCategoriesToolSchema = {
	name: 'list_categories',
	description:
		'Tool to list all the categories within the system. The categories have studies linked to them. Use it to gather information about the existent categories, such as their names and ids',
	parameters: {},
	response: {
		type: Type.ARRAY,
		properties: {
			name: {
				type: Type.STRING,
				description: 'Name of the category.'
			},
			id: {
				type: Type.NUMBER,
				description: 'Database ID (PK) of the category.'
			}
		}
	}
} as const satisfies FunctionDeclaration;

export const listCategoriesTool = defineTool({
	name: listCategoriesToolSchema.name,
	schema: listCategoriesToolSchema,
	execute: getCategories
});

const createStudyToolSchema = {
	name: 'create_study',
	description:
		'Tool to create a study in the catalog that does not exist, assigned to a specific category. Use it when the user wants to create a new study',
	parameters: {
		type: Type.OBJECT,
		properties: {
			name: {
				type: Type.STRING,
				description: 'Name of the study'
			},
			category_id: {
				type: Type.NUMBER,
				description:
					'Category ID from where the study will belongThe unique database ID of the category. Do NOT guess this ID; look it up using list_categories if only given a category name.'
			}
		},
		required: ['name', 'category_id']
	}
} as const satisfies FunctionDeclaration;

export const createStudyTool = defineTool({
	name: createStudyToolSchema.name,
	schema: createStudyToolSchema,
	execute: (args: unknown) => {
		assertCreateStudyArgs(args);
		return createStudy(args.name, args.category_id);
	}
});

/** Tool the model can call to fetch the full study catalog on demand. */
const getCatalogDeclarationSchema = {
	name: 'get_catalog',
	description:
		'Returns the full lab study catalog, grouped by category, with prices. Call this before proposing any mapping.',
	parameters: {
		type: Type.OBJECT,
		properties: {},
		required: []
	}
} as const satisfies FunctionDeclaration;

export const getCatalogDeclarationTool = defineTool({
	name: getCatalogDeclarationSchema.name,
	schema: getCatalogDeclarationSchema,
	execute: async (_args, context) => {
		assertCatalogContext(context);
		return formatCatalogByCategory(context.catalog);
	}
});
