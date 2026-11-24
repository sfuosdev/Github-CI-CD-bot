import * as core from '@actions/core'
import type { LLMClient } from './reviewer.js'

const TIMEOUT_MS = 30_000

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>
}

function isChatCompletionResponse(
  value: unknown
): value is ChatCompletionResponse {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.choices) &&
    candidate.choices.length > 0 &&
    typeof candidate.choices[0] === 'object' &&
    candidate.choices[0] !== null &&
    typeof (candidate.choices[0] as Record<string, unknown>).message ===
      'object' &&
    typeof (
      (candidate.choices[0] as Record<string, unknown>).message as Record<
        string,
        unknown
      >
    ).content === 'string'
  )
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * Calls an OpenAI-compatible chat completions endpoint. Retries once on a
 * 429, a 5xx, or a timeout. Never throws: a down or rate-limited LLM must
 * never fail the bot's checks, so a terminal failure warns and returns null.
 */
export class HttpLLMClient implements LLMClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const reply = await this.requestCompletion(systemPrompt, userPrompt)
    if (reply === null) {
      throw new Error('LLM request failed after retry')
    }
    return reply
  }

  /**
   * Like complete(), but parses and validates JSON out of the reply. Retries
   * once more on bad JSON or a failed shape check, then gives up.
   */
  async completeJson<T>(
    systemPrompt: string,
    userPrompt: string,
    validate: (value: unknown) => value is T
  ): Promise<T | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const reply = await this.requestCompletion(systemPrompt, userPrompt)
      if (reply === null) return null

      try {
        const parsed: unknown = JSON.parse(reply)
        if (validate(parsed)) return parsed
        core.warning('LLM reply was valid JSON but failed shape validation')
      } catch {
        core.warning('LLM reply was not valid JSON')
      }
    }
    return null
  }

  private async requestCompletion(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          })
        })

        if (!response.ok) {
          if (isRetryableStatus(response.status) && attempt === 0) continue
          core.warning(`LLM request failed with status ${response.status}`)
          return null
        }

        const data: unknown = await response.json()
        if (!isChatCompletionResponse(data)) {
          core.warning('LLM response did not match the expected shape')
          return null
        }
        return data.choices[0].message.content
      } catch (error) {
        if (attempt === 0) continue
        core.warning(
          `LLM request failed: ${error instanceof Error ? error.message : String(error)}`
        )
        return null
      } finally {
        clearTimeout(timer)
      }
    }
    return null
  }
}
