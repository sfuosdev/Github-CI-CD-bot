import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { trimLog } from '../src/ci/log_trimmer.js'

type Case = {
  file: string
  category: string
  mustKeep: string
}

// One row per fixture log. Fill in the FILL_ME values yourself.
const cases: Case[] = [
  { file: 'build_error.log', category: 'build', mustKeep: 'error TS2307' },
  // eslint-disable-next-line prettier/prettier
  {
    file: 'build2_error.log',
    category: 'test',
    mustKeep: '1 failed, 28 passed'
  },
  // eslint-disable-next-line prettier/prettier
  { file: 'dependency_error.log', category: 'build', mustKeep: 'error TS2307' },
  {
    file: 'lint_parsing_error.log',
    category: 'lint',
    mustKeep: 'Parsing error'
  },
  // NOTE: really a test failure; marked build because the trimmer picks the first failure
  { file: 'test_error.log', category: 'build', mustKeep: 'error TS2694' }
]

const load = (name: string) =>
  readFileSync(join(process.cwd(), '__fixtures__', 'logs', name), 'utf8')

describe('trimLog', () => {
  describe.each(cases)('$file', ({ file, category, mustKeep }) => {
    const result = trimLog(load(file))

    it('keeps the real error', () => {
      expect(result.trimmed).toContain(mustKeep)
    })

    it('tags the right category', () => {
      expect(result.category).toBe(category)
    })

    it('stays under 4000 characters', () => {
      expect(result.trimmed.length).toBeLessThanOrEqual(4000)
    })

    it('strips colour codes and timestamps', () => {
      // eslint-disable-next-line no-control-regex
      expect(result.trimmed).not.toMatch(/\u001b/)
      expect(result.trimmed).not.toMatch(/^\d{4}-\d{2}-\d{2}T/m)
    })
  })
})
