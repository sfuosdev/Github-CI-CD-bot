import * as core from '@actions/core'

export interface ActionConfig {
  githubToken: string
  ciResult: string
  summary: boolean
  review: boolean
  explainFailure: boolean
  maxComments: number
  minConfidence: number
  ignorePaths: string[]
  model: string
}

export function parseConfig(): ActionConfig {
  const ciResult = core.getInput('ci-result', { required: true })

  const summaryStr = core.getInput('summary') || 'true'
  if (summaryStr !== 'true' && summaryStr !== 'false') {
    throw new Error(
      `Invalid input for 'summary': "${summaryStr}". Must be 'true' or 'false'.`
    )
  }
  const summary = summaryStr === 'true'

  const reviewStr = core.getInput('review') || 'true'
  if (reviewStr !== 'true' && reviewStr !== 'false') {
    throw new Error(
      `Invalid input for 'review': "${reviewStr}". Must be 'true' or 'false'.`
    )
  }
  const review = reviewStr === 'true'

  const explainFailureStr = core.getInput('explain-failure') || 'true'
  if (explainFailureStr !== 'true' && explainFailureStr !== 'false') {
    throw new Error(
      `Invalid input for 'explain-failure': "${explainFailureStr}". Must be 'true' or 'false'.`
    )
  }
  const explainFailure = explainFailureStr === 'true'

  const maxCommentsStr = core.getInput('max-comments') || '5'
  const maxComments = parseInt(maxCommentsStr, 10)
  if (isNaN(maxComments)) {
    throw new Error(
      `Invalid input for 'max-comments': "${maxCommentsStr}". Must be a valid integer.`
    )
  }

  const minConfidenceStr = core.getInput('min-confidence') || '0.6'
  const minConfidence = parseFloat(minConfidenceStr)
  if (isNaN(minConfidence)) {
    throw new Error(
      `Invalid input for 'min-confidence': "${minConfidenceStr}". Must be a valid integer.`
    )
  }

  const ignorePathsStr =
    core.getInput('ignore-paths') || 'package-lock.json,dist/**'

  const ignorePaths = ignorePathsStr
    .split(',')
    .map((path) => path.trim())
    .filter((path) => path.length > 0)

  if (ignorePaths.length === 0) {
    throw new Error(
      `Invalid input for 'ignore-paths': "${ignorePathsStr}". Must contain atleast one valid path or pattern.`
    )
  }

  const model = core.getInput('model').trim()

  return {
    githubToken: core.getInput('github-token'),
    ciResult,
    summary,
    review,
    explainFailure,
    maxComments,
    minConfidence,
    ignorePaths,
    model
  }
}
