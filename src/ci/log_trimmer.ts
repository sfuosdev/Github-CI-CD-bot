export type FailureCategory =
  | 'dependency'
  | 'build'
  | 'test'
  | 'lint'
  | 'timeout'
  | 'unknown'

export interface TrimResult {
  trimmed: string
  category: FailureCategory
}

const MAX_CHARS = 4000
const CONTEXT_BEFORE = 3
const CONTEXT_AFTER = 5

// finds color codes, then removes them since they are junk
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g
// GitHub Actions timestamps look like 2026-11-18T21:48:03.1234567Z
// finds timestamps then removes them
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z\s?/

// Lines that signal a real error.
const ERROR_LINE_RES: RegExp[] = [
  /\bError\b/,
  /\bFAIL\b/,
  /npm ERR!/,
  /error TS\d+/,
  /^\s+at\s.+\(.+:\d+:\d+\)/, // stack frame
  /##\[error\]/,
  /\bERR_[A-Z_]+\b/,
  /^\s*\d+:\d+\s+error\b/, // eslint: "  3:1  error  message  rule-name"
  /✖ \d+ problems?/, // eslint summary line
  /\bfailed\b/i,
  /timed out|ETIMEDOUT/i
]

// Order matters: first match wins. Most specific signals go first.
const CATEGORY_RULES: [FailureCategory, RegExp][] = [
  [
    'timeout',
    /(timed out|ETIMEDOUT|exceeded the maximum execution time|operation was canceled)/i
  ],
  [
    'build',
    /(error TS\d+|SyntaxError|Build failed|Module not found|tsc\b|webpack|vite.*error)/i
  ],
  [
    'dependency',
    /(npm ERR!|ERESOLVE|E404|ENOTFOUND|Cannot find module|Could not resolve dependency|yarn install|pnpm install|peer dep)/i
  ],
  ['lint', /(eslint|prettier|✖ \d+ problems?|\d+ errors?, \d+ warnings?)/i],

  [
    'test',
    /(\bFAIL\b|Tests?:\s+\d+ failed|AssertionError|expect\(|✕|\d+ failing)/
  ]
]

export function stripNoise(log: string): string {
  return log
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(ANSI_RE, '').replace(TIMESTAMP_RE, ''))
    .join('\n')
}

export function categorize(text: string): FailureCategory {
  for (const [category, re] of CATEGORY_RULES) {
    if (re.test(text)) return category
  }
  return 'unknown'
}

export function trimLog(
  rawLog: string,
  maxChars: number = MAX_CHARS
): TrimResult {
  const lines = stripNoise(rawLog)
    .split('\n')
    .map((line) => (line.length > 300 ? `${line.slice(0, 300)}...` : line))

  // Mark every line that is an error line or within the context window.
  const keep = new Array<boolean>(lines.length).fill(false)
  let firstError = -1
  lines.forEach((line, i) => {
    if (ERROR_LINE_RES.some((re) => re.test(line))) {
      if (firstError === -1) firstError = i
      const start = Math.max(0, i - CONTEXT_BEFORE)
      const end = Math.min(lines.length - 1, i + CONTEXT_AFTER)
      for (let j = start; j <= end; j++) keep[j] = true
    }
  })

  // No error lines found: fall back to the tail of the log.
  if (firstError === -1) {
    const tail = lines.slice(-30).join('\n').trim()
    return { trimmed: tail.slice(-maxChars), category: categorize(tail) }
  }

  // Build the output, marking gaps between kept chunks.
  const out: string[] = []
  let gap = false
  lines.forEach((line, i) => {
    if (keep[i]) {
      if (gap && out.length > 0) out.push('...')
      out.push(line)
      gap = false
    } else {
      gap = true
    }
  })

  let trimmed = out.join('\n').trim()

  // Cap the size. Errors near the end of a log (the final failure) usually matter
  // most, but the first error is often the root cause, so keep both ends.
  if (trimmed.length > maxChars) {
    const half = Math.floor((maxChars - 20) / 2)
    trimmed = `${trimmed.slice(0, half)}\n...[truncated]...\n${trimmed.slice(-half)}`
  }

  return { trimmed, category: categorize(trimmed) }
}
