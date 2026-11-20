import { describe, expect, it } from '@jest/globals'
import {
  filterReviewFindings,
  type ReviewFinding
} from '../src/llm/filter_findings.js'

function makeFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    path: 'src/api/profile.ts',
    line: 22,
    severity: 'medium',
    message: 'Check res.ok before parsing JSON response.',
    confidence: 0.85,
    ...overrides
  }
}

describe('filterReviewFindings', () => {
  const validDiffLines = {
    'src/api/profile.ts': [20, 21, 22, 23, 24],
    'src/auth/session.ts': new Set([12, 13])
  }

  it('drops findings on files or lines outside the diff', () => {
    const findings: ReviewFinding[] = [
      makeFinding({ path: 'src/unknown/file.ts', line: 10 }),
      makeFinding({ path: 'src/api/profile.ts', line: 99 }),
      makeFinding({ path: 'src/api/profile.ts', line: 0 }),
      makeFinding({ path: 'src/api/profile.ts', line: 22 }),
      makeFinding({ path: './src/auth/session.ts', line: 13 })
    ]

    const result = filterReviewFindings(findings, { validDiffLines })

    expect(result).toHaveLength(2)
    expect(result.map((f) => `${f.path}:${f.line}`)).toEqual([
      'src/api/profile.ts:22',
      './src/auth/session.ts:13'
    ])
  })

  it('drops findings strictly below minConfidence and keeps exact threshold matches', () => {
    const findings: ReviewFinding[] = [
      makeFinding({ line: 20, confidence: 0.69 }),
      makeFinding({ line: 21, confidence: 0.7 }),
      makeFinding({ line: 22, confidence: 0.91 })
    ]

    const result = filterReviewFindings(findings, {
      validDiffLines,
      minConfidence: 0.7
    })

    expect(result).toHaveLength(2)
    expect(result.map((f) => f.line)).toEqual([22, 21])
  })

  it('drops repeated findings on the same file, line, and message while keeping the highest confidence', () => {
    const findings: ReviewFinding[] = [
      makeFinding({
        line: 22,
        message: 'Check res.ok before parsing JSON.',
        confidence: 0.78
      }),
      makeFinding({
        line: 22,
        message: '  check   res.ok before parsing json. ',
        confidence: 0.93
      }),
      makeFinding({
        line: 23,
        message: 'Guard res.json() against invalid JSON.',
        confidence: 0.85
      })
    ]

    const result = filterReviewFindings(findings, { validDiffLines })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ line: 22, confidence: 0.93 })
    expect(result[1]).toMatchObject({ line: 23, confidence: 0.85 })
  })

  it('sorts findings by severity (critical > high > medium > low) and uses confidence as tie-breaker', () => {
    const findings: ReviewFinding[] = [
      makeFinding({ line: 20, severity: 'low', confidence: 0.99 }),
      makeFinding({ line: 21, severity: 'medium', confidence: 0.8 }),
      makeFinding({ line: 22, severity: 'critical', confidence: 0.85 }),
      makeFinding({ line: 23, severity: 'high', confidence: 0.75 }),
      makeFinding({ line: 24, severity: 'high', confidence: 0.95 })
    ]

    const result = filterReviewFindings(findings, {
      validDiffLines,
      maxComments: 10
    })

    expect(
      result.map((f) => `${f.severity}:${f.line}:${f.confidence}`)
    ).toEqual([
      'critical:22:0.85',
      'high:24:0.95',
      'high:23:0.75',
      'medium:21:0.8',
      'low:20:0.99'
    ])
  })

  it('keeps at most maxComments after filtering and sorting', () => {
    const findings: ReviewFinding[] = [
      makeFinding({ line: 20, severity: 'low', confidence: 0.9 }),
      makeFinding({ line: 21, severity: 'medium', confidence: 0.9 }),
      makeFinding({ line: 22, severity: 'high', confidence: 0.9 }),
      makeFinding({ line: 23, severity: 'critical', confidence: 0.9 })
    ]

    const topTwo = filterReviewFindings(findings, {
      validDiffLines,
      maxComments: 2
    })
    expect(topTwo).toHaveLength(2)
    expect(topTwo.map((f) => f.severity)).toEqual(['critical', 'high'])

    const zeroCap = filterReviewFindings(findings, {
      validDiffLines,
      maxComments: 0
    })
    expect(zeroCap).toEqual([])
  })

  it('supports validDiffLines provided as a Map of file paths to line sets', () => {
    const mapDiffLines = new Map<string, Set<number>>([
      ['src/api/profile.ts', new Set([22, 24])],
      ['src/auth/session.ts', new Set([12])]
    ])

    const findings: ReviewFinding[] = [
      makeFinding({
        path: 'src/api/profile.ts',
        line: 22,
        severity: 'high',
        confidence: 0.9
      }),
      makeFinding({
        path: 'src/api/profile.ts',
        line: 23,
        severity: 'critical',
        confidence: 0.99
      }),
      makeFinding({
        path: 'src/auth/session.ts',
        line: 12,
        severity: 'medium',
        confidence: 0.85
      })
    ]

    const result = filterReviewFindings(findings, {
      validDiffLines: mapDiffLines
    })

    expect(result).toHaveLength(2)
    expect(result.map((f) => `${f.path}:${f.line}`)).toEqual([
      'src/api/profile.ts:22',
      'src/auth/session.ts:12'
    ])
  })
})
