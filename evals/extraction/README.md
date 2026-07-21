# Extraction eval harness

Runs `ExtractionAgent` (`src/lib/server/chat/agents/extraction.ts` — the stage
that reads a text message or a photo of a medical order/receipt and pulls out
study names/quantities) against a fixture set and scores the output. Use it
to check whether a prompt change (`src/lib/server/chat/prompts/extraction.ts`)
improved or regressed extraction quality, without manually testing through
the chat UI each time.

## Run it

```bash
npm run eval:extraction
```

Requires `GEMINI_API_KEY` in `.env` at the project root (same one the app
uses).

Flags:

- `--filter=<substring>` — only run cases whose `id` contains this string
- `--verbose` — print raw agent output and full grader details per case
- `--json` — machine-readable report (useful for diffing runs or logging to a file)
- `--min-score=<0-1>` — pass/fail threshold, default `0.8`

```bash
npm run eval:extraction -- --filter=abbreviations --verbose
npm run eval:extraction -- --json > eval-results.json
```

## Reading the output

Each case prints one line with score, token usage, and latency:

```
✓ typed-list-basic — score 1.00 — 842 in / 156 out / 998 total | 1240ms (Clearly typed list, no ambiguity)
    input: text | studies: 3
✗ misspelled-name-not-corrected — score 0.67 — 710 in / 98 out / 808 total | 980ms (Prompt says not to correct spelling...)
    input: text | studies: 2
    [studyMatch] mismatches: [ { type: 'unexpected', actual: 'glucemia' } ]
```

Per-case metadata includes:

- **tokens** — `in` (prompt), `out` (completion), `total`; `cached` appears when Gemini serves cached prompt tokens
- **latency** — wall-clock time for the API call
- **input** — `text`, `image`, or `text+image`
- **studies** — count extracted
- **confidence** — breakdown of `high` / `medium` / `low` extraction confidence (shown when any study is not `high`)
- **finishReason** — only printed when not the normal `STOP` (e.g. safety blocks)

The score is the mean across all active graders (today just `studyMatch`,
an F1 score over study identity). A `mismatches` list shows exactly what
went wrong: `missing` (expected study not found), `unexpected` (extracted
something not expected), `quantity` (matched but wrong quantity).

The summary block aggregates across all cases:

```
OVERALL: 0.87 (11/12 cases >= 0.8)
TOKENS:  12450 in / 1890 out / 14340 total
LATENCY: avg 1120ms | p50 980ms | p95 2100ms | total 13440ms
MODEL:   gemini-3.5-flash
```

With `--json`, the same data is emitted as structured JSON with a `summary`
and per-case `usage` / `meta` / `graders` fields — handy for comparing two
prompt versions side by side.

Exit code is non-zero when `OVERALL` is below `--min-score` — usable in a
pre-commit hook or CI if that's ever wanted.

## Adding a text case

Edit `fixtures/cases.json`:

```jsonc
{
	"id": "some-short-id",
	"description": "What this case is testing for",
	"input": { "text": "..." },
	"expected": [{ "name": "...", "quantity": 1 }]
}
```

`expected` names are matched against extracted names case-insensitively,
accent-insensitively, and via substring — same tolerance the real catalog
matching stage gets, not stricter.

## Adding an image case

1. Drop the image file into `fixtures/images/`. **Redact or avoid real
   patient data (name, DNI, etc.) before adding — this folder is gitignored
   but treat it as sensitive.**
2. Add a case entry pointing at it:

```jsonc
{
	"id": "handwritten-order-01",
	"description": "Photo of handwritten order, medium quality",
	"input": { "imagePath": "images/handwritten-order-01.jpg", "imageType": "image/jpeg" },
	"expected": [{ "name": "TSH", "quantity": 1 }]
}
```

## Adding a grader

Implement the `Grader` interface (`graders/index.ts`):

```ts
export const myGrader: Grader = {
  name: 'myGrader',
  grade(expected, actual) {
    return { score: /* 0-1 */, details: { /* whatever helps debugging */ } };
  }
};
```

Add it to the `graders` array in `graders/index.ts`. `run.ts` doesn't need
any changes — every case runs through every registered grader, and the
per-case score becomes the mean across all of them.
