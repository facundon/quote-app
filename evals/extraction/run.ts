/**
 * Eval harness for ExtractionAgent — run against fixtures/cases.json and
 * score the result with every grader in graders/index.ts.
 *
 * Usage: npm run eval:extraction -- [--filter=<id-substring>] [--verbose] [--json] [--min-score=0.8]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { graders, type ExpectedStudy } from './graders/index';
import {
	extractInputData,
	ExtractionMeta,
	ExtractionUsage
} from '../../src/lib/server/chat/workflow/extraction';
import { ExtractedStudy } from '../../src/lib/server/chat/workflow/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, '../../.env') });

interface CaseInput {
	text?: string;
	imagePath?: string;
	imageType?: string;
}

interface Case {
	id: string;
	description: string;
	input: CaseInput;
	expected: ExpectedStudy[];
}

interface Args {
	filter?: string;
	verbose: boolean;
	json: boolean;
	minScore: number;
}

function parseArgs(argv: string[]): Args {
	const args: Args = { verbose: false, json: false, minScore: 0.8 };
	for (const arg of argv) {
		if (arg === '--verbose') args.verbose = true;
		else if (arg === '--json') args.json = true;
		else if (arg.startsWith('--filter=')) args.filter = arg.slice('--filter='.length);
		else if (arg.startsWith('--min-score='))
			args.minScore = Number(arg.slice('--min-score='.length));
	}
	return args;
}

function loadCases(): Case[] {
	const raw = readFileSync(join(__dirname, 'fixtures/cases.json'), 'utf-8');
	return JSON.parse(raw) as Case[];
}

function loadImage(imagePath: string): string {
	const buffer = readFileSync(join(__dirname, 'fixtures', imagePath));
	return buffer.toString('base64');
}

const CONCURRENCY = 4;

async function runWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let cursor = 0;

	async function worker() {
		while (cursor < items.length) {
			const index = cursor++;
			results[index] = await fn(items[index]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

interface CaseRun {
	case: Case;
	actual: ExtractedStudy[] | null;
	error?: string;
	usage?: ExtractionUsage;
	meta?: ExtractionMeta;
	graded: Array<{ grader: string; score: number; details: Record<string, unknown> }>;
	caseScore: number;
}

async function runCase<T extends Function>(fn: T, testCase: Case): Promise<CaseRun> {
	const result = await fn({
		text: testCase.input.text,
		image: testCase.input.imagePath ? loadImage(testCase.input.imagePath) : undefined,
		imageType: testCase.input.imageType
	});

	const { usage, meta } = result;

	if (!result.success) {
		return {
			case: testCase,
			actual: null,
			error: result.error,
			usage,
			meta,
			graded: [],
			caseScore: 0
		};
	}

	const actual = result.data ?? [];
	const graded = graders.map((grader) => {
		const { score, details } = grader.grade(testCase.expected, actual);
		return { grader: grader.name, score, details };
	});
	const caseScore = graded.reduce((sum, g) => sum + g.score, 0) / (graded.length || 1);

	return { case: testCase, actual, usage, meta, graded, caseScore };
}

function formatTokens(usage?: ExtractionUsage): string {
	if (!usage) return 'tokens n/a';
	const parts = [`${usage.inputTokens} in`, `${usage.outputTokens} out`];
	if (usage.totalTokens > 0) parts.push(`${usage.totalTokens} total`);
	if (usage.cachedTokens) parts.push(`${usage.cachedTokens} cached`);
	return parts.join(' / ');
}

function formatConfidence(meta?: ExtractionMeta): string | null {
	if (!meta) return null;
	const { high, medium, low } = meta.confidenceBreakdown;
	if (medium === 0 && low === 0) return null;
	return `confidence: ${high} high, ${medium} medium, ${low} low`;
}

function percentile(values: number[], p: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

function sumUsage(runs: CaseRun[]): ExtractionUsage {
	return runs.reduce(
		(acc, run) => {
			if (!run.usage) return acc;
			return {
				inputTokens: acc.inputTokens + run.usage.inputTokens,
				outputTokens: acc.outputTokens + run.usage.outputTokens,
				totalTokens: acc.totalTokens + run.usage.totalTokens,
				cachedTokens: (acc.cachedTokens ?? 0) + (run.usage.cachedTokens ?? 0)
			};
		},
		{ inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0 }
	);
}

function buildReport(runs: CaseRun[], minScore: number) {
	const overall = runs.reduce((sum, r) => sum + r.caseScore, 0) / runs.length;
	const passed = runs.filter((r) => r.caseScore >= minScore).length;
	const latencies = runs.map((r) => r.meta?.durationMs ?? 0).filter((ms) => ms > 0);
	const totalUsage = sumUsage(runs);
	const model = runs.find((r) => r.meta?.model)?.meta?.model;

	return {
		summary: {
			overallScore: overall,
			passed,
			total: runs.length,
			minScore,
			model,
			tokens: totalUsage,
			latencyMs: {
				total: latencies.reduce((sum, ms) => sum + ms, 0),
				avg: latencies.length ? latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length : 0,
				p50: percentile(latencies, 50),
				p95: percentile(latencies, 95)
			}
		},
		cases: runs.map((run) => ({
			id: run.case.id,
			description: run.case.description,
			score: run.caseScore,
			passed: run.caseScore >= minScore,
			error: run.error,
			expectedCount: run.case.expected.length,
			actual: run.actual,
			usage: run.usage,
			meta: run.meta,
			graders: run.graded
		}))
	};
}

function printHumanReport(runs: CaseRun[], args: Args) {
	for (const run of runs) {
		if (run.error) {
			const latency = run.meta ? `${run.meta.durationMs}ms` : 'n/a';
			console.log(`✗ ${run.case.id} — ERROR: ${run.error}`);
			console.log(
				`    ${formatTokens(run.usage)} | ${latency} | input: ${run.meta?.inputKind ?? 'n/a'}`
			);
			if (run.meta?.finishReason) {
				console.log(`    finishReason: ${run.meta.finishReason}`);
			}
			continue;
		}

		const scoreStr = run.caseScore.toFixed(2);
		const marker = run.caseScore >= args.minScore ? '✓' : '✗';
		const latency = run.meta ? `${run.meta.durationMs}ms` : 'n/a';
		console.log(
			`${marker} ${run.case.id} — score ${scoreStr} — ${formatTokens(run.usage)} | ${latency} (${run.case.description})`
		);

		const metaParts: string[] = [];
		if (run.meta) {
			metaParts.push(`input: ${run.meta.inputKind}`);
			metaParts.push(`studies: ${run.meta.studyCount}`);
			if (run.meta.finishReason && run.meta.finishReason !== 'STOP') {
				metaParts.push(`finish: ${run.meta.finishReason}`);
			}
			const confidence = formatConfidence(run.meta);
			if (confidence) metaParts.push(confidence);
		}
		if (metaParts.length) {
			console.log(`    ${metaParts.join(' | ')}`);
		}

		for (const g of run.graded) {
			if (args.verbose) {
				console.log(`    [${g.grader}] ${g.score.toFixed(2)}`, g.details);
			} else if (g.score < 1) {
				const details = g.details as { mismatches?: unknown[] };
				if (details.mismatches?.length) {
					console.log(`    [${g.grader}] mismatches:`, details.mismatches);
				}
			}
		}

		if (args.verbose) {
			console.log('    actual:', run.actual);
		}
	}

	const report = buildReport(runs, args.minScore);
	const { summary } = report;

	console.log('');
	console.log(
		`OVERALL: ${summary.overallScore.toFixed(2)} (${summary.passed}/${summary.total} cases >= ${summary.minScore})`
	);
	console.log(
		`TOKENS:  ${summary.tokens.inputTokens} in / ${summary.tokens.outputTokens} out / ${summary.tokens.totalTokens} total` +
			(summary.tokens.cachedTokens ? ` (${summary.tokens.cachedTokens} cached)` : '')
	);
	console.log(
		`LATENCY: avg ${Math.round(summary.latencyMs.avg)}ms | p50 ${Math.round(summary.latencyMs.p50)}ms | p95 ${Math.round(summary.latencyMs.p95)}ms | total ${Math.round(summary.latencyMs.total)}ms`
	);
	if (summary.model) {
		console.log(`MODEL:   ${summary.model}`);
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.error('GEMINI_API_KEY not set (checked .env and process.env)');
		process.exit(1);
	}

	const allCases = loadCases();
	const cases = args.filter ? allCases.filter((c) => c.id.includes(args.filter!)) : allCases;

	if (cases.length === 0) {
		console.error(`No cases matched filter "${args.filter}"`);
		process.exit(1);
	}

	const runs = await runWithConcurrency(cases, CONCURRENCY, (c) => runCase(extractInputData, c));
	const report = buildReport(runs, args.minScore);

	if (args.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		printHumanReport(runs, args);
	}

	process.exit(report.summary.overallScore >= args.minScore ? 0 : 1);
}

main().catch((error) => {
	console.error('Eval harness crashed:', error);
	process.exit(1);
});
