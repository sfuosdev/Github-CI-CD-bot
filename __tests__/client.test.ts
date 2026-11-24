import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as core from '../__fixtures__/core.ts'

jest.unstable_mockModule('@actions/core', () => core)

const { HttpLLMClient } = await import('../src/llm/client.ts')

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response
}

describe('client.ts', () => {
  const fetchMock = jest.fn<typeof fetch>()

  beforeEach(() => {
    jest.resetAllMocks()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it('returns the reply content on success', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: 'hello' } }] })
    )
    const client = new HttpLLMClient('key', 'https://example.com', 'model')

    const result = await client.complete('system', 'user')

    expect(result).toBe('hello')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries once on a 429 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: 'ok' } }] })
      )
    const client = new HttpLLMClient('key', 'https://example.com', 'model')

    const result = await client.complete('system', 'user')

    expect(result).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after a timeout on both attempts, warning instead of crashing', async () => {
    const abortError = new DOMException(
      'The operation was aborted',
      'AbortError'
    )
    fetchMock.mockRejectedValue(abortError)
    const client = new HttpLLMClient('key', 'https://example.com', 'model')

    await expect(client.complete('system', 'user')).rejects.toThrow()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(core.warning).toHaveBeenCalled()
  })

  it('completeJson returns null when the reply is never valid JSON', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'not json' } }] })
    )
    const client = new HttpLLMClient('key', 'https://example.com', 'model')
    const isString = (value: unknown): value is string =>
      typeof value === 'string'

    const result = await client.completeJson('system', 'user', isString)

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
