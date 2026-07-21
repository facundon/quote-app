/**
 * Default grader: precision/recall/F1 over study identity, matching the
 * app's own tolerance for "is this the same study name" (exact, then
 * substring) rather than a stricter comparison.
 */

import type { ExtractedStudy } from '../../../src/lib/server/chat/agents/types';
import type { ExpectedStudy, Grader, GradeResult } from './index';

function normalize(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // strip accents
		.toLowerCase()
		.trim();
}

function isMatch(expectedName: string, actualName: string): boolean {
	const a = normalize(expectedName);
	const b = normalize(actualName);
	return a === b || a.includes(b) || b.includes(a);
}

interface Mismatch {
	type: 'missing' | 'unexpected' | 'quantity';
	expected?: string;
	actual?: string;
	expectedQuantity?: number;
	actualQuantity?: number;
}

function gradeStudyMatch(expected: ExpectedStudy[], actual: ExtractedStudy[]): GradeResult {
	const remainingActual = [...actual];
	const mismatches: Mismatch[] = [];
	let truePositives = 0;
	let quantityMismatches = 0;

	for (const exp of expected) {
		const matchIndex = remainingActual.findIndex((act) => isMatch(exp.name, act.name));
		if (matchIndex === -1) {
			mismatches.push({ type: 'missing', expected: exp.name });
			continue;
		}

		const [match] = remainingActual.splice(matchIndex, 1);
		truePositives++;

		if (match.quantity !== exp.quantity) {
			quantityMismatches++;
			mismatches.push({
				type: 'quantity',
				expected: exp.name,
				expectedQuantity: exp.quantity,
				actualQuantity: match.quantity
			});
		}
	}

	for (const leftover of remainingActual) {
		mismatches.push({ type: 'unexpected', actual: leftover.name });
	}

	const precision = actual.length === 0 ? 1 : truePositives / actual.length;
	const recall = expected.length === 0 ? 1 : truePositives / expected.length;
	const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

	const confidenceCounts = actual.reduce<Record<string, number>>((counts, study) => {
		const key = study.extractionConfidence ?? 'unknown';
		counts[key] = (counts[key] ?? 0) + 1;
		return counts;
	}, {});

	return {
		score: f1,
		details: {
			precision,
			recall,
			truePositives,
			quantityMismatches,
			mismatches,
			confidenceCounts
		}
	};
}

export const studyMatchGrader: Grader = {
	name: 'studyMatch',
	grade: gradeStudyMatch
};
