import type { LLMClient } from '../src/llm/reviewer.js'

export class FakeLLM implements LLMClient {
  private reply = ''

  setReply(text: string): void {
    this.reply = text
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    return this.reply
  }
}
