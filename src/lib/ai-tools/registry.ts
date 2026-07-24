import {
	createStudyTool,
	getCatalogDeclarationTool,
	listCategoriesTool
} from '$lib/ai-tools/tools';
import type { AppTool, ToolContext } from '$lib/ai-tools/types';
import type { FunctionCall } from '@google/genai';

const toolNames = [
	listCategoriesTool.name,
	createStudyTool.name,
	getCatalogDeclarationTool.name
] as const;
type ToolName = (typeof toolNames)[number];

const toolRegistry = new Map<string, AppTool<any, any>>([
	[listCategoriesTool.name, listCategoriesTool],
	[createStudyTool.name, createStudyTool],
	[getCatalogDeclarationTool.name, getCatalogDeclarationTool]
]);

/** Extract all schemas for passing into client.interactions.create */
export function getRegisteredToolSchemas(includes: readonly ToolName[] = toolNames) {
	return Array.from(toolRegistry.values())
		.filter((tool) => includes?.includes(tool.name as ToolName))
		.map((tool) => ({
			type: 'function' as const,
			name: tool.schema.name,
			description: tool.schema.description,
			parameters: tool.schema.parameters
		}));
}

/** Resolves and executes a tool call requested by Gemini */
export async function resolveToolUsage(tool: FunctionCall, context?: ToolContext) {
	const name = tool.name || '';
	const currentTool = toolRegistry.get(name);
	if (!currentTool) {
		throw new Error(`Tool "${name}" was requested by model, but not found in registry.`);
	}

	console.log(`[Tool Runner] Executing: ${name}`);
	console.dir(tool, { depth: 4 });
	return currentTool.execute(tool.args, context);
}
