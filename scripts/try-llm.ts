/**
 * Manual check: makes one real call to the LLM provider and prints the
 * reply. Not part of the test suite. Run with:
 *   npx tsx scripts/try-llm.ts
 */
import { readFileSync } from 'node:fs'
import { HttpLLMClient } from '../src/llm/client.ts'

for (const line of readFileSync('.env', 'utf-8').split('\n')) {
  const [key, ...rest] = line.split('=')
  if (!key || key.trim().startsWith('#') || rest.length === 0) continue
  process.env[key.trim()] ??= rest.join('=').trim()
}

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  throw new Error('Set GEMINI_API_KEY in your .env file first')
}

const baseUrl =
  process.env.LLM_BASE_URL ??
  'https://generativelanguage.googleapis.com/v1beta/openai'
const model = process.env.LLM_MODEL ?? 'gemini-flash-lite-latest'

const client = new HttpLLMClient(apiKey, baseUrl, model)

const reply = await client.complete(
  'You are a terse assistant.',
  'Say hello in exactly three words.'
)

console.log(reply)
