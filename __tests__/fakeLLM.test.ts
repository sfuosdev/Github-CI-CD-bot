import { describe, it, expect } from '@jest/globals'
import { FakeLLM } from '../src/llm/fakeLLM.js'

describe('FakeLLM', () => {
  it('returns the reply that was set', async () => {
    const llm = new FakeLLM()
    llm.setReply('hello')

    const result = await llm.complete('any prompt')

    expect(result).toBe('hello')
  })

  it('returns a different reply when set differently', async () => {
    const llm = new FakeLLM()
    llm.setReply('goodbye')

    const result = await llm.complete('any prompt')

    expect(result).toBe('goodbye')
  })
})
