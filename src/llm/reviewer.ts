export type ReviewSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ReviewFinding {
  path: string
  line: number
  severity: ReviewSeverity
  message: string
  confidence: number
}

export interface ReviewFileInput {
  path: string
  annotatedPatch: string
}

/**
 * Minimal contract for the LLM client being developed in parallel.
 * Adjust method signature if the merged LLM client exposes a different name.
 */
export interface LLMClient {
  complete(systemPrompt: string, userPrompt: string): Promise<string>
}

export const REVIEW_SYSTEM_PROMPT = `You are an automated code reviewer analyzing a git diff patch with annotated line numbers.

TASK:
Identify real bugs in the changed code:
1. Logic errors (wrong conditions, off-by-one errors, inverted booleans, broken state updates)
2. Missing error handling (unhandled rejections/exceptions, unchecked null/undefined, missing boundary checks)
3. Untested or unguarded edge cases in newly added logic

STRICT RULES:
- SKIP all style nitpicks, formatting, naming preferences, comments, or minor refactors.
- Only report issues on lines that have an integer line number before "|" in the annotated patch (e.g., "12 | +code" or "12 | code"). Never report issues on deleted lines (" | -code").
- Use the exact integer line number shown before "|" in the annotated patch.
- If there are no real bugs, return an empty JSON array: []
- Respond with ONLY valid JSON matching the schema below. No markdown fences or extra commentary.

OUTPUT SCHEMA:
[
  {
    "path": "string",
    "line": 1,
    "severity": "low | medium | high | critical",
    "message": "string",
    "confidence": 0.85
  }
]`

const VALID_SEVERITIES = new Set<ReviewSeverity>([
  'low',
  'medium',
  'high',
  'critical'
])

/**
 * Extracts valid integer line numbers present in an annotated patch
 * (lines formatted like `12 | +code` or `12 | code`).
 */
function extractValidLineNumbers(annotatedPatch: string): Set<number> {
  const validLines = new Set<number>()
  for (const rawLine of annotatedPatch.split('\n')) {
    const match = rawLine.match(/^(\d+)\s*\|/)
    if (match) {
      validLines.add(Number(match[1]))
    }
  }
  return validLines
}

/**
 * Strips optional ```json fences if a model wraps its JSON output.
 */
function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

function isValidFinding(
  item: unknown,
  expectedPath: string,
  validLines: Set<number>
): item is ReviewFinding {
  if (typeof item !== 'object' || item === null) return false

  const candidate = item as Record<string, unknown>
  return (
    typeof candidate.path === 'string' &&
    candidate.path === expectedPath &&
    typeof candidate.line === 'number' &&
    Number.isInteger(candidate.line) &&
    validLines.has(candidate.line) &&
    typeof candidate.severity === 'string' &&
    VALID_SEVERITIES.has(candidate.severity as ReviewSeverity) &&
    typeof candidate.message === 'string' &&
    candidate.message.trim().length > 0 &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1
  )
}

export async function reviewAnnotatedPatch(
  file: ReviewFileInput,
  llmClient: LLMClient
): Promise<ReviewFinding[]> {
  const validLines = extractValidLineNumbers(file.annotatedPatch)

  // Deleted-only patches have no numbered lines to annotate in the new file
  if (validLines.size === 0) {
    return []
  }

  const userPrompt = [
    `FILE_PATH: ${file.path}`,
    'ANNOTATED_PATCH:',
    file.annotatedPatch
  ].join('\n')

  const rawResponse = await llmClient.complete(REVIEW_SYSTEM_PROMPT, userPrompt)
  const cleaned = stripCodeFences(rawResponse)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (error) {
    throw new Error(
      `Failed to parse LLM review response as JSON for ${file.path}: ${(error as Error).message}`,
      { cause: error }
    )
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Expected JSON array from LLM review response for ${file.path}`
    )
  }

  return parsed.filter((item): item is ReviewFinding =>
    isValidFinding(item, file.path, validLines)
  )
}
