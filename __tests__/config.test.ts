/**
 * Unit tests for the bot's configuration reader, src/config.ts
 */
import { describe, it, afterEach, expect, jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

jest.mock('@actions/core')

const { parseConfig } = await import('../src/config.js')

describe('config.ts', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('falls back to default values when inputs are empty', () => {
    core.getInput.mockReturnValue('')

    const config = parseConfig()

    expect(config.summary).toBe(true)
    expect(config.review).toBe(true)
    expect(config.explainFailure).toBe(true)
    expect(config.maxComments).toBe(5)
    expect(config.minConfidence).toBe(0.6)
    expect(config.ignorePaths).toEqual(['package-lock.json', 'dist/**'])
    expect(config.model).toBe('')
  })

  it('correctly parses custom valid inputs', () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'github-token':
          return 'fake-token-123'
        case 'ci-result':
          return 'success'
        case 'summary':
          return 'false'
        case 'max-comments':
          return '10'
        case 'min-confidence':
          return '0.9'
        case 'ignore-paths':
          return 'src/vendor/**, build/** '
        case 'model':
          return 'gpt-4o'
        default:
          return ''
      }
    })

    const config = parseConfig()

    expect(config.githubToken).toBe('fake-token-123')
    expect(config.ciResult).toBe('success')
    expect(config.summary).toBe(false)
    expect(config.maxComments).toBe(10)
    expect(config.minConfidence).toBe(0.9)
    expect(config.ignorePaths).toEqual(['src/vendor/**', 'build/**'])
    expect(config.model).toBe('gpt-4o')
  })

  it('throws an error when summary input is invalid', () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'summary') return 'maybe'
      return ''
    })

    expect(() => parseConfig()).toThrow(/Invalid input for 'summary'/)
  })

  it('throws an error when review input is invalid', () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'review') return 'maybe'
      return ''
    })

    expect(() => parseConfig()).toThrow(/Invalid input for 'review'/)
  })

  it('throws an error when explain-failure input is invalid', () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'explain-failure') return 'maybe'
      return ''
    })

    expect(() => parseConfig()).toThrow(/Invalid input for 'explain-failure'/)
  })

  it('throws an error when max-comments input is invalid', () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'max-comments') return 'abc'
      return ''
    })

    expect(() => parseConfig()).toThrow(/Invalid input for 'max-comments'/)
  })

  it('throws an error when min-confidence input is invalid', () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'min-confidence') return 'abc'
      return ''
    })

    expect(() => parseConfig()).toThrow(/Invalid input for 'min-confidence'/)
  })

  it('throws an error when ignore-paths input is empty', () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'ignore-paths') return ' '
      return ''
    })

    expect(() => parseConfig()).toThrow(/Invalid input for 'ignore-paths'/)
  })

  it('throws an error when ignore-paths input is empty list', () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'ignore-paths') return ' , , ,'
      return ''
    })

    expect(() => parseConfig()).toThrow(/Invalid input for 'ignore-paths'/)
  })
})
