export class FakeLLM {
  private reply = ''

  setReply(text: string): void {
    this.reply = text
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(prompt: string): Promise<string> {
    return this.reply
  }
}
