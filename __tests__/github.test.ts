/**
 * Unit tests for the bot's github.context reader, src/github.ts
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as core from '@actions/core'
import { context } from '@actions/github'
import { getPRDetails } from '../src/github.js'

jest.mock('@actions/core')

jest.mock('@actions/github')

describe('getPRDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('successfully extracts PR details on a pull_request event', () => {
    const prDetails = getPRDetails()

    expect(prDetails).toEqual({
      repo: 'Hello-World',
      prNumber: 42,
      baseSha: 'base-sha-123',
      headSha: 'head-sha-456',
      runId: 12345
    })
    expect(core.notice).not.toHaveBeenCalled()
  })

  it('handles a newly opened pull request', () => {
    // Arrange context specifically for an 'opened' action
    context.payload = {
      action: 'opened',
      pull_request: {
        number: 42,
        base: { sha: 'base-sha-123' },
        head: { sha: 'head-sha-456' }
      }
    } as unknown as typeof context.payload

    const prDetails = getPRDetails()

    expect(prDetails).toEqual({
      repo: 'Hello-World',
      prNumber: 42,
      baseSha: 'base-sha-123',
      headSha: 'head-sha-456',
      runId: 12345
    })
    expect(core.notice).not.toHaveBeenCalled()
  })

  it('handles a synchronized (updated) pull request', () => {
    context.payload = {
      action: 'synchronize',
      pull_request: {
        number: 42,
        base: { sha: 'base-sha-123' },
        head: { sha: 'new-head-sha-789' }
      }
    } as unknown as typeof context.payload

    const prDetails = getPRDetails()

    expect(prDetails).toEqual({
      repo: 'Hello-World',
      prNumber: 42,
      baseSha: 'base-sha-123',
      headSha: 'new-head-sha-789',
      runId: 12345
    })
    expect(core.notice).not.toHaveBeenCalled()
  })

  it('logs a notice and returns null when event is not a pull_request', () => {
    context.eventName = 'push'
    context.payload.pull_request =
      undefined as unknown as typeof context.payload.pull_request

    const prDetails = getPRDetails()

    expect(prDetails).toBeNull()
    expect(core.notice).toHaveBeenCalledWith(
      expect.stringContaining(
        `This bot only reviews pull requests (current event: ${context.eventName}).`
      )
    )
  })
})
