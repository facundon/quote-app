import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
	if (!client) {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
		client = new GoogleGenAI({ apiKey });
	}
	return client;
}
