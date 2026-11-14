import * as core from '@actions/core'
import { context } from '@actions/github'

export interface PRInfo {
  repo: string
  prNumber: number
  baseSha: string
  headSha: string
  runId: number
}

export function getPRDetails(): PRInfo | null {
  if (context.eventName !== 'pull_request' || !context.payload.pull_request) {
    core.notice(
      `This bot only reviews pull requests (current event: ${context.eventName}).`
    )
    return null
  }

  const pr = context.payload.pull_request
  return {
    repo: context.repo.repo,
    prNumber: pr.number,
    baseSha: pr.base.sha,
    headSha: pr.head.sha,
    runId: context.runId
  }
}
