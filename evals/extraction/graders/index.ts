/**
 * Grader registry for the extraction eval harness.
 * Add a new grader by implementing `Grader` and listing it here —
 * run.ts doesn't need to change.
 */

import type { ExtractedStudy } from '../../../src/lib/server/chat/agents/types';
import { studyMatchGrader } from './studyMatch';

export interface ExpectedStudy {
	name: string;
	quantity: number;
}

export interface GradeResult {
	score: number; // 0-1
	details: Record<string, unknown>;
}

export interface Grader {
	name: string;
	grade(expected: ExpectedStudy[], actual: ExtractedStudy[]): GradeResult;
}

export const graders: Grader[] = [studyMatchGrader];
