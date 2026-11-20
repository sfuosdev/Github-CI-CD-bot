export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface ReviewFinding {
  path: string
  line: number
  severity: FindingSeverity
  message: string
  confidence: number
}

export type DiffLineMap =
  | ReadonlyMap<string, ReadonlySet<number>>
  | Readonly<Record<string, readonly number[] | ReadonlySet<number>>>

export interface FilterFindingsOptions {
  validDiffLines: DiffLineMap
  minConfidence?: number
  maxComments?: number
}

const DEFAULT_MIN_CONFIDENCE = 0.7
const DEFAULT_MAX_COMMENTS = 5

const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '')
}

function toNormalizedLineLookup(
  validDiffLines: DiffLineMap
): Map<string, ReadonlySet<number>> {
  const lookup = new Map<string, ReadonlySet<number>>()

  if (validDiffLines instanceof Map) {
    for (const [rawPath, lines] of validDiffLines.entries()) {
      lookup.set(
        normalizePath(rawPath),
        lines instanceof Set ? lines : new Set(lines)
      )
    }
    return lookup
  }

  for (const [rawPath, lines] of Object.entries(validDiffLines)) {
    lookup.set(
      normalizePath(rawPath),
      lines instanceof Set ? lines : new Set(lines)
    )
  }

  return lookup
}

function isLineInDiff(
  finding: ReviewFinding,
  lineLookup: ReadonlyMap<string, ReadonlySet<number>>
): boolean {
  if (!Number.isInteger(finding.line) || finding.line <= 0) {
    return false
  }

  const lines = lineLookup.get(normalizePath(finding.path))
  return lines !== undefined && lines.has(finding.line)
}

function normalizeMessageKey(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, ' ')
}

function buildDedupeKey(finding: ReviewFinding): string {
  return `${normalizePath(finding.path)}:${finding.line}:${normalizeMessageKey(finding.message)}`
}

function deduplicateFindings(
  findings: readonly ReviewFinding[]
): ReviewFinding[] {
  const bestByKey = new Map<string, ReviewFinding>()

  for (const finding of findings) {
    const key = buildDedupeKey(finding)
    const existing = bestByKey.get(key)

    if (!existing || finding.confidence > existing.confidence) {
      bestByKey.set(key, finding)
    }
  }

  return Array.from(bestByKey.values())
}

function compareBySeverityThenConfidence(
  a: ReviewFinding,
  b: ReviewFinding
): number {
  const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  if (severityDiff !== 0) {
    return severityDiff
  }

  return b.confidence - a.confidence
}

export function filterReviewFindings(
  findings: readonly ReviewFinding[],
  options: FilterFindingsOptions
): ReviewFinding[] {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE
  const maxComments = options.maxComments ?? DEFAULT_MAX_COMMENTS

  if (maxComments <= 0 || findings.length === 0) {
    return []
  }

  const lineLookup = toNormalizedLineLookup(options.validDiffLines)

  const inDiffAndConfident = findings.filter(
    (finding) =>
      isLineInDiff(finding, lineLookup) && finding.confidence >= minConfidence
  )

  const uniqueFindings = deduplicateFindings(inDiffAndConfident)

  return uniqueFindings
    .sort(compareBySeverityThenConfidence)
    .slice(0, maxComments)
}
