import { describe, expect, it } from '@jest/globals'
import type { LLMClient, ReviewFinding } from '../src/llm/reviewer.ts'

const { reviewAnnotatedPatch } = await import('../src/llm/reviewer.ts')

class FakeLLM implements LLMClient {
  public lastSystemPrompt = ''
  public lastUserPrompt = ''
  private readonly cannedResponse: string

  constructor(response: ReviewFinding[] | string) {
    this.cannedResponse =
      typeof response === 'string' ? response : JSON.stringify(response)
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    this.lastSystemPrompt = systemPrompt
    this.lastUserPrompt = userPrompt
    return this.cannedResponse
  }
}

describe('reviewer.ts', () => {
  it('returns parsed findings for valid annotated lines', async () => {
    const annotatedPatch = [
      '@@ -10,4 +10,7 @@',
      '10 | export async function getUserSession(token: string) {',
      '11 |   if (!token) return null;',
      '12 | +  const payload = JSON.parse(atob(token.split(".")[1]));',
      '13 | +  if (payload.exp > Date.now()) {',
      '14 | +    return null;',
      '15 | +  }',
      '16 |   return payload;',
      '17 | }'
    ].join('\n')

    const expectedFinding: ReviewFinding = {
      path: 'src/auth/session.ts',
      line: 13,
      severity: 'high',
      message:
        'Inverted expiration check rejects valid tokens and accepts expired ones.',
      confidence: 0.95
    }

    const fakeLLM = new FakeLLM([expectedFinding])

    const findings = await reviewAnnotatedPatch(
      { path: 'src/auth/session.ts', annotatedPatch },
      fakeLLM
    )

    expect(findings).toEqual([expectedFinding])
    expect(fakeLLM.lastUserPrompt).toContain('FILE_PATH: src/auth/session.ts')
    expect(fakeLLM.lastUserPrompt).toContain(
      '13 | +  if (payload.exp > Date.now()) {'
    )
  })

  it('filters out hallucinated line numbers or deleted-line references', async () => {
    const annotatedPatch = [
      '@@ -1,2 +1,2 @@',
      ' | -const limit = 10;',
      '1 | +const limit = 0;',
      '2 | export function getLimit() { return limit; }'
    ].join('\n')

    const fakeLLM = new FakeLLM([
      {
        path: 'src/config.ts',
        line: 99, // Not in annotatedPatch
        severity: 'medium',
        message: 'Hallucinated line number',
        confidence: 0.8
      },
      {
        path: 'src/config.ts',
        line: 1, // Real line in annotatedPatch
        severity: 'medium',
        message: 'Setting limit to 0 disables pagination unexpectedly.',
        confidence: 0.88
      }
    ])

    const findings = await reviewAnnotatedPatch(
      { path: 'src/config.ts', annotatedPatch },
      fakeLLM
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]?.line).toBe(1)
  })

  it('skips LLM call and returns empty array for deleted-only files', async () => {
    const deletedOnlyPatch = [
      '@@ -1,2 +0,0 @@',
      ' | -const oldFlag = true;',
      ' | -console.log(oldFlag);'
    ].join('\n')

    const fakeLLM = new FakeLLM('INVALID_JSON_SHOULD_NOT_BE_CALLED')

    const findings = await reviewAnnotatedPatch(
      { path: 'src/removed.ts', annotatedPatch: deletedOnlyPatch },
      fakeLLM
    )

    expect(findings).toEqual([])
    expect(fakeLLM.lastUserPrompt).toBe('')
  })

  it('handles markdown-fenced JSON responses cleanly', async () => {
    const annotatedPatch = [
      '@@ -5,2 +5,3 @@',
      '5 | function divide(a: number, b: number) {',
      '6 | +  return a / b;',
      '7 | }'
    ].join('\n')

    const fencedPayload = [
      '```json',
      JSON.stringify([
        {
          path: 'src/math.ts',
          line: 6,
          severity: 'medium',
          message: 'Missing zero-divisor check when b is 0.',
          confidence: 0.91
        }
      ]),
      '```'
    ].join('\n')

    const fakeLLM = new FakeLLM(fencedPayload)

    const findings = await reviewAnnotatedPatch(
      { path: 'src/math.ts', annotatedPatch },
      fakeLLM
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]?.line).toBe(6)
  })

  it('throws a clear error when the LLM returns malformed JSON', async () => {
    const annotatedPatch = '@@ -1,1 +1,1 @@\n1 | +const x = 1;'
    const fakeLLM = new FakeLLM('Sorry, I cannot review this diff.')

    await expect(
      reviewAnnotatedPatch({ path: 'src/index.ts', annotatedPatch }, fakeLLM)
    ).rejects.toThrow(/Failed to parse LLM review response as JSON/)
  })
})
